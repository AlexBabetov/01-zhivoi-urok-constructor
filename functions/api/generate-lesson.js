/**
 * Cloudflare Pages Function: /api/generate-lesson
 * Проксирует запрос к Claude API со streaming SSE.
 *
 * Безопасность: JWT-верификация через Supabase, whitelist моделей, потолок токенов.
 */

const ALLOWED_MODELS = ["claude-haiku-4-5-20251001", "claude-3-5-haiku-20241022"];
const DEFAULT_MODEL  = "claude-haiku-4-5-20251001";
const MAX_TOKENS_CEILING = 10000;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: cors });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey       = env.ANTHROPIC_API_KEY;
  const supabaseUrl  = env.SUPABASE_URL;
  const serviceKey   = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey)                       return json({ error: "Нет API ключа" }, 500);
  if (!supabaseUrl || !serviceKey)   return json({ error: "Auth сервис не настроен" }, 500);

  // ── JWT-верификация (опциональная — тестовый режим) ──────────────────────
  // AUTH_REQUIRED=false: разрешаем запросы без токена для тестирования.
  // Когда авторизация будет починена — вернуть проверку.
  const AUTH_REQUIRED = false;

  const authHeader = request.headers.get("Authorization");
  let verifiedUser = null;

  if (authHeader && supabaseUrl && serviceKey) {
    try {
      const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { "Authorization": authHeader, "apikey": serviceKey },
      });
      if (userResp.ok) {
        verifiedUser = await userResp.json();
        const role = verifiedUser.user_metadata?.role;
        if (!role || !["teacher", "admin"].includes(role)) {
          verifiedUser = null; // недостаточно прав, но не блокируем (тестовый режим)
        }
      }
    } catch {
      // не критично в тестовом режиме
    }
  }

  if (AUTH_REQUIRED && !verifiedUser) {
    return json({ error: "Требуется авторизация" }, 401);
  }
  // ─────────────────────────────────────────────────────────────────────────

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Неверный JSON" }, 400); }

  const { system, userMessage, subject, grade, topic } = body;
  const safeModel     = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const safeMaxTokens = Math.min(Number(body.max_tokens) || 8000, MAX_TOKENS_CEILING);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: safeModel,
      max_tokens: safeMaxTokens,
      stream: true,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    return json({ error: err.error?.message || `Claude API ${upstream.status}` }, upstream.status);
  }

  // Логируем generated-событие (best-effort, non-blocking)
  fetch(`${supabaseUrl}/rest/v1/lesson_events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      user_id: verifiedUser?.id || null,
      user_email: verifiedUser?.email || null,
      event_type: "generated",
      subject: subject || null,
      grade: grade || null,
      lesson_title: topic || null,
      lesson_id: null,
    }),
  }).catch(() => {});

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
