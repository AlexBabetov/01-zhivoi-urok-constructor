/**
 * Netlify Edge Function: generate-lesson
 * Проксирует запрос к Claude API со streaming.
 * Edge Functions не имеют таймаута CDN — поток течёт напрямую в браузер.
 *
 * Безопасность (Sprint 2):
 *   — JWT-проверка через Supabase перед любым вызовом Anthropic API
 *   — Whitelist допустимых моделей
 *   — Потолок max_tokens на сервере
 *   — Логирование generated-события в lesson_events
 */

// Разрешённые модели — клиентский выбор игнорируется если не в списке
const ALLOWED_MODELS = ["claude-haiku-4-5-20251001", "claude-3-5-haiku-20241022"];
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS_CEILING = 10000;

export default async (request, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Нет API ключа" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── Проверяем JWT и роль пользователя ─────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Auth сервис не настроен" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Требуется авторизация" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let verifiedUser;
  try {
    const jwtToken = authHeader.replace("Bearer ", "");
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${jwtToken}`, "apikey": supabaseServiceKey },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: "Недействительный токен" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    verifiedUser = await userResp.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ошибка проверки токена" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const userRole = verifiedUser.user_metadata?.role;
  if (!userRole || !["teacher", "admin"].includes(userRole)) {
    return new Response(JSON.stringify({ error: "Доступ запрещён: только для учителей и администраторов" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  // ─────────────────────────────────────────────────────

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Неверный JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

  const { system, userMessage, subject, grade, topic } = body;

  // Whitelist модели и потолок токенов — клиентские значения не принимаем как есть
  const safeModel = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const safeMaxTokens = Math.min(Number(body.max_tokens) || 8000, MAX_TOKENS_CEILING);

  // Вызов Claude API со streaming=true
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
    return new Response(JSON.stringify({ error: err.error?.message || `Claude API ${upstream.status}` }), {
      status: upstream.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Логируем generated-событие в Supabase (best-effort, non-blocking)
  // FIX: аналитика теперь в Edge (боевом пути), а не в мёртвой regular function
  fetch(`${supabaseUrl}/rest/v1/lesson_events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      user_id: verifiedUser.id,
      user_email: verifiedUser.email,
      event_type: "generated",
      subject: subject || null,
      grade: grade || null,
      lesson_title: topic || null,
      lesson_id: null,
    }),
  }).catch(() => {}); // игнорируем ошибки логирования — не блокируем генерацию

  // Пересылаем SSE-поток напрямую — токены текут в браузер по мере генерации
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};
