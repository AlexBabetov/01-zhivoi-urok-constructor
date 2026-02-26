/**
 * Netlify Function: save-lesson
 * Сохраняет сгенерированный урок ЖУ360 в GitHub репозиторий
 *
 * Требует env variables (Netlify > Site settings > Environment variables):
 *   GITHUB_TOKEN — Personal Access Token, права contents: write
 *   GITHUB_REPO  — AlexBabetov/01-zhivoi-urok-constructor (по умолчанию)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // ── Проверяем JWT и роль пользователя ─────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Auth сервис не настроен" }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Требуется авторизация" }) };
  }

  let verifiedUser;
  try {
    const jwtToken = authHeader.replace("Bearer ", "");
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${jwtToken}`, "apikey": supabaseServiceKey },
    });
    if (!userResp.ok) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Недействительный токен" }) };
    }
    verifiedUser = await userResp.json();
  } catch (e) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Ошибка проверки токена" }) };
  }

  const userRole = verifiedUser.user_metadata?.role;
  if (!userRole || !["teacher", "admin"].includes(userRole)) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Доступ запрещён: только для учителей и администраторов" }) };
  }
  // ─────────────────────────────────────────────────────

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "AlexBabetov/01-zhivoi-urok-constructor";

  if (!token) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "GITHUB_TOKEN не задан в переменных окружения Netlify" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Неверный JSON в запросе" }) };
  }

  const { lesson, meta } = body;

  if (!lesson || !meta?.subject || !meta?.grade || !meta?.topic) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "Обязательные поля: lesson, meta.subject, meta.grade, meta.topic" }),
    };
  }

  // Перезаписываем автора из верифицированного JWT — не доверяем клиентским данным
  meta.author_id = verifiedUser.id;
  meta.author_email = verifiedUser.email;

  // ── Построение пути файла ─────────────────────────────
  const subjectSlug = meta.subject
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-я0-9-]/g, "");
  const topicSlug = meta.topic
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-я0-9-]/g, "")
    .slice(0, 40);

  const lessonNum = meta.lesson_num || 0;
  const filename = `${lessonNum}_${topicSlug}.json`;
  // CRA: public/ → build/ on deploy, must write to public/lessons/ for static serving
  const filePath = `public/lessons/${subjectSlug}/${meta.grade}/${filename}`;
  const indexPath = `public/lessons/index.json`;
  const savedAt = new Date().toISOString();
  // ID включает topicSlug чтобы избежать коллизий при одинаковом lesson_num для разных тем
  const id = `${subjectSlug}-${meta.grade}-${lessonNum}-${topicSlug.slice(0, 20)}`;

  // ── GitHub API helpers ────────────────────────────────
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  const apiBase = `https://api.github.com/repos/${repo}/contents`;

  async function getFile(path) {
    const resp = await fetch(`${apiBase}/${path}`, { headers: ghHeaders });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub GET ${path}: ${resp.status} — ${err.message || resp.statusText}`);
    }
    const json = await resp.json();
    const content = Buffer.from(json.content, "base64").toString("utf-8");
    return { content, sha: json.sha };
  }

  async function putFile(path, content, sha, message) {
    const payload = {
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch: "main",
    };
    if (sha) payload.sha = sha;
    const resp = await fetch(`${apiBase}/${path}`, {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub PUT ${path}: ${resp.status} — ${err.message || resp.statusText}`);
    }
    return await resp.json();
  }

  // ── Основная логика ───────────────────────────────────
  try {
    // 1. Сохранить файл урока
    const lessonContent = JSON.stringify(
      { meta, lesson, saved_at: savedAt },
      null,
      2
    );
    const existingLesson = await getFile(filePath);
    await putFile(
      filePath,
      lessonContent,
      existingLesson?.sha || null,
      `Урок: ${meta.subject} ${meta.grade} кл. №${lessonNum} — «${meta.topic}»`
    );

    // 2. Обновить index.json
    const indexEntry = {
      id,
      subject: meta.subject,
      grade: meta.grade,
      lesson_num: lessonNum,
      topic: meta.topic,
      model: meta.model || "",
      saved_at: savedAt,
      filename: `${subjectSlug}/${meta.grade}/${filename}`,
      author_id: meta.author_id || null,
      author_email: meta.author_email || null,
    };

    const existingIndex = await getFile(indexPath);
    let indexArr = [];
    if (existingIndex) {
      try {
        indexArr = JSON.parse(existingIndex.content);
      } catch {
        indexArr = [];
      }
    }
    // Upsert: убираем старую запись с тем же id
    indexArr = indexArr.filter((e) => e.id !== id);
    indexArr.unshift(indexEntry); // свежие сверху

    await putFile(
      indexPath,
      JSON.stringify(indexArr, null, 2),
      existingIndex?.sha || null,
      `Индекс: ${meta.subject} ${meta.grade}/${lessonNum} — «${meta.topic}»`
    );

    console.log(`[save-lesson] OK: ${filePath} (${indexArr.length} в индексе)`);

    // Логируем событие сохранения в Supabase (supabaseUrl/supabaseServiceKey объявлены выше)
    if (supabaseUrl && supabaseServiceKey && meta.author_email) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/lesson_events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            user_id: meta.author_id || null,
            user_email: meta.author_email,
            event_type: "saved",
            subject: meta.subject,
            grade: meta.grade,
            lesson_title: meta.topic,
            lesson_id: id,
          }),
        });
      } catch (e) {
        console.warn("[save-lesson] Supabase log error:", e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        id,
        url: `https://github.com/${repo}/blob/main/${filePath}`,
        filename: filePath,
        total: indexArr.length,
      }),
    };
  } catch (err) {
    console.error("[save-lesson] ERROR:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Ошибка сохранения: " + err.message }),
    };
  }
};
