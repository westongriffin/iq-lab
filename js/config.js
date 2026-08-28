/* IQ Lab - site configuration.
   TELEMETRY_URL: base URL of the calibration endpoint (Cloudflare Worker).
   Leave empty to disable all data collection - with it empty, the consent
   checkbox never renders and nothing ever leaves the browser. */

const IQConfig = {
  TELEMETRY_URL: "https://iqlab-telemetry.westongriffin.workers.dev",
};
