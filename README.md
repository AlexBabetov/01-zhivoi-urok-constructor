# Конструктор урока «Живой урок 360»

Веб-приложение для проектирования уроков по методологии ЖУ360.
Учитель вводит класс + предмет + тема → AI генерирует готовый сценарий.

**Продакшн:** https://constructor-zhivoi-urok.netlify.app
**Организация:** https://github.com/koriphey-org

---

## Быстрый старт

```bash
npm install
npm start          # localhost:3000 (React)
netlify dev        # localhost:8888 (React + Functions вместе)
```

## Структура

```
01-zhivoi-urok-constructor/
├── src/
│   └── App.jsx                    ← Весь React UI (4 шага)
├── netlify/
│   └── functions/
│       └── generate-lesson.js     ← Прокси к Claude API
├── public/
│   └── index.html
├── netlify.toml                   ← Конфиг сборки и функций
├── package.json
└── .gitignore
```

## Переменные окружения

Задать в Netlify > Site settings > Environment variables:

| Переменная | Описание |
|-----------|---------|
| `ANTHROPIC_API_KEY` | Ключ Claude API (Anthropic Console) |

⚠️ **Никогда не коммитить `.env` файлы в репозиторий!**

## Как вызвать функцию из React

В `src/App.jsx` замени прямой вызов `api.anthropic.com` на:

```javascript
const response = await fetch("/api/generate-lesson", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    system: systemPrompt,
    userMessage: userMsg,
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000
  })
});
```

## Деплой

**Автоматически:** push в `main` → Netlify пересобирает и деплоит.

```bash
git add .
git commit -m "feat: описание изменений"
git push origin main
```

## Версии

| Версия | Дата | Изменения |
|--------|------|-----------|
| v2.5 | Фев 2026 | Текущая версия, миграция на GitHub |
| v2.0 | Янв 2026 | Кори v2, 3 захвата, двойная рефлексия |
| v1.0 | Дек 2025 | MVP: 4 шага, базовый промпт |

## Технологии

- **Frontend:** React 18 (CRA)
- **Hosting:** Netlify
- **AI:** Claude Haiku 4.5 (продакшн), Sonnet 4 (прототип)
- **Functions:** Netlify Functions (Node.js, esbuild)
- **Методология:** Живой урок 360 v5.1

## Связанные репозитории

- [`00-koriphey-knowledge-base`](../00-koriphey-knowledge-base) — методология, эталоны, база знаний
- [`02-zhivoi-urok-methodology`](../02-zhivoi-urok-methodology) — промпты и библиотека уроков
- [`03-pilot-russian-2grade`](../03-pilot-russian-2grade) — пилот: Русский язык 2 класс
