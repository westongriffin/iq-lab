/* IQ Lab calibration endpoint - Cloudflare Worker + D1.
   Receives fully anonymous item-response data (with the test-taker's consent)
   so item difficulties can be empirically calibrated. Stores NO personal data:
   no names, no IPs, no cookies, no fingerprints. */

const ALLOWED_ORIGINS = [
  "https://theofficialiqtest.com",
  "https://www.theofficialiqtest.com",
  "http://localhost:8123",
];

const MAX_BODY = 20_000; // bytes
const MODES = new Set(["short", "long"]);

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function bad(msg, origin, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: cors(origin) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (url.pathname === "/submit" && req.method === "POST") {
      const len = Number(req.headers.get("Content-Length") || 0);
      if (len > MAX_BODY) return bad("too large", origin, 413);
      let p;
      try { p = await req.json(); } catch { return bad("bad json", origin); }

      // strict shape validation
      if (p?.v !== 1 || !MODES.has(p.mode) || !Array.isArray(p.items)) return bad("bad payload", origin);
      if (p.items.length < 1 || p.items.length > 60) return bad("bad items", origin);
      const iq = Number(p.iq), dur = Number(p.durationSec);
      if (!(iq >= 40 && iq <= 160) || !(dur >= 0 && dur < 86400)) return bad("bad fields", origin);
      for (const it of p.items) {
        if (typeof it.id !== "string" || it.id.length > 8) return bad("bad item id", origin);
        if (typeof it.ok !== "boolean") return bad("bad item ok", origin);
        if (it.rt != null && !(Number(it.rt) >= 0 && Number(it.rt) < 3600)) return bad("bad rt", origin);
      }

      const sid = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO sessions (id, ts, mode, iq, raw, duration_sec, low_effort) VALUES (?,?,?,?,?,?,?)"
      ).bind(sid, Date.now(), p.mode, iq, p.items.filter((i) => i.ok).length, Math.round(dur), p.lowEffort ? 1 : 0).run();

      const stmt = env.DB.prepare(
        "INSERT INTO responses (session_id, item_id, correct, rt) VALUES (?,?,?,?)"
      );
      await env.DB.batch(p.items.map((it) =>
        stmt.bind(sid, it.id, it.ok ? 1 : 0, it.rt == null ? null : Math.round(Number(it.rt) * 10) / 10)
      ));
      return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
    }

    // admin endpoints (require ?key=<ADMIN_KEY> secret)
    if (req.method === "GET" && (url.pathname === "/stats" || url.pathname === "/export")) {
      if (url.searchParams.get("key") !== env.ADMIN_KEY) return bad("unauthorized", origin, 401);

      if (url.pathname === "/stats") {
        const items = await env.DB.prepare(`
          SELECT r.item_id AS id, COUNT(*) AS n, ROUND(AVG(r.correct), 3) AS pass_rate,
                 ROUND(AVG(r.rt), 1) AS mean_rt
          FROM responses r JOIN sessions s ON s.id = r.session_id
          WHERE s.low_effort = 0
          GROUP BY r.item_id ORDER BY pass_rate DESC`).all();
        const sessions = await env.DB.prepare(`
          SELECT mode, COUNT(*) AS n, ROUND(AVG(iq), 1) AS mean_iq, ROUND(AVG(raw), 1) AS mean_raw,
                 SUM(low_effort) AS low_effort_n
          FROM sessions GROUP BY mode`).all();
        return new Response(JSON.stringify({ sessions: sessions.results, items: items.results }, null, 2),
          { headers: cors(origin) });
      }

      const limit = Math.min(Number(url.searchParams.get("limit") || 50000), 100000);
      const rows = await env.DB.prepare(`
        SELECT s.id AS session, s.ts, s.mode, s.iq, s.low_effort, r.item_id, r.correct, r.rt
        FROM responses r JOIN sessions s ON s.id = r.session_id
        ORDER BY s.ts LIMIT ?`).bind(limit).all();
      return new Response(JSON.stringify(rows.results), { headers: cors(origin) });
    }

    return bad("not found", origin, 404);
  },
};
