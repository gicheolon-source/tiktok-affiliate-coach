// Vercel Serverless Function — proxies scoring requests to Anthropic so the
// API key stays server-side (never shipped to the browser or the repo).
//
// Required env var (Vercel → Settings → Environment Variables):
//   ANTHROPIC_API_KEY = sk-ant-...
// Optional access gate:
//   APP_PASSCODE      = <a short secret>  (users enter this once per device)
//
// If ANTHROPIC_API_KEY is not set, returns 501 and the frontend falls back to
// the user's own browser-stored key.

const ALLOWED_MODELS = ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5"];

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(501).json({ error: "server key not configured" }); return; }

  const passcode = process.env.APP_PASSCODE;
  if (passcode && req.headers["x-app-passcode"] !== passcode) {
    res.status(401).json({ error: "invalid passcode" }); return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const model = ALLOWED_MODELS.includes(body.model) ? body.model : "claude-sonnet-5";
  const payload = {
    model,
    max_tokens: Math.min(Number(body.max_tokens) || 8000, 8192),
    system: body.system,
    messages: body.messages, // may contain multimodal image blocks — passed through as-is
  };
  if (body.output_config) payload.output_config = body.output_config;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
