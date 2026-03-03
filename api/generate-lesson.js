/**
 * Vercel Edge Function: /api/generate-lesson
 * Проксирует запрос к Claude API со streaming SSE.
 *
 * Security:
 *  - Whitelist моделей (ALLOWED_MODELS)
 *  - Потолок max_tokens (MAX_TOKENS_CEILING)
 *  - JWT-верификация через Supabase: авторизованные запросы логируются;
 *    гости допускаются (AUTH_REQUIRED=false в приложении), но помечаются.
 *  - Логирование события "generated" в lesson_events для авторизованных.
 */

export const config = { runtime: 'edge' };

const ALLOWED_MODELS    = ["claude-haiku-4-5-20251001", "claude-3-5-haiku-20241022"];
const DEFAULT_MODEL     = "claude-haiku-4-5-20251001";
const MAX_TOKENS_CEILING = 10000;
const DAILY_LIMIT_TEACHER = 5;  // максимум генераций в сутки для учителя
const DAILY_LIMIT_ADMIN   = 10; // максимум генераций в сутки для администратора

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

/** Верифицирует JWT через Supabase. Возвращает user или null. */
async function verifyJWT(authHeader, supabaseUrl, serviceKey) {
  if (!authHeader || !supabaseUrl || !serviceKey) return null;
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": authHeader, "apikey": serviceKey },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const apiKey     = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) return json({ error: "Нет API ключа" }, 500);

  // ── JWT-верификация (мягкая: гости допускаются, авторизованные логируются) ──
  const authHeader = req.headers.get("Authorization");
  const user = await verifyJWT(authHeader, supabaseUrl, serviceKey);

  // Если токен передан, но невалиден — отклоняем
  if (authHeader && !user) {
    return json({ error: "Недействительный токен авторизации" }, 401);
  }

  // ── Rate limiting: дневной лимит генераций ────────────────────────────────────
  // Авторизованные: учитель — 5/день, admin/superadmin — 10/день
  // Гости (не авторизованы): 2 попытки — по IP (best-effort через заголовок)
  if (user && supabaseUrl && serviceKey) {
    const role  = user.user_metadata?.role || "teacher";
    const limit = ["admin", "superadmin"].includes(role) ? DAILY_LIMIT_ADMIN : DAILY_LIMIT_TEACHER;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const countRes = await fetch(
      `${supabaseUrl}/rest/v1/lesson_events?select=id&user_id=eq.${user.id}&event_type=eq.generated&created_at=gte.${since}`,
      { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    );
    if (countRes.ok) {
      const rows = await countRes.json();
      if (Array.isArray(rows) && rows.length >= limit) {
        return json({
          error: `Дневной лимит исчерпан: не более ${limit} уроков в день. Попробуйте завтра.`,
          limit,
          used: rows.length,
        }, 429);
      }
    }
  } else if (!user) {
    // Гость — ограничение по IP, best-effort
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || "unknown";
    const GUEST_LIMIT = 2;
    if (supabaseUrl && serviceKey && ip !== "unknown") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/lesson_events?select=id&user_email=eq.guest:${ip}&event_type=eq.generated&created_at=gte.${since}`,
        { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
      );
      if (countRes.ok) {
        const rows = await countRes.json();
        if (Array.isArray(rows) && rows.length >= GUEST_LIMIT) {
          return json({
            error: `Вы использовали бесплатный лимит (${GUEST_LIMIT} урока). Зарегистрируйтесь, чтобы создавать уроки без ограничений.`,
            limit: GUEST_LIMIT,
            used: rows.length,
            suggest_register: true,
          }, 429);
        }
      }
    }
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Неверный JSON" }, 400); }

  const { system, userMessage } = body;
  const safeModel     = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const safeMaxTokens = Math.min(Number(body.max_tokens) || 8000, MAX_TOKENS_CEILING);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      safeModel,
      max_tokens: safeMaxTokens,
      stream:     true,
      system,
      messages:   [{ role: "user", content: userMessage }],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    return json({ error: err.error?.message || `Claude API ${upstream.status}` }, upstream.status);
  }

  // ── Логирование события generated (best-effort) ───────────────────────────
  if (supabaseUrl && serviceKey) {
    const subject   = body.subject || null;
    const grade     = body.grade   || null;
    const topic     = body.topic   || null;
    const guestIp   = !user
      ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null)
      : null;

    fetch(`${supabaseUrl}/rest/v1/lesson_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey":        serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({
        user_id:      user?.id    || null,
        user_email:   user?.email || (guestIp ? `guest:${guestIp}` : null),
        event_type:   "generated",
        subject,
        grade,
        lesson_title: topic,
        lesson_id:    null,
      }),
    }).catch(() => {}); // best-effort
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
