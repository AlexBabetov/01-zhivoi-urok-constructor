---
status: active
created: 2026-02-22
updated: 2026-02-26
owner: babetov_aa@koriphey.ru
tags: [setup, ops]
---

# Подключение GitHub → Netlify: пошаговая инструкция

## Что нужно сделать один раз

### Шаг 1: Создать репозиторий на GitHub

1. Открыть https://github.com/koriphey-org
2. Нажать **New repository**
3. Имя: `01-zhivoi-urok-constructor`
4. Описание: `Конструктор урока «Живой урок 360»`
5. Видимость: **Private** (пока на этапе разработки)
6. **Не** ставить галочки на README / .gitignore — файлы уже есть
7. Нажать **Create repository**

### Шаг 2: Загрузить код в репозиторий

Используй **GitHub Desktop** (как описано в roadmap):

```
1. File > Add Local Repository
2. Выбрать папку 01-zhivoi-urok-constructor
   (из папки koriphey-org на своём компьютере)
3. Если спросит "Init git repo?" — нажать Yes
4. Commit to main: "feat: initial commit v2.5"
5. Publish repository > выбрать koriphey-org
```

Или через терминал:
```bash
cd путь/к/01-zhivoi-urok-constructor
git init
git add .
git commit -m "feat: конструктор ЖУ360 v2.5 — миграция на GitHub"
git branch -M main
git remote add origin https://github.com/koriphey-org/01-zhivoi-urok-constructor.git
git push -u origin main
```

### Шаг 3: Подключить Netlify к GitHub

1. Открыть https://app.netlify.com
2. Перейти на сайт `constructor-zhivoi-urok`
3. **Site configuration** > **Build & deploy** > **Continuous deployment**
4. Нажать **Link to Git repository**
5. Выбрать **GitHub** > авторизовать если нужно
6. Выбрать `koriphey-org` > найти `01-zhivoi-urok-constructor`
7. Настройки сборки:
   - **Branch:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
8. Нажать **Deploy site**

### Шаг 4: Добавить API ключ в Netlify

1. **Site configuration** > **Environment variables**
2. Нажать **Add a variable**
3. Key: `ANTHROPIC_API_KEY`
4. Value: твой ключ из https://console.anthropic.com/keys
5. Scope: **All scopes**
6. Нажать **Save**
7. Сделать **Trigger deploy** чтобы применить

### Шаг 5: Обновить вызов API в App.jsx

В файле `src/App.jsx` найти функцию `generateLesson` и заменить
прямой вызов `https://api.anthropic.com/v1/messages` на:

```javascript
response = await fetch("/api/generate-lesson", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    system: sysPrompt,
    userMessage: userMsg,
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000
  })
});
```

После этого: `git add src/App.jsx && git commit -m "fix: API через Netlify Function" && git push`
Netlify автоматически задеплоит обновление.

---

## Ежедневный процесс (после настройки)

```
1. PULL  — GitHub Desktop: Fetch origin
2. EDIT  — Редактировать файлы
3. PUSH  — Commit to main → Push origin
         → Netlify автоматически деплоит за ~1-2 мин
```

## Проверка что всё работает

После деплоя убедись:
- [ ] https://constructor-zhivoi-urok.netlify.app открывается
- [ ] Генерация урока работает (тест: Русский язык, 2 класс, Части речи)
- [ ] В Netlify > Functions виден `generate-lesson`
- [ ] В Netlify > Deploys нет ошибок сборки

## Если что-то пошло не так

**Ошибка сборки:** Проверить вкладку Deploys > кликнуть на деплой > смотреть логи
**API не работает:** Проверить Environment variables, сделать Trigger deploy
**Функция не находится:** Проверить что `netlify.toml` содержит правильный путь к functions
