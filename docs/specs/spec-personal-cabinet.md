# Личный кабинет учителя — Feature Spec

**Фаза:** Sprint 3 (апрель 2026)
**Приоритет:** 🟡 Важно
**Статус:** Draft
**Зависит от:** G-001 (JWT-верификация), G-002 (пилот завершён)
**Автор:** babetov_aa@koriphey.ru · 2026-03-02

---

## Контекст: что уже есть

Аутентификация в v2.5 **уже работает** через Supabase Auth:

| Что есть | Детали |
|----------|--------|
| Email + password вход | `LoginForm` в `AuthGate.jsx` |
| Регистрация с заявкой | `RegisterForm`: name, email, password, school, city |
| Авто-одобрение | `@koriphey.ru` и `@koriphey.online` → `status: approved` сразу |
| Ручное одобрение | Сторонние домены → `status: pending` → Admin panel |
| Гостевой режим | `AUTH_REQUIRED = false`, GuestBanner снизу |
| Роли | `admin` (без проверки статуса), `teacher` (pending / approved / rejected) |
| Профиль в шапке | Только email + кнопка «Выйти» |

**Чего нет:** Google OAuth, ВКонтакте OAuth, онбординг после первого входа, страница профиля с настройками и статистикой.

---

## Проблема

Текущий flow регистрации создаёт трение: учитель должен придумать пароль, заполнить форму из 6 полей, дождаться письма с подтверждением email (Supabase по умолчанию), и только потом войти. Для корифеевских учителей, у которых уже есть Google-аккаунт @koriphey.ru, это избыточно. У большинства российских учителей активный аккаунт ВКонтакте — вход через ВК снижает барьер ещё больше (не нужен Google аккаунт).

После входа учитель попадает сразу в конструктор без объяснения как им пользоваться — нет онбординга. Нет страницы профиля, где можно увидеть свою статистику или изменить данные о школе.

**Затронутые роли:** учитель, admin (меньше ручного одобрения).

---

## Решение

Добавить вход через Google и ВКонтакте как основные способы. Оставить email/password как запасной вариант. Расположение кнопок: Google → ВКонтакте → разделитель «или» → форма email/password. После первого входа показать онбординг-экран (3 шага, < 1 минуты). Добавить «Профиль» — панель с базовыми данными и статистикой учителя.

---

## User Stories

- Как **учитель Корифей**, я хочу войти одной кнопкой «Войти через Google», чтобы не создавать отдельный пароль
- Как **учитель**, я хочу войти через ВКонтакте, потому что это привычнее и не требует Google аккаунта
- Как **учитель Корифей**, я хочу получить доступ сразу после входа через @koriphey.ru Google, без ожидания одобрения
- Как **учитель ВКонтакте**, я хочу понять почему меня отправили на модерацию, чтобы знать что делать дальше
- Как **учитель впервые**, я хочу увидеть короткий онбординг «Создай первый урок за 5 минут», чтобы не теряться в интерфейсе
- Как **учитель**, я хочу открыть профиль и увидеть сколько уроков я создал и сколько рефлексий заполнил
- Как **учитель**, я хочу изменить имя, школу и город в профиле, чтобы данные были актуальными
- Как **admin**, я хочу чтобы учителя @koriphey.ru регистрировались автоматически, чтобы не одобрять заявки вручную

---

## Требования

### Must Have (MVP — Sprint 3)

**Google OAuth:**
- [ ] Кнопка «Войти через Google» в `LoginForm` (через `supabase.auth.signInWithOAuth({ provider: 'google' })`)
- [ ] После Google OAuth проверять домен email: если `@koriphey.ru` или `@koriphey.online` → `status: approved`, иначе → `status: pending`
- [ ] Если пользователь новый (первый OAuth вход) — создать запись с `role: teacher`, `status` по домену, заполнить `name` из Google profile
- [ ] Если пользователь уже существует (повторный вход) — не перезаписывать метаданные
- [ ] Callback URL настроить в Supabase Dashboard: `https://urok360.koriphey.ru` и `https://v2.koriphey.ru`

**ВКонтакте OAuth:**
- [ ] Кнопка «Войти через ВКонтакте» в `LoginForm` (через `supabase.auth.signInWithOAuth({ provider: 'keycloak' })` — Supabase поддерживает VK напрямую через `provider: 'vk'` начиная с v2 Supabase Auth)
- [ ] ⚠️ **Важно: VK не гарантирует email.** Email в VK — необязательное поле. Возможны два случая:
  - Email получен и `@koriphey.ru`/`@koriphey.online` → `status: approved`
  - Email получен, другой домен → `status: pending`
  - Email **не получен** (VK вернул пустой email) → `status: pending`, показать экран с подсказкой
