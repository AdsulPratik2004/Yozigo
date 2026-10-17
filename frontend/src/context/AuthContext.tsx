import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("access_token")
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem("refresh_token")
  );
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const login = (accessToken: string, newRefreshToken: string, u: User) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", newRefreshToken);
    localStorage.setItem("user", JSON.stringify(u));
    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  // Migrate old token format to new format
  useEffect(() => {
    const oldToken = localStorage.getItem("token");
    if (oldToken && !token) {
      localStorage.setItem("access_token", oldToken);
      localStorage.removeItem("token");
      setToken(oldToken);
    }
  }, [token]);

  // Listen for token refresh events from API client
  useEffect(() => {
    const handleTokenRefreshed = (event: CustomEvent) => {
      const { access_token, refresh_token } = event.detail;
      setToken(access_token);
      setRefreshToken(refresh_token);
    };

    window.addEventListener('tokenRefreshed', handleTokenRefreshed as EventListener);
    return () => {
      window.removeEventListener('tokenRefreshed', handleTokenRefreshed as EventListener);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isAuthenticated: !!token,
        isAdmin: user?.role === "admin",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
