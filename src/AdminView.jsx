import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

export default function AdminView({ onClose, user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // userId being processed

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/.netlify/functions/list-pending-users", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
      const json = await res.json();
      setUsers(json.users || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleAction = async (u, newStatus) => {
    setActionLoading(u.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/.netlify/functions/update-user-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: u.id,
          status: newStatus,
          userEmail: u.email,
          userName: u.name || u.email,
        }),
      });
      if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
      // Remove from list
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
    setActionLoading(null);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center",
      overflowY: "auto", padding: "32px 16px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f, #1a3a4a)",
          padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
              👥 Заявки на регистрацию
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              Ожидают одобрения: {loading ? "..." : users.length}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
            borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>
            Закрыть ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
              ⏳ Загружаем заявки...
            </div>
          )}

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
              padding: "12px 16px", fontSize: 13, color: "#dc2626",
            }}>
              ⚠️ {error}
              <button onClick={loadPending} style={{
                marginLeft: 12, background: "none", border: "none",
                cursor: "pointer", color: "#1e3a5f", fontWeight: 600, fontSize: 13,
              }}>Повторить</button>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
              ✅ Новых заявок нет
            </div>
          )}

          {!loading && users.map(u => (
            <div key={u.id} style={{
              border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px 20px",
              marginBottom: 12, background: "#f8fafc",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 4 }}>
                    {u.name || "(имя не указано)"}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>
                    📧 {u.email}
                  </div>
                  {u.city && (
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>
                      📍 {u.city}
                    </div>
                  )}
                  {u.school && (
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      🏫 {u.school}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    Подана: {new Date(u.created_at).toLocaleDateString("ru-RU", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleAction(u, "approved")}
                    disabled={actionLoading === u.id}
                    style={{
                      background: "#16a34a", color: "#fff", border: "none",
                      borderRadius: 8, padding: "9px 16px", fontSize: 13,
                      fontWeight: 700, cursor: actionLoading === u.id ? "not-allowed" : "pointer",
                      opacity: actionLoading === u.id ? 0.6 : 1,
                    }}
                  >
                    {actionLoading === u.id ? "..." : "✓ Одобрить"}
                  </button>
                  <button
                    onClick={() => handleAction(u, "rejected")}
                    disabled={actionLoading === u.id}
                    style={{
                      background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5",
                      borderRadius: 8, padding: "9px 16px", fontSize: 13,
                      fontWeight: 700, cursor: actionLoading === u.id ? "not-allowed" : "pointer",
                      opacity: actionLoading === u.id ? 0.6 : 1,
                    }}
                  >
                    ✕ Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
