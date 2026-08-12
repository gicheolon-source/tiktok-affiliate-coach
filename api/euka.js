// Vercel Serverless Function — EUKA video-stats lookup
// Given a posted TikTok video id (parsed from its URL), finds that video's
// real performance in EUKA's affiliate feed: views, likes, comments, GMV,
// items sold. Multi-region: ?region=us (EUKA_TOKEN) or ?region=uk (EUKA_TOKEN_UK).
//
// EUKA's video id (v.id) equals the numeric TikTok video id in the share URL,
// so we paginate the store-scoped discover feed and match by id.

export const config = { maxDuration: 30 };

const MCP_URL  = "https://app.euka.ai/api/mcp";
const TOKEN_US = process.env.EUKA_TOKEN    || "";
const TOKEN_UK = process.env.EUKA_TOKEN_UK || "";
const STORE_ID_FALLBACK    = "c25bdcf5-ae35-4b0c-a348-9b14e0bdc4f5"; // Dr.Reju-All US
const STORE_ID_FALLBACK_UK = "c870ba69-4612-425b-a810-d85b5d13d70a"; // Dr.Reju-All UK

function dateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function initSession(token) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 0, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "coach-proxy", version: "1.0.0" } },
    }),
  });
  return res.headers.get("Mcp-Session-Id") || null;
}

function extractResult(result) {
  if (!result) return result;
  if (result.content && Array.isArray(result.content)) {
    const text = result.content[0]?.text;
    if (text) { try { return JSON.parse(text); } catch (_) { return text; } }
  }
  return result;
}

async function mcpTool(name, args, sessionId, token) {
  const headers = { "Content-Type": "application/json", Authorization: token, Accept: "application/json, text/event-stream" };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const res = await fetch(MCP_URL, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  if (text.includes("data:")) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const json = JSON.parse(line.slice(5).trim());
        if (json.result) return extractResult(json.result);
        if (json.error) throw new Error(json.error.message);
      } catch (_) {}
    }
  }
  try {
    const json = JSON.parse(text);
    if (json.result) return extractResult(json.result);
    if (json.error) throw new Error(json.error.message);
    return json;
  } catch (_) {}
  return { raw: text };
}

async function resolveStoreId(sessionId, token, fallback) {
  try {
    const stores = await mcpTool("list_accessible_stores", {}, sessionId, token);
    const list = Array.isArray(stores) ? stores : stores?.result;
    if (Array.isArray(list) && list[0]?.storeId) return list[0].storeId;
  } catch (_) {}
  return fallback || null;
}

// Pull the store product ids so the discover feed stays scoped to our brand
// (an empty productIds filter returns the whole marketplace).
async function getProductIds(call, storeId, start, end) {
  try {
    const prods = await call("get_dashboard_products_performance", {
      storeId, postedDateRange: { start, end }, pageSize: 100, sortField: "gmv", sortOrder: "DESC",
    });
    const plist = prods?.products || prods?.result?.products || (Array.isArray(prods) ? prods : []);
    return plist.map(p => p.productId || p.id).filter(Boolean).slice(0, 50);
  } catch (_) { return []; }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  res.setHeader("Access-Control-Allow-Origin", "*");

  const region = req.query.region === "uk" ? "uk" : "us";
  const TOKEN = region === "uk" ? TOKEN_UK : TOKEN_US;
  const FALLBACK = region === "uk" ? STORE_ID_FALLBACK_UK : STORE_ID_FALLBACK;
  if (!TOKEN) {
    return res.status(501).json({ ok: false, error: `EUKA token for "${region}" not set (${region === "uk" ? "EUKA_TOKEN_UK" : "EUKA_TOKEN"}, include "Bearer " prefix).` });
  }

  const videoId = String(req.query.videoId || "").replace(/\D/g, "");
  if (!videoId) return res.status(400).json({ ok: false, error: "Missing videoId." });

  // Look back ~180 days by default; a posted affiliate video should be within this window.
  const end = dateStr(0);
  const start = dateStr(180);

  try {
    const sessionId = await initSession(TOKEN);
    const STORE_ID = await resolveStoreId(sessionId, TOKEN, FALLBACK);
    const call = (name, args) => mcpTool(name, args, sessionId, TOKEN);
    const productIds = await getProductIds(call, STORE_ID, start, end);

    let found = null;
    let cursor = null;
    for (let page = 0; page < 5 && !found; page++) {
      const args = { storeId: STORE_ID, sortBy: "postedAt", limit: 100, postedAfter: start, postedBefore: end };
      if (productIds.length) args.productIds = productIds;
      if (cursor) args.cursor = cursor;
      const chunk = await call("discover_social_intelligence_videos", args);
      const items = chunk?.items || chunk?.result?.items || (Array.isArray(chunk) ? chunk : []);
      for (const v of items) {
        if (String(v.id) === videoId) {
          const m = v.metrics || {}, c = v.creator || {}, p = v.product || {};
          const views = m.views || 0, likes = m.likes || 0, comments = m.comments || 0;
          const engRate = views > 0 ? (likes + comments) / views : 0;
          const convRate = views > 0 ? (m.itemsSold || 0) / views : 0;
          found = {
            videoId, views, likes, comments,
            revenue: m.revenue || 0,
            itemsSold: m.itemsSold || 0,
            engagementRate: engRate,
            conversionRate: convRate,
            currencyCode: v.currencyCode || (region === "uk" ? "GBP" : "USD"),
            postedDate: v.postedAt || v.postedDate || "",
            creatorHandle: c.handle || "",
            creatorName: c.name || "",
            followerCount: c.followerCount || 0,
            productTitle: p.title || "",
          };
          break;
        }
      }
      const pi = chunk?.pageInfo || chunk?.result?.pageInfo || {};
      cursor = pi.nextCursor || null;
      if (!pi.hasNextPage || !cursor) break;
    }

    if (!found) {
      return res.json({ ok: true, region, found: false, note: "Video not found in EUKA's tracked feed (may be too new, not tagged to our products, or older than 180 days)." });
    }
    return res.json({ ok: true, region, found: true, stat: found });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
