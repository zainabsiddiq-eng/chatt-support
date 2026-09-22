import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi, chatApi, createChatSocket } from "../api/client";

function displayName(u) {
  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return name || u.email;
}

function initials(u) {
  const name = displayName(u);
  return name.slice(0, 2).toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatError(data) {
  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(" ");
  if (data.detail) return String(data.detail);
  if (data.non_field_errors) return [].concat(data.non_field_errors).join(" ");
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${[].concat(v).join(" ")}`)
    .join(" · ");
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(formatError(err.data));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <p className="brand">Chatly</p>
        <h1>Welcome back</h1>
        <p className="lede">Sign in to pick up your conversations.</p>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    role: "employee",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi
      .roles()
      .then((r) => {
        setRoles(r);
        if (r.length && !r.includes(form.role)) {
          setForm((f) => ({ ...f, role: r[0] }));
        }
      })
      .catch(() => setRoles(["employee", "manager", "admin"]));
  }, []);

  if (user) return <Navigate to="/" replace />;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(formatError(err.data));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel wide">
        <p className="brand">Chatly</p>
        <h1>Create account</h1>
        <p className="lede">Join and start messaging instantly.</p>
        <form onSubmit={onSubmit} className="auth-form grid-2">
          <label>
            First name
            <input
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
              required
            />
          </label>
          <label>
            Last name
            <input
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
              required
            />
          </label>
          <label className="span-2">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={form.confirm_password}
              onChange={(e) => setField("confirm_password", e.target.value)}
              required
            />
          </label>
          {error && <p className="form-error span-2">{error}</p>}
          <button type="submit" className="span-2" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function ChatPage() {
  const { user, logout, booting } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("offline");
  const [error, setError] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) || null,
    [users, selectedId]
  );

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => u.id !== user?.id)
      .filter((u) => {
        if (!q) return true;
        return (
          displayName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      });
  }, [users, user, search]);

  useEffect(() => {
    if (!user) return;
    authApi
      .users()
      .then(setUsers)
      .catch((err) => setError(formatError(err.data)));
  }, [user]);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!user) return;

    const socket = createChatSocket(
      (data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        if (!(data.type === "chat.message" || data.id)) return;

        const peerId = selectedIdRef.current;
        if (!peerId) return;
        if (data.sender !== peerId && data.receiver !== peerId) return;

        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      },
      setStatus
    );

    socketRef.current = socket;
    return () => socket.close();
  }, [user]);

  useEffect(() => {
    if (!selectedId || !user) {
      setMessages([]);
      return;
    }

    setLoadingHistory(true);
    setError("");
    chatApi
      .history(selectedId)
      .then(setMessages)
      .catch((err) => setError(formatError(err.data)))
      .finally(() => setLoadingHistory(false));
  }, [selectedId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedId]);

  if (booting) {
    return (
      <div className="boot-screen">
        <p className="brand">Chatly</p>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  function sendMessage(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId) return;

    const ok = socketRef.current?.send({
      receiver: selectedId,
      content,
    });

    if (!ok) {
      setError("Not connected. Wait for WebSocket to reconnect.");
      return;
    }

    setDraft("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar-top">
          <div>
            <p className="brand compact">Chatly</p>
            <p className="me-line">{displayName(user)}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </header>

        <div className="status-row">
          <span className={`dot ${status}`} />
          {status === "online"
            ? "Live"
            : status === "connecting"
              ? "Connecting…"
              : "Offline"}
        </div>

        <input
          className="search"
          placeholder="Search people"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ul className="contact-list">
          {contacts.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className={u.id === selectedId ? "active" : ""}
                onClick={() => setSelectedId(u.id)}
              >
                <span className="avatar">{initials(u)}</span>
                <span className="meta">
                  <strong>{displayName(u)}</strong>
                  <small>{u.email}</small>
                </span>
              </button>
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="empty">No other users found.</li>
          )}
        </ul>
      </aside>

      <main className="chat-pane">
        {!selected ? (
          <div className="chat-empty">
            <p className="brand">Chatly</p>
            <h2>Select a conversation</h2>
            <p>Choose someone from the left to start chatting in real time.</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <span className="avatar">{initials(selected)}</span>
              <div>
                <strong>{displayName(selected)}</strong>
                <small>{selected.email}</small>
              </div>
            </header>

            <div className="messages">
              {loadingHistory && <p className="hint">Loading messages…</p>}
              {!loadingHistory && messages.length === 0 && (
                <p className="hint">No messages yet. Say hello.</p>
              )}
              {messages.map((m) => {
                const mine = m.sender === user.id;
                return (
                  <div
                    key={m.id}
                    className={`bubble ${mine ? "mine" : "theirs"}`}
                  >
                    <p>{m.content}</p>
                    <time>{formatTime(m.created_at)}</time>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && <p className="banner-error">{error}</p>}

            <form className="composer" onSubmit={sendMessage}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${displayName(selected)}`}
              />
              <button type="submit" disabled={!draft.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
