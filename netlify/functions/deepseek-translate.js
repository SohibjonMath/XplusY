// OrzuMall admin-only DeepSeek translator proxy
// IMPORTANT:
// 1) DeepSeek API key stays only in Netlify env: DEEPSEEK_API_KEY
// 2) This function is ADMIN ONLY. Public users cannot use it.
// 3) Admin panel must send Firebase ID token in Authorization: Bearer <token>

const admin = require("firebase-admin");

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function initFirebaseAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64. Admin-only API cannot verify Firebase login.");
  }
  const jsonText = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(jsonText);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function getBearerToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function envAdminEmails() {
  const defaults = ["sohibjonmath@gmail.com"];
  const fromEnv = String(process.env.ADMIN_EMAILS || process.env.ORZUMALL_ADMIN_EMAILS || "")
    .split(/[;,\s]+/)
    .map(normEmail)
    .filter(Boolean);
  return Array.from(new Set([...defaults.map(normEmail), ...fromEnv]));
}

async function loadAdminEmailsFromFirestore() {
  try {
    const snap = await admin.firestore().doc("configs/admins").get();
    const data = snap.exists ? (snap.data() || {}) : {};
    return Array.isArray(data.emails) ? data.emails.map(normEmail).filter(Boolean) : [];
  } catch (_e) {
    return [];
  }
}

async function requireAdmin(event) {
  initFirebaseAdmin();
  const token = getBearerToken(event);
  if (!token) {
    return { ok: false, statusCode: 401, message: "Admin Firebase token required. Public users cannot use this API." };
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (_e) {
    return { ok: false, statusCode: 401, message: "Invalid or expired Firebase token." };
  }

  const email = normEmail(decoded.email);
  const admins = Array.from(new Set([...envAdminEmails(), ...(await loadAdminEmailsFromFirestore())]));
  if (!email || !admins.includes(email)) {
    return { ok: false, statusCode: 403, message: "Only OrzuMall admins can use DeepSeek translation." };
  }

  return { ok: true, email, uid: decoded.uid };
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json; charset=utf-8"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Only POST is allowed. This API is admin-only." });
  }

  const auth = await requireAdmin(event);
  if (!auth.ok) {
    return json(auth.statusCode, { error: auth.message });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;
  if (!apiKey) {
    return json(500, { error: "DEEPSEEK_API_KEY environment variable is not configured on Netlify." });
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch (_e) { return json(400, { error: "Invalid JSON body" }); }

  const target = String(payload.target || "").toLowerCase();
  if (!["ru", "en"].includes(target)) {
    return json(400, { error: "target must be ru or en" });
  }

  let texts = [];
  if (Array.isArray(payload.texts)) texts = payload.texts;
  else if (typeof payload.text === "string") texts = [payload.text];

  texts = texts
    .map(v => String(v == null ? "" : v).trim())
    .filter(Boolean)
    .slice(0, 20)
    .map(t => t.slice(0, 900));

  if (!texts.length) return json(400, { error: "No text supplied" });

  const targetName = target === "ru" ? "Russian" : "English";
  const userPayload = {
    source_language: "Uzbek",
    target_language: targetName,
    rules: [
      "Translate for an e-commerce marketplace in Uzbekistan.",
      "Preserve brand names: OrzuMall, Uzum, Click, Payme, Telegram.",
      "Preserve numbers, prices, percentages, SKUs, product model names, emojis, HTML tags and units such as g, kg, ml, sm, cm, so'm.",
      "Do not add explanations. Return only valid JSON."
    ],
    texts
  };

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a professional Uzbek to Russian/English translator for product pages. Return JSON exactly in this format: {\"translations\":[\"...\"]}. The translations array must have the same length and order as the input texts."
          },
          { role: "user", content: JSON.stringify(userPayload) }
        ]
      })
    });

    const raw = await res.text();
    if (!res.ok) {
      return json(res.status, { error: "DeepSeek API error", details: raw.slice(0, 600) });
    }

    let data = {};
    try { data = JSON.parse(raw); } catch (_e) {}
    const content = data?.choices?.[0]?.message?.content || "";
    let parsed = {};
    try { parsed = JSON.parse(content); }
    catch (_e) {
      const m = String(content).match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    let translations = Array.isArray(parsed.translations) ? parsed.translations : [];
    translations = texts.map((t, i) => String(translations[i] || t).trim() || t);
    return json(200, { translations });
  } catch (err) {
    return json(500, { error: "Translation request failed", details: String(err && err.message || err) });
  }
};
