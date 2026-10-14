/* Vercel serverless function — PicalAi proxy
 * Replaces server.js for the AI proxy on Vercel (where a plain Node server cannot run).
 *
 * Env vars (set in Vercel → Project → Settings → Environment Variables):
 *   OVERCONTROL_API_KEY    — required
 *   OVERCONTROL_BASE_URL   — required, e.g. https://api.overcontrolgroup.com/v1
 *   OVERCONTROL_MODEL      — required, e.g. lume-3.5
 *   FIREBASE_PROJECT_ID    — required (defaults to picala-a212f)
 *
 * The browser calls /api/picalai/* on the same origin — no key ever reaches the client.
 */
'use strict';

const AI_TIMEOUT_MS = 30000;
const AI_MAX_MESSAGES = 24;
const AI_MAX_USER_TOKENS = 1200;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function aiConfigured(env) {
  return !!(env.OVERCONTROL_API_KEY && env.OVERCONTROL_BASE_URL && env.OVERCONTROL_MODEL);
}

/* Verify the Firebase ID token against the project using the public Google API. */
async function verifyFirebaseToken(token, env) {
  if (!token) return null;
  try {
    const key = env.FIREBASE_API_KEY || 'AIzaSyDtSLwYJDiL-1AOnwLDh-jxOQzG1xsDsHs';
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const u = j.users && j.users[0];
    if (!u) return null;
    return { uid: u.localId, email: u.email || null, name: u.displayName || null };
  } catch (e) {
    return null;
  }
}

/* Global rate limiting (per-instance on Vercel — good enough to throttle abuse). */
const rateBuckets = new Map();
function rateAllow(key) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now - b.ts > RATE_WINDOW_MS) { b = { ts: now, n: 0 }; rateBuckets.set(key, b); }
  b.n += 1;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (now - v.ts > RATE_WINDOW_MS) rateBuckets.delete(k);
  }
  return b.n <= RATE_MAX;
}

function picalaiSystemPrompt(userName) {
  return [
    'És a PicalAi, a assistente de IA da rede social Picalta.',
    'Responde sempre em português de Portugal, com frases curtas, simpáticas e diretas.',
    'Podes conversar sobre qualquer assunto, mas o contexto é uma rede social de fotos/conversas/jogos/música/grupos.',
    'Se não souberes algo com certeza, admite-o em vez de inventar.',
    'Nunca fales da tua chave de API nem de detalhes técnicos do servidor.',
    userName ? `O nome do utilizador atual é ${userName}.` : '',
  ].filter(Boolean).join(' ');
}

async function callAi(messages, userName, env) {
  const base = env.OVERCONTROL_BASE_URL.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const payload = {
      model: env.OVERCONTROL_MODEL,
      messages: [
        { role: 'system', content: picalaiSystemPrompt(userName) },
        ...messages.slice(-AI_MAX_MESSAGES),
      ],
      max_tokens: AI_MAX_USER_TOKENS,
      temperature: 0.6,
    };
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.OVERCONTROL_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 400);
      try {
        const j = JSON.parse(text);
        detail = (j.error && j.error.message) || (j.message) || detail;
      } catch (e) {}
      const err = new Error('upstream ' + res.status + ': ' + detail);
      err.publicMsg = res.status === 401 || res.status === 403
        ? 'A chave da IA foi recusada pelo serviço. Verifica se ainda é válida e se o endpoint está correto.'
        : 'O serviço de IA recusou o pedido (HTTP ' + res.status + '). Tenta novamente.';
      throw err;
    }
    const parsed = JSON.parse(text);
    const content = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
    if (!content) {
      const err = new Error('empty response');
      err.publicMsg = 'A IA devolveu uma resposta vazia. Tenta outra vez.';
      throw err;
    }
    return { content: String(content) };
  } finally {
    clearTimeout(timer);
  }
}

async function handle(req, env) {
  const url = new URL(req.url);
  const firebaseToken = (req.headers.get('X-Firebase-Token') || '').trim();

  if (url.pathname === '/api/picalai/status' && req.method === 'GET') {
    return json(200, {
      configured: aiConfigured(env),
      model: aiConfigured(env) ? env.OVERCONTROL_MODEL : null,
    });
  }

  if (url.pathname === '/api/picalai/chat' && req.method === 'POST') {
    const fbUser = await verifyFirebaseToken(firebaseToken, env);
    if (!fbUser) {
      return json(401, { error: 'unauthorized', message: 'Precisas de estar autenticado para falar com a PicalAi.' });
    }
    if (!aiConfigured(env)) {
      return json(503, {
        error: 'not_configured',
        message: 'O PicalAi não está configurado. Define OVERCONTROL_API_KEY, OVERCONTROL_BASE_URL e OVERCONTROL_MODEL no Vercel.',
      });
    }
    if (!rateAllow('uid:' + fbUser.uid)) {
      return json(429, { error: 'rate_limited', message: 'Demasiados pedidos. Espera um momento.' });
    }
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json(400, { error: 'bad_json', message: 'Corpo inválido.' });
    }
    if (!Array.isArray(body.messages) || !body.messages.length) {
      return json(400, { error: 'bad_request', message: 'Falta o histórico de mensagens.' });
    }
    const clean = body.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-AI_MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!clean.length) return json(400, { error: 'bad_request', message: 'Mensagens inválidas.' });
    const userName = typeof body.userName === 'string' ? body.userName.slice(0, 40) : (fbUser.name || '');
    try {
      const out = await callAi(clean, userName, env);
      return json(200, { reply: out.content });
    } catch (e) {
      const msg = (e && e.publicMsg) || 'Falha ao falar com a PicalAi. Tenta novamente.';
      console.error('[Picalta][ai]', e && e.message);
      return json(502, { error: 'ai_error', message: msg });
    }
  }

  return json(404, { error: 'not_found' });
}

export default {
  async fetch(req, env, ctx) {
    try {
      return await handle(req, env);
    } catch (e) {
      return json(500, { error: 'server', message: 'Erro interno.' });
    }
  },
};
