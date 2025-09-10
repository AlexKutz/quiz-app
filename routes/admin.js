import { sendJSON, parseJSON } from "../utils/response.js";
import { authenticateUser } from "../middleware/auth.js";

export function createAdminRoutes(db, auth) {
  return {
    // Отримати всі результати
    getAllResults(request) {
      const user = authenticateUser(request, auth);
      if (!user || user.role !== "admin") {
        return sendJSON(
          { error: "Доступ заборонено. Потрібні права адміністратора." },
          403
        );
      }

      try {
        const results = db.getAllResults();
        return sendJSON({ results });
      } catch (error) {
        console.error("Error fetching all results:", error);
        return sendJSON({ error: "Помилка отримання результатів" }, 500);
      }
    },

    // Отримати результати по конкретному тесту
    getResultsByQuiz(request) {
      const user = authenticateUser(request, auth);
      if (!user || user.role !== "admin") {
        return sendJSON(
          { error: "Доступ заборонено. Потрібні права адміністратора." },
          403
        );
      }

      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[3];

      if (!quizId) {
        return sendJSON({ error: "ID тесту не вказано" }, 400);
      }

      try {
        const results = db.getResultsByQuiz(quizId);
        return sendJSON({ results });
      } catch (error) {
        console.error("Error fetching results by quiz:", error);
        return sendJSON({ error: "Помилка отримання результатів тесту" }, 500);
      }
    },

    // Отримати статистику по всіх тестах
    getResultsStats(request) {
      const user = authenticateUser(request, auth);
      if (!user || user.role !== "admin") {
        return sendJSON(
          { error: "Доступ заборонено. Потрібні права адміністратора." },
          403
        );
      }

      try {
        const stats = db.getResultsStats();
        return sendJSON({ stats });
      } catch (error) {
        console.error("Error fetching results stats:", error);
        return sendJSON({ error: "Помилка отримання статистики" }, 500);
      }
    },

    // Отримати детальну інформацію про результат
    getResultDetails(request) {
      const user = authenticateUser(request, auth);
      if (!user || user.role !== "admin") {
        return sendJSON(
          { error: "Доступ заборонено. Потрібні права адміністратора." },
          403
        );
      }

      const url = new URL(request.url);
      const resultId = url.pathname.split("/")[3];

      if (!resultId) {
        return sendJSON({ error: "ID результату не вказано" }, 400);
      }

      try {
        const result = db.queries.getResultById?.get(resultId);
        if (!result) {
          return sendJSON({ error: "Результат не знайдено" }, 404);
        }

        return sendJSON({ result });
      } catch (error) {
        console.error("Error fetching result details:", error);
        return sendJSON({ error: "Помилка отримання деталей результату" }, 500);
      }
    },

    // Отримати список всіх тестів з кількістю спроб
    getQuizzesWithStats(request) {
      const user = authenticateUser(request, auth);
      if (!user || user.role !== "admin") {
        return sendJSON(
          { error: "Доступ заборонено. Потрібні права адміністратора." },
          403
        );
      }

      try {
        const quizzes = db.getAvailableQuizzes();
        const stats = db.getResultsStats();

        const quizzesWithStats = quizzes.map((quiz) => {
          const quizStats = stats.find((stat) => stat.quiz_id === quiz.id);
          return {
            ...quiz,
            stats: quizStats || {
              total_attempts: 0,
              unique_students: 0,
              avg_score: 0,
              max_score: 0,
              min_score: 0,
            },
          };
        });

        return sendJSON({ quizzes: quizzesWithStats });
      } catch (error) {
        console.error("Error fetching quizzes with stats:", error);
        return sendJSON(
          { error: "Помилка отримання тестів зі статистикою" },
          500
        );
      }
    },

    // Експорт результатів у форматі CSV
    exportResults(request) {
      const user = authenticateUser(request, auth);
      if (!user || user.role !== "admin") {
        return sendJSON(
          { error: "Доступ заборонено. Потрібні права адміністратора." },
          403
        );
      }

      const url = new URL(request.url);
      const quizId = url.searchParams.get("quizId");

      try {
        const results = quizId
          ? db.getResultsByQuiz(quizId)
          : db.getAllResults();

        // Формуємо CSV заголовки
        const headers = [
          "ID",
          "Ім'я студента",
          "Назва тесту",
          "Спроб",
          "Середній бал",
          "Загальний бал",
          "Правильних відповідей",
          "Дата завершення",
          "Автозбережено",
          "Час вичерпано",
        ];

        // Формуємо CSV рядки
        const csvRows = results.map((result) => [
          result.id,
          result.name,
          result.quiz_title,
          result.attempts,
          result.average_score.toFixed(2),
          result.total_score,
          result.correct_count,
          result.completed_at,
          result.auto_saved ? "Так" : "Ні",
          result.time_expired ? "Так" : "Ні",
        ]);

        const csvContent = [headers, ...csvRows]
          .map((row) => row.map((field) => `"${field}"`).join(","))
          .join("\n");

        return new Response(csvContent, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="results${
              quizId ? `_${quizId}` : ""
            }_${new Date().toISOString().split("T")[0]}.csv"`,
          },
        });
      } catch (error) {
        console.error("Error exporting results:", error);
        return sendJSON({ error: "Помилка експорту результатів" }, 500);
      }
    },
  };
}