- [ ] При входе без email — показывать `PendingScreen` с пояснением: «Мы не смогли получить ваш email из ВКонтакте. Если вы учитель Корифея, обратитесь к администратору: info@koriphey.ru»
- [ ] Имя пользователя брать из VK profile (`first_name + last_name`)
- [ ] Аватар из VK (`photo_100` поле) сохранять в `user_metadata.avatar_url`
- [ ] Настройка VK App: создать приложение на vk.com/apps → тип «Веб-сайт», получить App ID и Secure key
- [ ] В Supabase Dashboard → Authentication → Providers → VK: вставить App ID и Secure key
- [ ] Redirect URI в VK App: `https://<project>.supabase.co/auth/v1/callback`

**Онбординг после первого входа:**
- [ ] Определять «первый вход» по флагу `user_metadata.onboarding_done` (отсутствует = первый)
- [ ] Показать `OnboardingModal` поверх приложения (3 слайда, можно пропустить)
  - Слайд 1: «Введи класс + предмет + тема → получи урок за 30 сек» (иллюстрация шагов 1→4)
  - Слайд 2: «Сохрани урок в библиотеку — он останется навсегда»
  - Слайд 3: «После урока заполни рефлексию — 2 минуты, чтобы расти»
- [ ] Кнопки «Далее» / «Создать первый урок» (на последнем слайде) / «Пропустить»
- [ ] При закрытии или завершении — установить `user_metadata.onboarding_done: true` через `supabase.auth.updateUser`
- [ ] Онбординг не показывается повторно

**Панель «Профиль»:**
- [ ] Открывается кликом на email/имя в шапке (заменить текущий `👤 {user.email}`)
- [ ] Реализовать как drawer или modal (справа или по центру, max-width 400px)
- [ ] Показывать: имя, email, школа, город, роль, статус, дата регистрации
- [ ] Статистика (из localStorage + Supabase): кол-во уроков в библиотеке, кол-во рефлексий
- [ ] Форма редактирования: имя, школа, город (email и роль — не редактируются)
- [ ] Кнопка «Сохранить» → `supabase.auth.updateUser({ data: { name, school, city } })`
- [ ] Кнопка «Выйти» перенесена в профиль (убрать из шапки)

### Should Have (Sprint 3, если успеем)

- [ ] Аватар из Google или VK — показывать в шапке вместо иконки 👤 (из `user_metadata.avatar_url`)
- [ ] В профиле: индикатор «вошли через Google / ВКонтакте / email»
- [ ] В профиле: список последних 3 уроков с датой и ссылкой «открыть»
- [ ] В профиле: «ваши рефлексии» — краткая сводка (средний рейтинг, последняя дата)
- [ ] Toast-уведомление «Профиль обновлён» после сохранения

### Won't Have (v1)

- Смена пароля через профиль (есть сброс через email от Supabase)
- Уведомления по email о новых уроках
- Публичная страница профиля учителя
- Загрузка собственного аватара
- Настройки уведомлений
- Привязка нескольких способов входа к одному аккаунту (merge OAuth + password)
- Telegram OAuth (рассмотреть в Sprint 4)

---

## Технические детали

### Google OAuth — настройка Supabase

```
Supabase Dashboard → Authentication → Providers → Google
  Client ID:     [из Google Cloud Console]
  Client Secret: [из Google Cloud Console]
  Redirect URL:  https://<project>.supabase.co/auth/v1/callback

Google Cloud Console → OAuth 2.0 → Authorized redirect URIs:
  https://<project>.supabase.co/auth/v1/callback
```

Authorized JavaScript origins добавить:
- `https://urok360.koriphey.ru`
- `https://v2.koriphey.ru`
- `http://localhost:3000` (для dev)

### ВКонтакте OAuth — настройка

```
1. Создать VK приложение:
   vk.com/apps → Создать приложение → Тип: Веб-сайт
   Название: Живой урок 360 — Конструктор
   Адрес сайта: https://urok360.koriphey.ru
   Base domain: koriphey.ru

2. Настройки VK App:
   Настройки → Адрес переадресации OAuth:
     https://<project>.supabase.co/auth/v1/callback

3. Supabase Dashboard → Authentication → Providers → VK:
   App ID:     [из настроек VK приложения]
   App Secret: [Защищённый ключ из настроек VK]

4. Запрашиваемые права (scope):
   email — для получения email пользователя (пользователь должен подтвердить)
```

⚠️ **Ограничение VK:** VK возвращает `email` только если пользователь явно согласился его передать и email подтверждён в профиле VK. Нельзя полагаться на email для авто-одобрения. Все VK-пользователи по умолчанию попадают в `pending` если нет email @koriphey.ru.

### Изменения в AuthGate.jsx

