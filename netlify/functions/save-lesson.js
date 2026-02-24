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
  "Access-Control-Allow-Headers": "Content-Type",
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
  const filePath = `lessons/${subjectSlug}/${meta.grade}/${filename}`;
  const indexPath = `lessons/index.json`;
  const savedAt = new Date().toISOString();
  const id = `${subjectSlug}-${meta.grade}-${lessonNum}`;

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
      filename: filePath.replace("lessons/", ""),
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
