/**
 * Cloudflare Pages Function: /api/save-lesson
 * Сохраняет урок в GitHub репозиторий. Только для teacher/admin.
 *
 * Env vars: GITHUB_TOKEN, GITHUB_REPO, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

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

// Base64 helpers — без Node.js Buffer (Cloudflare Workers runtime)
function base64ToUtf8(b64) {
  const clean  = b64.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary  = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: cors });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const githubToken  = env.GITHUB_TOKEN;
  const repo         = env.GITHUB_REPO || "AlexBabetov/01-zhivoi-urok-constructor";
  const supabaseUrl  = env.SUPABASE_URL;
  const serviceKey   = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return json({ error: "Auth сервис не настроен" }, 500);
  if (!githubToken)                return json({ error: "GITHUB_TOKEN не задан" }, 500);

  // ── JWT-верификация ───────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Требуется авторизация" }, 401);

  let verifiedUser;
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": authHeader, "apikey": serviceKey },
    });
    if (!userResp.ok) return json({ error: "Недействительный токен" }, 401);
    verifiedUser = await userResp.json();
  } catch {
    return json({ error: "Ошибка проверки токена" }, 401);
  }

  const role = verifiedUser.user_metadata?.role;
  if (!role || !["teacher", "admin"].includes(role)) {
    return json({ error: "Доступ запрещён: только для учителей и администраторов" }, 403);
  }
  // ─────────────────────────────────────────────────────

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Неверный JSON" }, 400); }

  const { lesson, meta } = body;
  if (!lesson || !meta?.subject || !meta?.grade || !meta?.topic) {
    return json({ error: "Обязательные поля: lesson, meta.subject, meta.grade, meta.topic" }, 400);
  }

  // Перезаписываем автора из JWT
  meta.author_id    = verifiedUser.id;
  meta.author_email = verifiedUser.email;

  // ── Построение пути ───────────────────────────────────
  const subjectSlug = meta.subject
    .toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "-").replace(/[^a-zа-я0-9-]/g, "");
  const topicSlug = meta.topic
    .toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "-").replace(/[^a-zа-я0-9-]/g, "").slice(0, 40);

  const lessonNum = meta.lesson_num || 0;
  const filename  = `${lessonNum}_${topicSlug}.json`;
  const filePath  = `public/lessons/${subjectSlug}/${meta.grade}/${filename}`;
  const indexPath = `public/lessons/index.json`;
  const savedAt   = new Date().toISOString();
  const id        = `${subjectSlug}-${meta.grade}-${lessonNum}-${topicSlug.slice(0, 20)}`;

  // ── GitHub API ────────────────────────────────────────
  const ghHeaders = {
    "Authorization": `Bearer ${githubToken}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    // Cloudflare Workers не добавляют User-Agent автоматически,
    // но GitHub API требует его обязательно (иначе → 403)
    "User-Agent": "ZhivoyUrok360-Constructor/1.0",
  };
  const apiBase = `https://api.github.com/repos/${repo}/contents`;
  // Ветка для хранения уроков (по умолчанию main, можно переопределить через env)
  const lessonsBranch = env.GITHUB_BRANCH || "main";

  // Кодируем каждый сегмент пути отдельно — иначе кириллица вызывает 403 в Cloudflare Workers
  function encodedApiUrl(path) {
    const encoded = path.split("/").map(s => encodeURIComponent(s)).join("/");
    return `${apiBase}/${encoded}`;
  }

  async function getFile(path) {
    const url = encodedApiUrl(path) + `?ref=${lessonsBranch}`;
    const resp = await fetch(url, { headers: ghHeaders });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const rawBody = await resp.text().catch(() => "");
      let errMsg;
      try { errMsg = JSON.parse(rawBody).message; } catch { errMsg = rawBody.slice(0, 200); }
      throw new Error(`GitHub GET ${path}: ${resp.status} — ${errMsg || resp.statusText} | URL: ${url} | BRANCH: ${lessonsBranch} | TOKEN_START: ${(githubToken||"").slice(0,8)}`);
    }
    const data = await resp.json();
    return { content: base64ToUtf8(data.content), sha: data.sha };
  }

  async function putFile(path, content, sha, message) {
    const payload = { message, content: utf8ToBase64(content), branch: lessonsBranch };
    if (sha) payload.sha = sha;
    const resp = await fetch(encodedApiUrl(path), {
      method: "PUT", headers: ghHeaders, body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub PUT ${path}: ${resp.status} — ${err.message || resp.statusText}`);
    }
    return resp.json();
  }

  try {
    // 1. Сохраняем файл урока
    const lessonContent  = JSON.stringify({ meta, lesson, saved_at: savedAt }, null, 2);
    const existingLesson = await getFile(filePath);
    await putFile(filePath, lessonContent, existingLesson?.sha || null,
      `Урок: ${meta.subject} ${meta.grade} кл. №${lessonNum} — «${meta.topic}»`);

    // 2. Обновляем index.json
    const indexEntry = {
      id, subject: meta.subject, grade: meta.grade, lesson_num: lessonNum,
      topic: meta.topic, model: meta.model || "", saved_at: savedAt,
      filename: `${subjectSlug}/${meta.grade}/${filename}`,
      author_id: meta.author_id, author_email: meta.author_email,
    };
    const existingIndex = await getFile(indexPath);
    let indexArr = [];
    if (existingIndex) {
      try { indexArr = JSON.parse(existingIndex.content); } catch { indexArr = []; }
    }
    indexArr = indexArr.filter(e => e.id !== id);
    indexArr.unshift(indexEntry);
    await putFile(indexPath, JSON.stringify(indexArr, null, 2), existingIndex?.sha || null,
      `Индекс: ${meta.subject} ${meta.grade}/${lessonNum} — «${meta.topic}»`);

    // 3. Логируем saved-событие (best-effort)
    fetch(`${supabaseUrl}/rest/v1/lesson_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_id: meta.author_id, user_email: meta.author_email,
        event_type: "saved", subject: meta.subject, grade: meta.grade,
        lesson_title: meta.topic, lesson_id: id,
      }),
    }).catch(() => {});

    return json({ ok: true, id, filename: filePath, total: indexArr.length });
  } catch (err) {
    return json({ error: "Ошибка сохранения: " + err.message }, 500);
  }
}
