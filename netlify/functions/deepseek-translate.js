// OrzuMall multilingual translator proxy
// IMPORTANT: Never put the DeepSeek API key in frontend JS.
// In Netlify set: Site settings -> Environment variables -> DEEPSEEK_API_KEY

exports.handler = async function(event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Only POST is allowed" }) };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "DEEPSEEK_API_KEY environment variable is not configured on Netlify."
      })
    };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch (_e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const target = String(payload.target || "").toLowerCase();
  if (!["ru", "en"].includes(target)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "target must be ru or en" }) };
  }

  let texts = [];
  if (Array.isArray(payload.texts)) texts = payload.texts;
  else if (typeof payload.text === "string") texts = [payload.text];

  texts = texts
    .map(v => String(v == null ? "" : v).trim())
    .filter(Boolean)
    .slice(0, 20)
    .map(t => t.slice(0, 900));

  if (!texts.length) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "No text supplied" }) };
  }

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
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "DeepSeek API error", details: raw.slice(0, 600) })
      };
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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ translations })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Translation request failed", details: String(err && err.message || err) })
    };
  }
};
