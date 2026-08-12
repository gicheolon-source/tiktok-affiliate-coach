// Vercel Serverless Function — Whisper transcription proxy
// The browser extracts audio from the uploaded video, downsamples it to 16 kHz
// mono WAV, and posts it here as base64 JSON. We forward it to OpenAI Whisper
// (server-side key) so the same flow works on iPhone/Safari where the Web Speech
// API is unavailable. Returns { text, segments[] } (segments carry timestamps,
// used later for pacing / dead-air analysis).

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Optional team passcode gate (mirrors api/feedback.js).
  const need = process.env.APP_PASSCODE;
  if (need && (req.headers["x-app-passcode"] || "") !== need) {
    return res.status(401).json({ error: "Incorrect access passcode." });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // Frontend falls back to manual transcript entry when this returns 501.
    return res.status(501).json({ error: "Server OpenAI key not set (OPENAI_API_KEY)." });
  }

  const body = req.body || {};
  const b64 = body.audio;
  const mime = body.mime || "audio/wav";
  if (!b64 || typeof b64 !== "string") {
    return res.status(400).json({ error: "No audio payload." });
  }

  let buf;
  try { buf = Buffer.from(b64, "base64"); } catch (_) { buf = null; }
  if (!buf || !buf.length) return res.status(400).json({ error: "Empty audio." });

  try {
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: mime }), "audio.wav");
    fd.append("model", "whisper-1");
    fd.append("response_format", "verbose_json");
    fd.append("language", "en");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: fd,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: (j.error && j.error.message) || ("Whisper error " + r.status) });
    }
    const segments = Array.isArray(j.segments)
      ? j.segments.map(s => ({ start: s.start, end: s.end, text: (s.text || "").trim() }))
      : [];
    return res.json({ text: (j.text || "").trim(), segments, duration: j.duration || null });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Transcription failed." });
  }
}