```jsx
// Новая функция определения статуса для OAuth
function getStatusForEmail(email) {
  const TRUSTED = ["koriphey.ru", "koriphey.online"];
  const domain = email?.split("@")[1]?.toLowerCase() || "";
  return TRUSTED.includes(domain) ? "approved" : "pending";
}

// Обработка первого OAuth входа (в onAuthStateChange)
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session) {
    const meta = session.user.user_metadata;
    // Первый OAuth вход: нет role или status
    if (!meta.role) {
      const status = getStatusForEmail(session.user.email);
      await supabase.auth.updateUser({
        data: {
          role: "teacher",
          status,
          name: meta.full_name || meta.name || "",
          // school и city — заполнит в профиле
        }
      });
    }
  }
  setSession(session);
});
```

### Кнопки OAuth в LoginForm

```jsx
async function handleOAuthLogin(provider) {
  await supabase.auth.signInWithOAuth({
    provider,                              // "google" | "vk"
    options: {
      redirectTo: window.location.origin,
      scopes: provider === "vk" ? "email" : undefined,
    },
  });
}

// В JSX LoginForm — добавить над полями:
<button type="button" onClick={() => handleOAuthLogin("google")} style={GOOGLE_BTN}>
  <img src="/google-icon.svg" width={18} height={18} />
  Войти через Google
</button>
<button type="button" onClick={() => handleOAuthLogin("vk")} style={VK_BTN}>
  <img src="/vk-icon.svg" width={18} height={18} />
  Войти через ВКонтакте
</button>
<Divider label="или" />
// ... существующие поля email/password
```

Стили кнопок:
```js
const GOOGLE_BTN = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", background: "#fff",
  fontSize: 14, fontWeight: 600, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
  color: "#374151",
};
const VK_BTN = {
  ...GOOGLE_BTN,
  background: "#0077FF", color: "#fff",
  border: "none", marginBottom: 16,
};
```

### Новые компоненты (в AuthGate.jsx или ProfileDrawer.jsx)

```
OnboardingModal    — 3-шаговый туториал, управляется флагом onboarding_done
ProfileDrawer      — боковая панель с данными и статистикой учителя
```

### Флаг онбординга

```js
// После завершения онбординга:
await supabase.auth.updateUser({ data: { onboarding_done: true } });

// Проверка в AuthGate после входа:
const needsOnboarding = !session.user.user_metadata?.onboarding_done;
```

### Статистика в профиле

Считается локально (без нового API):
```js
// Уроки — из localStorage
const lessons = JSON.parse(localStorage.getItem("zh360_lessons") || "[]");
const myLessons = lessons.filter(l => l.author_id === user.id);

// Рефлексии — из Supabase (если approved)
const { data: reflections } = await supabase
  .from("reflections")
  .select("id, rating, saved_at")
  .eq("user_id", user.id);
```

### Обработка отсутствующего email у VK-пользователей

```jsx
// В onAuthStateChange, при первом входе через VK:
if (event === "SIGNED_IN" && !meta.role) {
  const email = session.user.email;  // может быть null для VK

  let status = "pending";
  if (email) {
    status = getStatusForEmail(email);
  }
  // Если email нет — пользователь уйдёт на PendingScreen
  // с кастомным сообщением о том, что нужно связаться с admin

  const vkMeta = session.user.user_metadata;
  await supabase.auth.updateUser({
    data: {
      role: "teacher",
      status,
      name: vkMeta.full_name || `${vkMeta.given_name || ""} ${vkMeta.family_name || ""}`.trim(),
      avatar_url: vkMeta.picture || vkMeta.avatar_url || null,
      provider: session.user.app_metadata?.provider || "email",
    }
  });
}
```

Кастомный `PendingScreen` для VK без email:
```jsx
// Добавить prop: noEmail
function PendingScreen({ user, noEmail }) {
  return (
    // ...
    {noEmail && (
      <p style={{ fontSize: 13, color: "#f59e0b", marginBottom: 8 }}>
        ⚠️ ВКонтакте не передал ваш email. Укажите email в настройках профиля ВКонтакте
        или напишите администратору: <b>info@koriphey.ru</b>
      </p>
    )}
    // ...
  );
}
```

### Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `src/AuthGate.jsx` | + Google и VK кнопки, + onAuthStateChange для OAuth, + OnboardingModal, + ProfileDrawer, + PendingScreen noEmail prop |
| `src/App.jsx` | Шапка: `👤 {email}` → кликабельная аватарка/имя, открывающая ProfileDrawer |
| `public/google-icon.svg` | Добавить иконку Google (SVG, ~18px) |
| `public/vk-icon.svg` | Добавить иконку VK (SVG, ~18px, белый логотип для синей кнопки) |
| `supabase/` | Настройка Google + VK provider через Dashboard (не код) |

