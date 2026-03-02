/**
 * Netlify Function: lessons
 * Публичное чтение библиотеки уроков из GitHub (без авторизации).
 *
 * GET /api/lessons               → public/lessons/index.json (массив записей, email скрыт)
 * GET /api/lessons?file=subj/2/  → public/lessons/{file}    (полный JSON урока)
 *
 * Env variables:
 *   GITHUB_TOKEN  — PAT с правами contents:read (опционально, но нужен для rate limit 5000/ч)
 *   GITHUB_REPO   — AlexBabetov/01-zhivoi-urok-constructor
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || "AlexBabetov/01-zhivoi-urok-constructor";
  const apiBase = `https://api.github.com/repos/${repo}/contents`;

  const ghHeaders = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ── Вспомогательная: читает файл из GitHub, возвращает строку или null ──
  async function getFile(path) {
    const resp = await fetch(`${apiBase}/${path}`, { headers: ghHeaders });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub GET ${path}: ${resp.status} — ${err.message || resp.statusText}`);
    }
    const json = await resp.json();
    return Buffer.from(json.content, "base64").toString("utf-8");
  }

  const file = event.queryStringParameters?.file;

  try {
    // ── Режим 2: конкретный файл урока ────────────────────────────────────
    if (file) {
      // Базовая проверка пути — только допустимые символы, никакого ..
      if (!/^[a-zа-я0-9_\-/.]+$/i.test(file) || file.includes("..")) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Недопустимый путь" }) };
      }

      const content = await getFile(`public/lessons/${file}`);
      if (!content) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Урок не найден" }) };
      }

      // Файл уже не содержит author_email (save-lesson.js не пишет его в lesson.json)
      return { statusCode: 200, headers: CORS, body: content };
    }

    // ── Режим 1: индекс уроков ────────────────────────────────────────────
    const content = await getFile("public/lessons/index.json");
    if (!content) {
      // Файл ещё не создан — библиотека пуста
      return { statusCode: 200, headers: CORS, body: JSON.stringify([]) };
    }

    let index = JSON.parse(content);

    // Скрываем email для публичного API — оставляем только author_id (UUID)
    index = index.map(({ author_email: _omit, ...rest }) => rest);

    return { statusCode: 200, headers: CORS, body: JSON.stringify(index) };

  } catch (err) {
    console.error("[lessons] ERROR:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Ошибка чтения библиотеки: " + err.message }),
    };
  }
};
