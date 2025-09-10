import React, { useState, useEffect, useCallback } from "react";
import "./Auth.css";
import { User } from "../types";

interface AuthProps {
  onLogin: (user: User) => void;
}

interface FormData {
  fullName: string;
  password: string;
  confirmPassword: string;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const checkAuth = useCallback(
    async (token: string): Promise<void> => {
      try {
        const response = await fetch("/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          onLogin(result.user);
        } else {
          localStorage.removeItem("authToken");
        }
      } catch (error) {
        localStorage.removeItem("authToken");
      }
    },
    [onLogin]
  );

  useEffect(() => {
    // Перевіряємо, чи користувач вже авторизований
    const token = localStorage.getItem("authToken");
    if (token) {
      checkAuth(token);
    }
  }, [checkAuth]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Валідація для реєстрації
    if (!isLoginMode) {
      if (formData.password !== formData.confirmPassword) {
        setMessage("Паролі не співпадають");
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setMessage("Пароль повинен містити щонайменше 6 символів");
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = isLoginMode ? "/auth/login" : "/auth/register";
      const requestData = isLoginMode
        ? { fullName: formData.fullName, password: formData.password }
        : { fullName: formData.fullName, password: formData.password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok) {
        if (isLoginMode) {
          localStorage.setItem("authToken", result.token);
          localStorage.setItem(
            "userName",
            result.user.fullName || result.user.username || result.user.name
          );
          onLogin(result.user);
        } else {
          // Після успішної реєстрації автоматично логінимо користувача
          setMessage("Реєстрація успішна! Автоматичний вхід...");

          // Автоматично логінимо користувача
          const loginResponse = await fetch("/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fullName: formData.fullName,
              password: formData.password,
            }),
          });

          const loginResult = await loginResponse.json();

          if (loginResponse.ok) {
            localStorage.setItem("authToken", loginResult.token);
            localStorage.setItem(
              "userName",
              loginResult.user.fullName ||
                loginResult.user.username ||
                loginResult.user.name
            );
            onLogin(loginResult.user);
          } else {
            setMessage("Реєстрація успішна! Тепер можете увійти в систему.");
            setTimeout(() => {
              setIsLoginMode(true);
              setFormData({ fullName: "", password: "", confirmPassword: "" });
            }, 2000);
          }
        }
      } else {
        setMessage(result.error);
      }
    } catch (error) {
      setMessage("Помилка: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (): void => {
    setIsLoginMode(!isLoginMode);
    setMessage("");
    setFormData({ fullName: "", password: "", confirmPassword: "" });
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>{isLoginMode ? "Вхід в систему" : "Реєстрація"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Повне ім'я:</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              placeholder={isLoginMode ? undefined : "Наприклад: Іван Іванов"}
              value={formData.fullName}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Підтвердіть пароль:</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? "Завантаження..."
              : isLoginMode
              ? "Увійти"
              : "Зареєструватися"}
          </button>

          <button
            type="button"
            className="toggle-btn"
            onClick={toggleMode}
            disabled={loading}
          >
            {isLoginMode
              ? "Немає аккаунту? Зареєструватися"
              : "Вже є аккаунт? Увійти"}
          </button>

          {message && (
            <div
              className={`message ${
                message.includes("успішн") ? "success" : "error"
              }`}
            >
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Auth;
