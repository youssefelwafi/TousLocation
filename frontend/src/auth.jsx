import { createContext, useContext, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email, password) {
    const { data } = await api.post("/connexion", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  // Inscription d'un client rattaché à une boutique.
  async function registerClient(payload) {
    const { data } = await api.post("/inscription-client", payload);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await api.post("/deconnexion");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, registerClient, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Helpers de rôle (cohérents avec le backend).
export const isSuperAdmin = (u) => u?.role === "admin";
export const isStaff = (u) => ["admin", "manager", "employee"].includes(u?.role);
export const isManager = (u) => u?.role === "manager";
export const isClient = (u) => u?.role === "client";

// Un employé n'accède qu'aux modules cochés ; admin/manager : tout.
export const hasModule = (u, key) => {
  if (u?.role === "admin" || u?.role === "manager") return true;
  if (u?.role === "employee") return (u.permissions || []).includes(key);
  return false;
};

// Page d'accueil selon le rôle.
export const homeFor = (u) => (u?.role === "client" ? "/magasin" : "/tableau-de-bord");
