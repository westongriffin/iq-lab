#!/usr/bin/env python3
"""IQ Lab - empirical item calibration from collected responses.

Pulls the anonymized response export from the telemetry worker and reports,
per item: sample size, empirical pass rate, item-total correlation (point-
biserial, rest-score), and the suggested replacement for the a-priori `p`
in js/items.js. Also reports per-form Cronbach's alpha.

Usage:
  python3 scripts/calibrate.py https://<worker-url> <ADMIN_KEY>

Guidance:
  - Trust empirical pass rates once an item has n >= 150 clean sessions.
  - Items with rest-score correlation < .10 discriminate poorly: consider
    replacing them.
  - Low-effort-flagged sessions are excluded server-side from /stats and
    here from /export rows.
"""
import json
import sys
import urllib.request
from collections import defaultdict


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    base, key = sys.argv[1].rstrip("/"), sys.argv[2]
    with urllib.request.urlopen(f"{base}/export?key={key}") as r:
        rows = json.load(r)

    rows = [r for r in rows if not r["low_effort"]]
    if not rows:
        print("No clean responses collected yet.")
        return

    by_session = defaultdict(dict)
    modes = {}
    for r in rows:
        by_session[r["session"]][r["item_id"]] = r["correct"]
        modes[r["session"]] = r["mode"]

    print(f"Clean sessions: {len(by_session)} "
          f"(short: {sum(1 for m in modes.values() if m=='short')}, "
          f"long: {sum(1 for m in modes.values() if m=='long')})\n")

    # per-item stats
    items = defaultdict(lambda: {"n": 0, "pass": 0, "rpb_num": 0.0})
    for sid, resp in by_session.items():
        total = sum(resp.values())
        for iid, ok in resp.items():
            it = items[iid]
            it["n"] += 1
            it["pass"] += ok
            it.setdefault("pairs", []).append((ok, total - ok))  # rest score

    print(f"{'item':6} {'n':>5} {'pass':>6} {'r_it':>6}  suggestion")
    for iid in sorted(items):
        it = items[iid]
        n, p = it["n"], it["pass"] / it["n"]
        pairs = it["pairs"]
        # point-biserial vs rest score
        mx = sum(x for x, _ in pairs) / n
        my = sum(y for _, y in pairs) / n
        cov = sum((x - mx) * (y - my) for x, y in pairs) / n
        vx = sum((x - mx) ** 2 for x, _ in pairs) / n
        vy = sum((y - my) ** 2 for _, y in pairs) / n
        r = cov / (vx * vy) ** 0.5 if vx > 0 and vy > 0 else float("nan")
        note = ""
        if n < 150:
            note = "(small n - keep a-priori p)"
        elif r < 0.10:
            note = f"REVIEW: weak discrimination; else set p={p:.2f}"
        else:
            note = f"set p={p:.2f} in js/items.js"
        print(f"{iid:6} {n:>5} {p:>6.3f} {r:>6.2f}  {note}")

    # Cronbach's alpha per mode
    for mode in ("short", "long"):
        sess = [resp for sid, resp in by_session.items() if modes[sid] == mode]
        if len(sess) < 30:
            continue
        ids = sorted({i for s in sess for i in s})
        k = len(ids)
        var_items = 0.0
        totals = []
        for i in ids:
            xs = [s.get(i, 0) for s in sess]
            m = sum(xs) / len(xs)
            var_items += sum((x - m) ** 2 for x in xs) / len(xs)
        for s in sess:
            totals.append(sum(s.values()))
        mt = sum(totals) / len(totals)
        var_total = sum((t - mt) ** 2 for t in totals) / len(totals)
        if var_total > 0:
            alpha = k / (k - 1) * (1 - var_items / var_total)
            print(f"\nCronbach's alpha ({mode}, n={len(sess)}): {alpha:.3f}")


if __name__ == "__main__":
    main()
