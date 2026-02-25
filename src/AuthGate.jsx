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
    // Check status after login
    const status = data.user?.user_metadata?.status;
    if (status === "pending") {
      // Will be handled by AuthGate
    } else if (status === "rejected") {
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

    // 1. Регистрация в Supabase
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role: "teacher",
          status: "pending",
          name: form.name,
          school: form.school,
          city: form.city,
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

    // 2. Выходим сразу (статус pending — войти всё равно нельзя)
    await supabase.auth.signOut();

    // 3. Уведомляем администратора
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
    } catch (_) {
      // не критично — заявка уже сохранена в Supabase
    }

    setSuccess(true);
    setLoading(false);
  };

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
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 20, textAlign: "center" }}>
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
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 28 }}>
          Вы получите письмо на <b>{user?.email}</b>, когда заявка будет одобрена.
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

// ─── Auth Gate ─────────────────────────────────────────────────────────────────
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [mode, setMode] = useState("login"); // "login" | "register"

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    if (mode === "register") {
      return <RegisterForm onSwitchToLogin={() => setMode("login")} />;
    }
    return <LoginForm onSwitchToRegister={() => setMode("register")} />;
  }

  // Logged in — check status
  const meta = session.user?.user_metadata || {};
  const status = meta.status;
  const role = meta.role;

  // Admin always has access (no status check)
  if (role === "admin") return children(session.user);

  // Teacher: check status
  if (status === "pending") return <PendingScreen user={session.user} />;
  if (status === "rejected") return <RejectedScreen user={session.user} />;

  // approved (or legacy users without status)
  return children(session.user);
}
