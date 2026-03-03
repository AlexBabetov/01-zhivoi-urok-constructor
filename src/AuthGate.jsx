import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

// ─── Shared styles ─────────────────────────────────────────────────────────────
const CARD = {
  background: "#fff",
  borderRadius: 20,
  padding: "40px 36px",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};

const BG = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f2027 0%, #1a3a4a 50%, #1e3a5f 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  padding: "20px",
};

const INPUT = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const LABEL = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

// ─── Helper ──────────────────────────────────────────────────────────────────
const TRUSTED_DOMAINS = ["koriphey.ru", "koriphey.online"];

function getStatusForEmail(email) {
  const domain = email?.split("@")[1]?.toLowerCase() || "";
  return TRUSTED_DOMAINS.includes(domain) ? "approved" : "pending";
}

// ─── Shared components ────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LABEL}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        style={INPUT}
        onFocus={e => (e.target.style.borderColor = "#1e3a5f")}
        onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
      />
    </div>
  );
}

function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>🎓</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a5f", letterSpacing: -0.5 }}>
        Живой урок 360
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
        Конструктор уроков · Корифей
      </div>
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 13,
      color: "#dc2626",
      marginBottom: 14,
    }}>
      ⚠️ {msg}
    </div>
  );
}

function SubmitBtn({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        padding: "13px",
        background: loading ? "#94a3b8" : "#1e3a5f",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        transition: "background 0.15s",
        marginTop: 8,
      }}
    >
      {children}
    </button>
  );
}

// OAuth через Google — временно отключён (Sprint 4)
// function OAuthButtons(...) { ... }

// ─── Login Form ─────────────────────────────────────────────────────────────────
function LoginForm({ onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Неверный email или пароль"
        : error.message);
      setLoading(false);
      return;
    }
    const status = data.user?.user_metadata?.status;
    if (status === "rejected") {
      await supabase.auth.signOut();
      setError("Ваша заявка на регистрацию была отклонена. Обратитесь к администратору.");
    }
    setLoading(false);
  };

  return (
    <div style={BG}>
      <div style={CARD}>
        <Logo />
        <form onSubmit={handleLogin}>
          <Field label="Email" type="email" value={email} onChange={setEmail}
            placeholder="teacher@school.ru" required />
          <Field label="Пароль" type="password" value={password} onChange={setPassword}
            placeholder="••••••••" required />
          <ErrorBox msg={error} />
          <SubmitBtn loading={loading}>{loading ? "Входим..." : "Войти"}</SubmitBtn>
        </form>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={onSwitchToRegister}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "#1e3a5f", fontWeight: 600, textDecoration: "underline",
            }}
          >
            Подать заявку на регистрацию →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Register Form ──────────────────────────────────────────────────────────────
