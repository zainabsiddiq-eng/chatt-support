const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000";

function getAccess() {
  return localStorage.getItem("access");
}

function getRefresh() {
  return localStorage.getItem("refresh");
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
}

export function saveUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function loadUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

async function refreshAccess() {
  const refresh = getRefresh();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  setTokens({ access: data.access });
  return data.access;
}

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  let access = getAccess();
  if (access) headers.Authorization = `Bearer ${access}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && getRefresh()) {
    access = await refreshAccess();
    if (access) {
      headers.Authorization = `Bearer ${access}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = new Error("Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const authApi = {
  login: (body) =>
    api("/api/auth/login/", { method: "POST", body: JSON.stringify(body) }),
  register: (body) =>
    api("/api/auth/register/", { method: "POST", body: JSON.stringify(body) }),
  me: () => api("/api/auth/me/"),
  users: () => api("/api/auth/users/"),
  roles: () => api("/api/auth/roles/"),
};

export const chatApi = {
  history: (userId) => api(`/api/chat/messages/history/?user=${userId}`),
  send: (body) =>
    api("/api/chat/messages/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export function createChatSocket(onMessage, onStatus) {
  let ws = null;
  let closedByUser = false;
  let retry = 0;
  let timer = null;

  const connect = () => {
    const token = getAccess();
    if (!token) {
      onStatus?.("offline");
      return;
    }

    onStatus?.("connecting");
    ws = new WebSocket(`${WS_BASE}/ws/chat/?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      retry = 0;
      onStatus?.("online");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      onStatus?.("offline");
      if (!closedByUser) {
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        timer = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  return {
    send(payload) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    close() {
      closedByUser = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}

export { API_BASE, WS_BASE };
