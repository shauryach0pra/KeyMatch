/**
 * KeyMatch — Cloudflare Worker (Gemini Free API)
 * Keeps your Gemini API key secret on the server.
 * FREE: 1,500 requests/day, no credit card needed.
 *
 * DEPLOY:
 * 1. dash.cloudflare.com → Workers & Pages → Create Worker → paste this → Deploy
 * 2. Settings → Variables → Secrets → Add Secret
 *    Name: GEMINI_API_KEY  |  Value: your key from aistudio.google.com
 */

export default {
  async fetch(request, env) {

    // ── CORS preflight ────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/gemini') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body;
    try { body = await request.json(); }
    catch { return errorResponse('Invalid JSON', 400, request); }

    const { prompt, system } = body;
    if (!prompt) return errorResponse('Missing prompt', 400, request);

    // ── Build Gemini request ──────────────────────────────────────────────
    // Gemini 1.5 Flash — fast, free, excellent quality
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const geminiBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: (system ? `${system}\n\n---\n\n` : '') + prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2500,
      }
    };

    let geminiRes;
    try {
      geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      });
    } catch {
      return errorResponse('Failed to reach Gemini API', 502, request);
    }

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || 'Gemini API error';
      return new Response(JSON.stringify({ error: msg }), {
        status: geminiRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });
    }

    // ── Extract text from Gemini response ─────────────────────────────────
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
  }
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function errorResponse(msg, status, request) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
  });
}
