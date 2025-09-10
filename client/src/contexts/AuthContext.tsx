import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, AuthContextType } from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const getAuthToken = (): string | null => {
    return localStorage.getItem("authToken");
  };

  const checkAuth = useCallback(async (): Promise<void> => {
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUser(result.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userName");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      localStorage.removeItem("authToken");
      localStorage.removeItem("userName");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleLogin = (userData: User): void => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      const token = getAuthToken();
      if (token) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userName");
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    authLoading,
    handleLogin,
    handleLogout,
    getAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
