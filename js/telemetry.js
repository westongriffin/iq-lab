/* IQ Lab - anonymous calibration telemetry.
   Sends item-level right/wrong + response time after a finished test, ONLY when
   the endpoint is configured AND the test-taker left the consent box checked.
   The payload contains no name, no free text, and no identifiers; the server
   stores no IPs or cookies. Failures are silent - the visitor's result never
   depends on this. */

const IQTelemetry = (() => {
  function enabled() {
    return !!(typeof IQConfig !== "undefined" && IQConfig.TELEMETRY_URL);
  }

  function consented() {
    const p = IQStore.getProfile();
    return p?.shareData !== false; // default yes, until the visitor unchecks
  }

  /** items: test form; responses: {itemId: {correct, rt}}; result: scored result */
  function send(mode, items, responses, result) {
    if (!enabled() || !consented()) return;
    const payload = {
      v: 1,
      mode,
      iq: result.iq,
      durationSec: result.durationSec ?? 0,
      lowEffort: !!result.lowEffort,
      items: items.map((it) => ({
        id: it.id,
        ok: !!responses[it.id]?.correct,
        rt: responses[it.id]?.rt ?? null,
      })),
    };
    try {
      const body = JSON.stringify(payload);
      const url = IQConfig.TELEMETRY_URL.replace(/\/$/, "") + "/submit";
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch { /* never disturb the user's result */ }
  }

  return { enabled, send };
})();