---

## Критерии приёмки

**Google OAuth:**
- [ ] Кнопка «Войти через Google» видна на экране входа
- [ ] Клик → редирект на Google → возврат в приложение с активной сессией
- [ ] Учитель с @koriphey.ru после OAuth попадает сразу в конструктор (статус approved)
- [ ] Учитель с @gmail.com после OAuth видит экран «Заявка на рассмотрении»
- [ ] Повторный вход через Google не сбрасывает `school`, `city`, `onboarding_done`

**ВКонтакте OAuth:**
- [ ] Кнопка «Войти через ВКонтакте» видна на экране входа (синяя кнопка)
- [ ] Клик → редирект на vk.com → возврат в приложение
- [ ] Если VK вернул email @koriphey.ru → статус `approved`, вход в конструктор
- [ ] Если VK вернул email стороннего домена → статус `pending`, экран ожидания
- [ ] Если VK **не вернул email** → статус `pending`, экран ожидания с подсказкой про email
- [ ] Имя из VK профиля подставляется автоматически
- [ ] Аватар из VK показывается в шапке

**Онбординг:**
- [ ] После первого входа (любым способом) показывается OnboardingModal
- [ ] Кнопка «Пропустить» закрывает и устанавливает `onboarding_done: true`
- [ ] При повторном входе онбординг не показывается

**Профиль:**
- [ ] Клик на имя/email в шапке открывает ProfileDrawer
- [ ] Видны: имя, email, школа, город, кол-во уроков, кол-во рефлексий
- [ ] Изменение имени + школы → «Сохранить» → данные обновлены в Supabase user_metadata
- [ ] Выход из системы работает через кнопку в профиле

**Регрессия:**
- [ ] Вход через email/password по-прежнему работает
- [ ] Гостевой режим (без входа) не сломан
- [ ] Admin panel открывается для admin
- [ ] Сохранение уроков работает для залогиненного учителя
- [ ] Проверка на мобильном устройстве (ProfileDrawer не вылезает за экран)

---

## Метрики успеха

| Метрика | Цель |
|---------|------|
| Время до первого урока после регистрации | < 3 мин (было > 5 с заполнением формы) |
| Доля учителей @koriphey.ru, прошедших OAuth без поддержки | > 90% |
| Ручные одобрения admin для @koriphey.ru | 0 (авто-одобрение) |
| Заполненность профиля (school + city) через неделю | > 70% |
| Онбординг: доля учителей, дошедших до 3-го слайда | > 60% |

---

## Открытые вопросы

1. **Merge аккаунтов.** Если учитель уже зарегистрировался через email и потом входит через Google с тем же адресом — Supabase создаст дубль или смёржит? По умолчанию в Supabase `Allow linking identities` отключено — создастся дубль. Решение: включить в Dashboard → Auth → Settings → «Allow linking identities» или заблокировать OAuth для уже существующих email-аккаунтов с ошибкой.

2. **VK и отсутствие email.** Это основная сложность VK OAuth. Нет email = нет авто-одобрения = нужна ручная модерация. Принятое решение: все VK без email попадают в `pending` + показывается подсказка. Альтернатива (Sprint 4): форма «укажите email вручную» с последующей проверкой домена.

3. **Подтверждение email для новых OAuth-пользователей.** При OAuth Supabase автоматически считает email подтверждённым — это хорошо, ничего дополнительно не нужно.

4. **Onboarding для существующих пользователей.** Показывать ли онбординг тем, кто уже использует конструктор (у кого `onboarding_done` отсутствует, но уже есть уроки)? Рекомендация: не показывать, если в localStorage есть хотя бы 1 урок.

5. **Профиль для гостей.** Гость видит GuestBanner — в нём уже есть кнопка «Войти». ProfileDrawer для гостей не нужен.

6. **VK заблокирован у некоторых учителей.** VK периодически замедляется ТСПУ в отдельных регионах. Это не блокер — Google и email остаются как запасные варианты.

---

## Зависимости и порядок реализации

```
1. Настроить Google OAuth в Supabase + Google Cloud Console     (30 мин)
2. Настроить VK OAuth в Supabase + vk.com/apps                  (30 мин)
3. Добавить кнопки Google + VK в LoginForm → тестировать редирект (2–3 ч)
4. Обработать первый OAuth вход (onAuthStateChange), включая VK без email (1–2 ч)
5. Реализовать OnboardingModal                                   (2–3 ч)
6. Реализовать ProfileDrawer с аватаром + статистикой            (3–4 ч)
7. Обновить шапку App.jsx (аватар + имя вместо email)            (30 мин)
8. Тестирование + регрессия                                      (1–2 ч)
```

**Итого оценка:** 10–15 часов (1.5–2 рабочих дня)
