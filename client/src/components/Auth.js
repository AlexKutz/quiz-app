import React, { useState, useEffect } from "react";
import "./Auth.css";

const Auth = ({ onLogin, onRegister }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    fullName: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Перевіряємо, чи користувач вже авторизований
    const token = localStorage.getItem("authToken");
    if (token) {
      checkAuth(token);
    }
  }, []);

  const checkAuth = async (token) => {
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
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const endpoint = isLoginMode ? "/auth/login" : "/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        if (isLoginMode) {
          localStorage.setItem("authToken", result.token);
          localStorage.setItem(
            "userName",
            result.user.fullName || result.user.username
          );
          onLogin(result.user);
        } else {
          setMessage("Реєстрація успішна! Тепер можете увійти в систему.");
          setTimeout(() => {
            setIsLoginMode(true);
            setFormData({ fullName: "", password: "" });
          }, 2000);
        }
      } else {
        setMessage(result.error);
      }
    } catch (error) {
      setMessage("Помилка: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMessage("");
    setFormData({ fullName: "", password: "" });
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
