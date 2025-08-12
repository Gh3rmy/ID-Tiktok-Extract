"use strict";

const axios = require("axios");

function sanitizeUsername(raw) {
  return (raw || "").toString().replace(/^@/, "").trim();
}

function parseUserIdFromHtml(html, username) {
  if (!html) return { userId: null, secUid: null };

  const sigiMatch = html.match(/<script id=\"SIGI_STATE\"[^>]*>([\s\S]*?)<\/script>/);
  if (sigiMatch && sigiMatch[1]) {
    try {
      const state = JSON.parse(sigiMatch[1]);
      const usersMap = state?.UserModule?.users || {};

      const targetKey = Object.keys(usersMap).find(
        (key) => (usersMap[key]?.uniqueId || key || "").toLowerCase() === username.toLowerCase()
      );
      if (targetKey) {
        const userObj = usersMap[targetKey] || {};
        return {
          userId: userObj.id || userObj.userId || null,
          secUid: userObj.secUid || null,
        };
      }

      const firstKey = Object.keys(usersMap)[0];
      if (firstKey) {
        const userObj = usersMap[firstKey] || {};
        return {
          userId: userObj.id || userObj.userId || null,
          secUid: userObj.secUid || null,
        };
      }
    } catch (_) {}
  }

  const esc = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = html.match(new RegExp(`\\"uniqueId\\":\\"${esc}\\"[\\s\\S]{0,800}?\\"id\\":\\"(\\d+)\\"`));
  if (m) return { userId: m[1], secUid: null };

  m = html.match(/\"userId\":\"(\d+)\"/);
  if (m) return { userId: m[1], secUid: null };

  m = html.match(/userId\W+([0-9]{5,})/);
  if (m) return { userId: m[1], secUid: null };

  m = html.match(/\"secUid\":\"([^\"]+)\"/);
  if (m) return { userId: null, secUid: m[1] };

  return { userId: null, secUid: null };
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,es-ES;q=0.8,es;q=0.7",
      Referer: "https://www.tiktok.com/",
      Cookie: `tt_webid_v2=${Math.floor(Math.random() * 1e16)};`,
    },
    timeout: 15000,
    validateStatus: () => true,
  });
  if (response.status >= 400) {
    const err = new Error(`Status ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.data;
}

async function fetchUserDetail(username) {
  const baseHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    Referer: `https://www.tiktok.com/@${encodeURIComponent(username)}`,
    Cookie: `tt_webid_v2=${Math.floor(Math.random() * 1e16)};`,
  };

  const endpoints = [
    `https://www.tiktok.com/api/user/detail/?aid=1988&uniqueId=${encodeURIComponent(username)}`,
    `https://m.tiktok.com/api/user/detail/?aid=1988&uniqueId=${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://www.tiktok.com/api/user/detail/?aid=1988&uniqueId=${encodeURIComponent(username)}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await axios.get(url, {
        headers: baseHeaders,
        timeout: 15000,
        validateStatus: () => true,
      });
      if (resp.status >= 400) continue;

      let data = resp.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (_) {}
      }

      const userId =
        data?.user?.id ||
        data?.user?.userId ||
        data?.userInfo?.user?.id ||
        data?.userInfo?.user?.userId ||
        null;
      const secUid =
        data?.user?.secUid ||
        data?.userInfo?.user?.secUid ||
        null;

      if (userId || secUid) {
        return { userId: userId ? `${userId}` : null, secUid };
      }
    } catch (_) {}
  }

  return { userId: null, secUid: null };
}

async function fetchUserFromNodeShare(username) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    Referer: `https://www.tiktok.com/@${encodeURIComponent(username)}`,
    Cookie: `tt_webid_v2=${Math.floor(Math.random() * 1e16)};`,
    "X-Requested-With": "XMLHttpRequest",
  };

  const endpoints = [
    `https://www.tiktok.com/node/share/user/@${encodeURIComponent(username)}`,
    `https://m.tiktok.com/node/share/user/@${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://www.tiktok.com/node/share/user/@${encodeURIComponent(username)}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await axios.get(url, {
        headers,
        timeout: 15000,
        validateStatus: () => true,
      });
      if (resp.status >= 400) continue;

      let data = resp.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (_) {}
      }

      const userId =
        data?.userData?.userId ||
        data?.userInfo?.user?.userId ||
        data?.userInfo?.user?.id ||
        data?.user?.userId ||
        data?.user?.id ||
        data?.body?.userData?.userId ||
        null;
      const secUid =
        data?.userData?.secUid ||
        data?.userInfo?.user?.secUid ||
        data?.user?.secUid ||
        data?.body?.userData?.secUid ||
        null;

      if (userId || secUid) {
        return { userId: userId ? `${userId}` : null, secUid };
      }
    } catch (_) {}
  }
  return { userId: null, secUid: null };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const username = sanitizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: "Falta parámetro 'username'" });
  }

  try {
    let finalUserId = null;
    let finalSecUid = null;

    const apiIds = await fetchUserDetail(username);
    if (apiIds?.userId) finalUserId = apiIds.userId;
    if (apiIds?.secUid) finalSecUid = apiIds.secUid;

    if (!finalUserId && !finalSecUid) {
      const nodeIds = await fetchUserFromNodeShare(username);
      if (nodeIds?.userId) finalUserId = nodeIds.userId;
      if (nodeIds?.secUid) finalSecUid = nodeIds.secUid;
    }

    if (!finalUserId && !finalSecUid) {
      const candidates = [
        `https://www.tiktok.com/@${encodeURIComponent(username)}?is_copy_url=1&is_from_webapp=v1`,
        `https://www.tiktok.com/@${encodeURIComponent(username)}`,
        `https://m.tiktok.com/@${encodeURIComponent(username)}`,
        `https://r.jina.ai/http://www.tiktok.com/@${encodeURIComponent(username)}`,
      ];

      for (const url of candidates) {
        try {
          const html = await fetchHtml(url);
          const parsed = parseUserIdFromHtml(html, username);
          if (parsed?.userId || parsed?.secUid) {
            finalUserId = finalUserId || parsed.userId || null;
            finalSecUid = finalSecUid || parsed.secUid || null;
            break;
          }
        } catch (_) {}
      }
    }

    if (!finalUserId && !finalSecUid) {
      return res.status(404).json({ error: "No se pudo extraer el userId/secUid (404)" });
    }

    return res.json({ userId: finalUserId, secUid: finalSecUid });
  } catch (err) {
    const message = err?.message || "Error desconocido";
    return res.status(500).json({ error: message });
  }
};