function RegisterForm({ onSwitchToLogin }) {
  const [form, setForm] = useState({
    name: "", email: "", password: "", password2: "", school: "", city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (form.password !== form.password2) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    const emailDomain = form.email.split("@")[1]?.toLowerCase() || "";
    const isTrusted = TRUSTED_DOMAINS.includes(emailDomain);
    const initialStatus = isTrusted ? "approved" : "pending";

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role: "teacher",
          status: initialStatus,
          name: form.name,
          school: form.school,
          city: form.city,
          provider: "email",
        },
      },
    });

    if (signUpError) {
      const msg = signUpError.message.includes("already registered")
        ? "Этот email уже зарегистрирован"
        : signUpError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    if (!isTrusted) {
      await supabase.auth.signOut();
      try {
        await fetch("/.netlify/functions/notify-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            school: form.school,
            city: form.city,
          }),
        });
      } catch (_) { /* не критично */ }
    }

    setSuccess(isTrusted ? "trusted" : "pending");
    setLoading(false);
  };

  if (success === "trusted") {
    return (
      <div style={BG}>
        <div style={{ ...CARD, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 12 }}>
            Добро пожаловать!
          </div>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 24 }}>
            Аккаунт создан. Войдите с вашим email и паролем — доступ открыт сразу!
          </p>
          <button
            onClick={onSwitchToLogin}
            style={{
              background: "#1e3a5f", color: "#fff", border: "none",
              borderRadius: 10, padding: "11px 24px", fontSize: 14,
              fontWeight: 700, cursor: "pointer",
            }}
          >
            Войти →
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={BG}>
        <div style={{ ...CARD, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 12 }}>
            Заявка отправлена!
          </div>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 24 }}>
            Ваша заявка на доступ к Конструктору уроков получена. Администратор
            рассмотрит её и сообщит вам на почту <b>{form.email}</b>.
          </p>
          <button
            onClick={onSwitchToLogin}
            style={{
              background: "#1e3a5f", color: "#fff", border: "none",
              borderRadius: 10, padding: "11px 24px", fontSize: 14,
              fontWeight: 700, cursor: "pointer",
            }}
          >
            ← Вернуться к входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={BG}>
      <div style={{ ...CARD, maxWidth: 460 }}>
        <Logo />
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 16, textAlign: "center" }}>
          Заявка на регистрацию
        </div>
        <form onSubmit={handleRegister}>
          <Field label="Имя и фамилия" value={form.name} onChange={set("name")}
            placeholder="Иванова Мария Петровна" required />
          <Field label="Email" type="email" value={form.email} onChange={set("email")}
            placeholder="teacher@school.ru" required />
          <Field label="Город" value={form.city} onChange={set("city")}
            placeholder="Екатеринбург" required />
          <Field label="Школа" value={form.school} onChange={set("school")}
            placeholder='МАОУ Гимназия №210 "Корифей"' required />
          <Field label="Пароль (мин. 6 символов)" type="password" value={form.password}
            onChange={set("password")} placeholder="••••••••" required />
          <Field label="Повторите пароль" type="password" value={form.password2}
            onChange={set("password2")} placeholder="••••••••" required />
          <ErrorBox msg={error} />
          <SubmitBtn loading={loading}>
            {loading ? "Отправляем заявку..." : "Подать заявку"}
          </SubmitBtn>
        </form>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={onSwitchToLogin}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "#64748b",
            }}
          >
            ← Вернуться к входу
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Screen ─────────────────────────────────────────────────────────────
function PendingScreen({ user }) {
  return (
    <div style={BG}>
      <div style={{ ...CARD, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 12 }}>
          Заявка на рассмотрении
        </div>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 8 }}>
            Ваша заявка ещё не рассмотрена администратором.
          </p>
        {user?.email && (
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 28 }}>
            Вы получите письмо на <b>{user.email}</b>, когда заявка будет одобрена.
          </p>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: "none", border: "1px solid #cbd5e1", borderRadius: 8,
            padding: "9px 20px", fontSize: 13, color: "#64748b", cursor: "pointer",
            marginTop: 8,
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

// ─── Rejected Screen ────────────────────────────────────────────────────────────
function RejectedScreen({ user }) {
  return (
    <div style={BG}>
      <div style={{ ...CARD, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#b91c1c", marginBottom: 12 }}>
          Заявка отклонена
        </div>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 28 }}>
          К сожалению, ваша заявка на доступ была отклонена.
          Обратитесь к администратору для уточнения: <b>info@koriphey.ru</b>
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: "none", border: "1px solid #cbd5e1", borderRadius: 8,
            padding: "9px 20px", fontSize: 13, color: "#64748b", cursor: "pointer",
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────
const ONBOARDING_SLIDES = [
  {
    emoji: "⚡",
    title: "Урок за 30 секунд",
    text: "Введи предмет, класс и тему — и получи готовый сценарий по методологии «Живой урок 360». Со структурой, захватами, заданиями и Кори.",
    hint: "Шаг 1 → 2 → 3 → Готово",
  },
  {
    emoji: "📚",
    title: "Библиотека уроков",
    text: "Сохраняй уроки в библиотеку — они останутся навсегда. Открывай в любой момент прямо на уроке с телефона или планшета.",
    hint: "Кнопка «Сохранить урок» после генерации",
  },
  {
    emoji: "🌱",
    title: "Расти после каждого урока",
    text: "После урока заполни 2-минутную рефлексию: как прошёл тайминг, какой была энергия класса. Данные копятся — ты видишь свой рост.",
    hint: "Кнопка «Рефлексия» в карточке урока",
  },
];

function OnboardingModal({ onDone }) {
  const [slide, setSlide] = useState(0);
  const current = ONBOARDING_SLIDES[slide];
  const isLast = slide === ONBOARDING_SLIDES.length - 1;

  const handleDone = async () => {
    try {
      await supabase.auth.updateUser({ data: { onboarding_done: true } });
    } catch (_) { /* не критично */ }
    onDone();
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 3000, padding: 20,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20,
        padding: "40px 36px", width: "100%", maxWidth: 400,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        textAlign: "center",
      }}>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === slide ? 20 : 8, height: 8,
              borderRadius: 4,
              background: i === slide ? "#1e3a5f" : "#e2e8f0",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        <div style={{ fontSize: 52, marginBottom: 16 }}>{current.emoji}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 12 }}>
          {current.title}
        </div>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, marginBottom: 12 }}>
          {current.text}
        </p>
        <div style={{
          display: "inline-block",
          background: "#f1f5f9", borderRadius: 8,
          padding: "6px 12px", fontSize: 12, color: "#64748b",
          marginBottom: 28,
        }}>
          {current.hint}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleDone}
            style={{
              flex: 1, padding: "10px",
              background: "none", border: "1px solid #e2e8f0",
              borderRadius: 10, fontSize: 13, color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            Пропустить
          </button>
          <button
            onClick={isLast ? handleDone : () => setSlide(s => s + 1)}
            style={{
              flex: 2, padding: "10px",
              background: "#1e3a5f", border: "none",
              borderRadius: 10, fontSize: 14, fontWeight: 700,
              color: "#fff", cursor: "pointer",
            }}
          >
            {isLast ? "Создать первый урок →" : "Далее →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Guest Banner ──────────────────────────────────────────────────────────────
function GuestBanner({ onLogin }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      background: "linear-gradient(135deg, #1e3a5f, #1a3a4a)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: "10px 20px",
      zIndex: 1000,
      fontSize: 13,
      boxShadow: "0 -2px 12px rgba(0,0,0,0.2)",
    }}>
      <span>🎓 Тестовый режим — уроки не сохраняются</span>
      <button
        onClick={onLogin}
        style={{
          background: "#fff",
          color: "#1e3a5f",
          border: "none",
          borderRadius: 8,
          padding: "6px 16px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Войти →
      </button>
    </div>
  );
}

// ─── Login Modal ───────────────────────────────────────────────────────────────
function LoginModal({ onClose }) {
  const [mode, setMode] = useState("login");
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460 }}>
        {mode === "register"
          ? <RegisterForm onSwitchToLogin={() => setMode("login")} />
          : <LoginForm onSwitchToRegister={() => setMode("register")} />
        }
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "#fff",
              fontSize: 13, cursor: "pointer", opacity: 0.7,
            }}
          >
            ✕ Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Gate ─────────────────────────────────────────────────────────────────
