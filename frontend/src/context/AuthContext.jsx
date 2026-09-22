import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  authApi,
  clearTokens,
  loadUser,
  saveUser,
  setTokens,
} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadUser());
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const access = localStorage.getItem("access");
    if (!access) {
      setBooting(false);
      return;
    }

    authApi
      .me()
      .then((me) => {
        saveUser(me);
        setUser(me);
      })
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      async login(email, password) {
        const data = await authApi.login({ email, password });
        setTokens({ access: data.access, refresh: data.refresh });
        saveUser(data.user);
        setUser(data.user);
        return data.user;
      },
      async register(payload) {
        await authApi.register(payload);
      },
      logout() {
        clearTokens();
        setUser(null);
      },
    }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
