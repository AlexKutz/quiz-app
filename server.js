import DatabaseManager from "./database.js";
import { AuthManager } from "./auth.js";
import { QuizService } from "./services/quizService.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createQuizRoutes } from "./routes/quiz.js";
import { createAdminRoutes } from "./routes/admin.js";
import { serveStatic } from "./utils/static.js";
import { sendJSON } from "./utils/response.js";
import { SERVER_CONFIG, CORS_HEADERS } from "./config/server.js";
import { join } from "path";

const __dirname = import.meta.dir;

// Инициализация
const db = new DatabaseManager();
await db.initialize();

const auth = new AuthManager(db);
const quizService = new QuizService(db);

// Очистка сессий
auth.cleanupSessions();
setInterval(() => {
  auth.cleanupSessions();
}, SERVER_CONFIG.SESSION_CLEANUP_INTERVAL);

// Создание маршрутов
const authRoutes = createAuthRoutes(auth);
const quizRoutes = createQuizRoutes(db, quizService, auth);
const adminRoutes = createAdminRoutes(db, auth);

// Пассивная проверка сессий
setInterval(() => {
  quizService.checkAllSessions();
}, SERVER_CONFIG.SESSION_CHECK_INTERVAL);

setTimeout(() => {
  quizService.checkAllSessions();
}, SERVER_CONFIG.SESSION_CHECK_DELAY);

// Основной обработчик запросов
async function handleRequest(request) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  // Статические файлы
  if (
    method === "GET" &&
    (path === "/" || path.startsWith("/static/") || path.includes("."))
  ) {
    return await serveStatic(request, join(__dirname, "public"));
  }

  // API маршруты
  try {
    // Auth routes
    if (method === "POST" && path === "/auth/register") {
      return await authRoutes.register(request);
    }
    if (method === "POST" && path === "/auth/login") {
      return await authRoutes.login(request);
    }
    if (method === "POST" && path === "/auth/logout") {
      return authRoutes.logout(request);
    }
    if (method === "GET" && path === "/auth/me") {
      return authRoutes.me(request, auth);
    }

    // Quiz routes
    if (method === "GET" && path === "/quizzes") {
      return quizRoutes.getQuizzes(request);
    }
    if (method === "GET" && path.startsWith("/quiz-info/")) {
      return quizRoutes.getQuizInfo(request);
    }
    if (method === "GET" && path.startsWith("/questions/")) {
      return quizRoutes.getQuestions(request);
    }
    if (method === "POST" && path.startsWith("/save-answer/")) {
      return quizRoutes.saveAnswer(request);
    }
    if (method === "POST" && path.startsWith("/submit/")) {
      return await quizRoutes.submitQuiz(request);
    }
    if (method === "POST" && path.startsWith("/mark-confetti-shown/")) {
      return quizRoutes.markConfettiShown(request);
    }
    if (method === "GET" && path.startsWith("/check-time/")) {
      return quizRoutes.checkTime(request);
    }
    if (method === "GET" && path === "/admin/check-sessions") {
      return quizRoutes.checkSessions();
    }

    // Admin routes
    if (method === "GET" && path === "/admin/results") {
      return adminRoutes.getAllResults(request);
    }
    if (method === "GET" && path.startsWith("/admin/results/quiz/")) {
      return adminRoutes.getResultsByQuiz(request);
    }
    if (method === "GET" && path === "/admin/stats") {
      return adminRoutes.getResultsStats(request);
    }
    if (method === "GET" && path.startsWith("/admin/result/")) {
      return adminRoutes.getResultDetails(request);
    }
    if (method === "GET" && path === "/admin/quizzes") {
      return adminRoutes.getQuizzesWithStats(request);
    }
    if (method === "GET" && path === "/admin/export") {
      return adminRoutes.exportResults(request);
    }

    // 404 для неизвестных маршрутов
    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("Error handling request:", error);
    return sendJSON({ error: "Internal Server Error" }, 500);
  }
}

// Запуск сервера
console.log(
  `Сервер запущен: http://${SERVER_CONFIG.HOSTNAME}:${SERVER_CONFIG.PORT}`
);
console.log("Пассивная проверка сессий каждые 30 секунд");

Bun.serve({
  port: SERVER_CONFIG.PORT,
  hostname: SERVER_CONFIG.HOSTNAME,
  fetch: handleRequest,
});