// AUTH_REQUIRED=false: приложение доступно без входа (тестовый режим).
const AUTH_REQUIRED = false;

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const meta = session.user?.user_metadata || {};

        // Первый вход через OAuth (нет role — новый пользователь)
        if (!meta.role) {
          const email = session.user.email;
          const status = email ? getStatusForEmail(email) : "pending";
          const provider = session.user.app_metadata?.provider || "email";
          const name = meta.full_name
            || `${meta.given_name || ""} ${meta.family_name || ""}`.trim()
            || meta.name
            || "";

          try {
            await supabase.auth.updateUser({
              data: {
                role: "teacher",
                status,
                name,
                avatar_url: meta.picture || meta.avatar_url || null,
                provider,
              },
            });
            // После updateUser сработает ещё один SIGNED_IN — он подхватит обновлённые данные
            return;
          } catch (e) {
            console.warn("[AuthGate] Failed to set initial metadata:", e.message);
          }
        }

        // Показать онбординг при первом одобренном входе
        const isApproved = meta.role === "admin" || meta.status === "approved";
        const onboardingDone = meta.onboarding_done;
        const hasLessons = Boolean(localStorage.getItem("zh360_lessons"));
        if (isApproved && !onboardingDone && !hasLessons) {
          setShowOnboarding(true);
        }
      }

      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading
  if (session === undefined) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f8fafc", fontSize: 14, color: "#64748b",
      }}>
        ⏳ Загрузка...
      </div>
    );
  }

  // Not logged in
  if (!session) {
    if (AUTH_REQUIRED) {
      return (
        <div style={BG}>
          {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
          <LoginForm onSwitchToRegister={() => setShowLoginModal(true)} />
        </div>
      );
    }
    return (
      <>
        <div style={{ paddingBottom: 80 }}>
          {children(null)}
        </div>
        <GuestBanner onLogin={() => setShowLoginModal(true)} />
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      </>
    );
  }

  // Logged in — check status
  const meta = session.user?.user_metadata || {};
  const status = meta.status;
  const role = meta.role;

  // Admin always has access
  if (role === "admin") {
    return (
      <>
        {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
        {children(session.user)}
      </>
    );
  }

  // Teacher: check status
  if (status === "pending") return <PendingScreen user={session.user} />;
  if (status === "rejected") return <RejectedScreen user={session.user} />;

  // approved (or legacy without status)
  return (
    <>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      {children(session.user)}
    </>
  );
}
