import { sendJSON, parseJSON } from "../utils/response.js";
import { authenticateUser } from "../middleware/auth.js";

export function createAuthRoutes(auth) {
  return {
    async register(request) {
      const body = await parseJSON(request);
      console.log("Register request body:", body);

      if (!body) {
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const { fullName, password } = body;

      if (!fullName || !password) {
        return sendJSON(
          {
            error: "Повне ім'я та пароль є обов'язковими",
          },
          400
        );
      }

      try {
        const result = await auth.register(fullName, password);
        return sendJSON({
          success: true,
          message: "Користувач успішно зареєстрований",
          userId: result.userId,
        });
      } catch (error) {
        console.error("Register error:", error);
        return sendJSON(
          {
            error: error.message,
          },
          400
        );
      }
    },

    async login(request) {
      const body = await parseJSON(request);
      console.log("Login request body:", body);

      if (!body) {
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const { fullName, password } = body;

      try {
        const result = await auth.login(fullName, password);
        return sendJSON(result);
      } catch (error) {
        console.error("Login error:", error);
        return sendJSON(
          {
            error: error.message,
          },
          401
        );
      }
    },

    logout(request) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        auth.logout(token);
      }

      return sendJSON({
        success: true,
        message: "Успішний вихід з системи",
      });
    },

    me(request, auth) {
      const user = authenticateUser(request, auth);
      if (!user) {
        return sendJSON({ error: "Не авторизований" }, 401);
      }

      return sendJSON({ user });
    },
  };
}
