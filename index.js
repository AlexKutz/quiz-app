import DatabaseManager from "./database.js";
import { AuthManager } from "./auth.js";
import { join } from "path";

const PORT = 3000;
const __dirname = import.meta.dir;

// Инициализация базы данных и авторизации
const db = new DatabaseManager();
await db.initialize();

const auth = new AuthManager(db);

// Очищаємо старі сесії при запуску
auth.cleanupSessions();

// Очищаємо старі сесії кожні 30 хвилин
setInterval(() => {
  auth.cleanupSessions();
}, 30 * 60 * 1000);

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  let ip = forwarded?.split(",")[0] || realIp || "127.0.0.1";

  // Handle IPv6 localhost addresses
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    ip = "localhost";
  } else {
    // Remove IPv6 prefix and replace colons with underscores
    ip = ip.replace("::ffff:", "");
    ip = ip.replace(/:/g, "_");
  }

  // Ensure the filename is safe for Windows
  ip = ip.replace(/[<>:"/\\|?*]/g, "_");

  return ip;
}

function checkTimeLimit(quiz, startTime) {
  // quiz.settings уже распарсен в DatabaseManager.getQuiz()
  const settings = quiz.settings;
  if (!settings.timeLimit) {
    return { expired: false, remaining: null, total: null };
  }

  if (!startTime) {
    console.error("startTime is not provided to checkTimeLimit");
    return { expired: false, remaining: null, total: null };
  }

  const timeLimitMs = settings.timeLimit * 60 * 1000; // конвертируем минуты в миллисекунды
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, timeLimitMs - elapsed);

  return {
    expired: elapsed >= timeLimitMs,
    remaining: Math.floor(remaining / 1000), // оставшееся время в секундах
    total: settings.timeLimit * 60, // общее время в секундах
  };
}

// Функция для вычисления результатов на основе сохраненных ответов
function calculateResults(quiz, savedAnswers) {
  // quiz.questions уже распарсен в DatabaseManager.getQuiz()
  const questions = quiz.questions;
  let totalScore = 0;
  let correctCount = 0;

  for (const question of questions) {
    if (question.type === "multiple_choice") {
      const userAnswer = savedAnswers[question.id];
      const correctAnswer = question.answer;
      const isCorrect = userAnswer === correctAnswer;
      totalScore += isCorrect ? 100 : 0;
      correctCount += isCorrect ? 1 : 0;
    } else if (question.type === "matching") {
      const userAnswer = savedAnswers[question.id];
      const correctAnswer = question.answer;

      // Перевіряємо кожне об'єднання
      for (const [leftIndex, rightIndex] of Object.entries(correctAnswer)) {
        if (userAnswer && userAnswer[leftIndex] === rightIndex) {
          correctCount++;
        }
      }

      // Загальна кількість правильних відповідей для цього питання
      const totalMatches = Object.keys(correctAnswer).length;
      const userCorrectMatches = Object.keys(correctAnswer).filter(
        (leftIndex) =>
          userAnswer && userAnswer[leftIndex] === correctAnswer[leftIndex]
      ).length;

      // Часткова оцінка за питання
      const questionScore = (userCorrectMatches / totalMatches) * 100;
      totalScore += questionScore;
    }
  }

  const averageScore = totalScore / questions.length;

  return {
    totalScore,
    correctCount,
    averageScore,
    results: questions.map((q) => {
      const givenAnswer = savedAnswers[q.id];
      const isCorrect =
        q.type === "multiple_choice"
          ? givenAnswer === q.answer
          : q.type === "matching"
          ? givenAnswer === q.answer
          : false;

      return {
        id: q.id,
        question: q.question,
        givenAnswer,
        correct: isCorrect,
        questionType: q.type || "text",
      };
    }),
  };
}

// Функция для автоматического сохранения теста при истечении времени
function autoSaveTest(sessionId, quiz, studentName, ip) {
  const session = db.getSession(studentName, quiz.id, ip);
  if (!session) {
    return false;
  }

  try {
    const timeCheck = checkTimeLimit(quiz, session.start_time);
    if (timeCheck.expired) {
      console.log(`Time expired for session: ${sessionId}`);

      // Получаем сохраненные ответы
      const savedAnswers = JSON.parse(session.answers || "{}");

      // Вычисляем результаты на основе сохраненных ответов
      const results = calculateResults(quiz, savedAnswers);

      // Сохраняем результат
      db.saveResult(
        session.student_id,
        quiz.id,
        results.results,
        1,
        results.averageScore,
        results.totalScore,
        results.correctCount,
        true,
        true
      );

      // Удаляем сессию
      db.deleteSession(sessionId);
      console.log(`Session deleted and test auto-saved: ${sessionId}`);
      return true; // Возвращаем true если сессия была завершена
    }
  } catch (error) {
    console.error(`Error auto-saving test for session ${sessionId}:`, error);
  }

  return false; // Возвращаем false если сессия не была завершена
}

// Функция для пассивной проверки всех сессий
function checkAllSessions() {
  try {
    const sessions = db.getAllSessions();
    console.log(`Checking ${sessions.length} active sessions...`);

    let completedSessions = 0;

    for (const session of sessions) {
      try {
        const quiz = db.getQuiz(session.quiz_id);
        if (!quiz) {
          console.log(`Quiz not found for session: ${session.id}`);
          continue;
        }

        // Проверяем время
        const timeCheck = checkTimeLimit(quiz, session.start_time);

        if (timeCheck.expired) {
          // Время истекло, автоматически сохраняем тест
          const wasCompleted = autoSaveTest(
            session.id,
            quiz,
            session.name,
            session.ip
          );
          if (wasCompleted) {
            completedSessions++;
          }
        }
      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error);
        // Если сессия повреждена, удаляем её
        try {
          db.deleteSession(session.id);
          console.log(`Removed corrupted session: ${session.id}`);
        } catch (unlinkError) {
          console.error(
            `Error removing corrupted session ${session.id}:`,
            unlinkError
          );
        }
      }
    }

    if (completedSessions > 0) {
      console.log(`Completed ${completedSessions} expired sessions`);
    }
  } catch (error) {
    console.error("Error checking sessions:", error);
  }
}

// Функция для случайного выбора вопросов
function getRandomQuestions(allQuestions, count) {
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, allQuestions.length));
}

// Запускаем пассивную проверку сессий каждые 30 секунд
setInterval(checkAllSessions, 30000); // 30 секунд

// Запускаем проверку сразу при старте сервера
setTimeout(checkAllSessions, 5000); // Через 5 секунд после запуска

// Функция для обработки JSON запросов
async function parseJSON(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Функция для отправки JSON ответа
function sendJSON(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// Функция для отправки статических файлов
async function serveStatic(request) {
  const url = new URL(request.url);
  const filePath = join(
    __dirname,
    "public",
    url.pathname === "/" ? "index.html" : url.pathname
  );

  if (Bun.file(filePath).exists) {
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": getContentType(filePath),
      },
    });
  }

  return new Response("Not Found", { status: 404 });
}

function getContentType(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const types = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return types[ext] || "text/plain";
}

// Middleware для автентифікації
function authenticateUser(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  return auth.authenticate(token);
}

// Основной обработчик запросов
async function handleRequest(request) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Статические файлы
  if (
    method === "GET" &&
    (path === "/" || path.startsWith("/static/") || path.includes("."))
  ) {
    return await serveStatic(request);
  }

  // API маршруты
  try {
    // Реєстрація
    if (method === "POST" && path === "/auth/register") {
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
    }

    // Авторизація
    if (method === "POST" && path === "/auth/login") {
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
    }

    // Вихід з системи
    if (method === "POST" && path === "/auth/logout") {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        auth.logout(token);
      }

      return sendJSON({
        success: true,
        message: "Успішний вихід з системи",
      });
    }

    // Перевірка автентифікації
    if (method === "GET" && path === "/auth/me") {
      const user = authenticateUser(request);
      if (!user) {
        return sendJSON({ error: "Не авторизований" }, 401);
      }

      return sendJSON({ user });
    }

    // Захищені маршрути - потребують авторизації
    const protectedRoutes = ["/questions/", "/submit/", "/save-answer/"];
    const isProtectedRoute = protectedRoutes.some((route) =>
      path.startsWith(route)
    );

    if (isProtectedRoute) {
      const user = authenticateUser(request);
      if (!user) {
        return sendJSON({ error: "Необхідна авторизація" }, 401);
      }

      // Додаємо інформацію про користувача до запиту
      request.user = user;
    }

    // Получение списка доступных тестов (тепер з автентифікацією)
    if (method === "GET" && path === "/quizzes") {
      const user = authenticateUser(request);
      const quizzes = db.getAvailableQuizzes();

      // Якщо користувач авторизований, повертаємо всі тести
      // Якщо ні - тільки публічні (можна додати поле в налаштуваннях тесту)
      return sendJSON({
        quizzes,
        authenticated: !!user,
      });
    }

    // Получение информации о тесте
    if (method === "GET" && path.startsWith("/quiz-info/")) {
      const quizId = path.split("/")[2];
      const quiz = db.getQuiz(quizId);

      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      return sendJSON({
        quizTitle: quiz.title,
        students: quiz.settings.students || [],
        timeLimit: quiz.settings.timeLimit,
        maxAttempts: quiz.settings.maxAttempts,
        totalQuestions: quiz.questions.length,
        randomQuestionsCount: quiz.settings.randomQuestionsCount,
      });
    }

    // Получение вопросов или предыдущих результатов
    if (method === "GET" && path.startsWith("/questions/")) {
      const quizId = path.split("/")[2];
      const ip = getClientIp(request);
      const { newAttempt, studentName } = Object.fromEntries(url.searchParams);

      const quiz = db.getQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      // Перевіряємо, чи передано ім'я учня
      if (!studentName) {
        return sendJSON(
          {
            error: "Необхідно вказати ім'я учня",
            students: quiz.settings.students || [],
          },
          400
        );
      }

      // Проверяем истечение времени для существующей сессии
      if (!newAttempt) {
        const session = db.getSession(studentName, quizId, ip);

        if (session) {
          const timeCheck = checkTimeLimit(quiz, session.start_time);
          console.log("Time check for existing session:", {
            studentName,
            startTime: session.start_time,
            timeLimit: quiz.settings.timeLimit,
            timeCheck,
          });

          if (timeCheck.expired) {
            // Время истекло, автоматически сохраняем тест и удаляем сессию
            autoSaveTest(session.id, quiz, studentName, ip);
            return sendJSON({
              timeExpired: true,
              message:
                "Час на проходження тесту вичерпано. Тест автоматично збережено.",
              quizTitle: quiz.title,
            });
          }

          // Возвращаем активную сессию с сохраненными ответами
          const savedAnswers = JSON.parse(session.answers || "{}");
          const questions = JSON.parse(session.questions);

          return sendJSON({
            completed: false,
            questions: questions,
            totalQuestions: questions.length,
            quizTitle: quiz.title,
            maxAttempts: quiz.settings.maxAttempts,
            timeLimit: quiz.settings.timeLimit,
            startTime: session.start_time,
            timeRemaining: timeCheck.remaining,
            students: quiz.settings.students || [],
            savedAnswers: savedAnswers, // Добавляем сохраненные ответы
          });
        }
      }

      // Проверяем, есть ли результаты для этого студента
      if (!newAttempt && studentName) {
        const result = db.getResult(studentName, quizId, ip);

        if (result) {
          if (result.attempts >= quiz.settings.maxAttempts) {
            return sendJSON({
              completed: true,
              results: {
                name: result.name,
                ip: result.ip,
                results: JSON.parse(result.results),
                attempts: result.attempts,
                completedAt: result.completed_at,
                quizTitle: result.quiz_title,
                quizId: result.quiz_id,
                averageScore: result.average_score,
                totalScore: result.total_score,
                correctCount: result.correct_count,
                autoSaved: result.auto_saved,
                timeExpired: result.time_expired,
              },
              maxAttemptsReached: true,
              quizTitle: quiz.title,
              students: quiz.settings.students || [],
            });
          }

          return sendJSON({
            completed: true,
            results: {
              name: result.name,
              ip: result.ip,
              results: JSON.parse(result.results),
              attempts: result.attempts,
              completedAt: result.completed_at,
              quizTitle: result.quiz_title,
              quizId: result.quiz_id,
              averageScore: result.average_score,
              totalScore: result.total_score,
              correctCount: result.correct_count,
              autoSaved: result.auto_saved,
              timeExpired: result.time_expired,
            },
            attemptsLeft: quiz.settings.maxAttempts - result.attempts,
            quizTitle: quiz.title,
            students: quiz.settings.students || [],
          });
        }
      }

      const randomQuestions = getRandomQuestions(
        quiz.questions,
        quiz.settings.randomQuestionsCount
      );

      // Создаем новую сессию
      const questionsData = randomQuestions.map((q) => {
        const questionData = {
          id: q.id,
          question: q.question,
          type: q.type || "text",
        };

        if (q.type === "multiple_choice" && q.options) {
          questionData.options = q.options;
        }

        if (q.type === "matching") {
          questionData.leftColumn = q.leftColumn;
          questionData.rightColumn = q.rightColumn;
        }

        return questionData;
      });

      const { student, startTime } = db.createSession(
        studentName,
        quizId,
        ip,
        questionsData
      );

      // Обчислюємо час, що залишився для нової сесії
      const timeCheck = checkTimeLimit(quiz, startTime);
      console.log("Time check for new session:", {
        studentName,
        startTime,
        timeLimit: quiz.settings.timeLimit,
        timeCheck,
      });

      return sendJSON({
        completed: false,
        questions: questionsData,
        totalQuestions: randomQuestions.length,
        quizTitle: quiz.title,
        maxAttempts: quiz.settings.maxAttempts,
        timeLimit: quiz.settings.timeLimit
          ? quiz.settings.timeLimit * 60
          : null,
        startTime: startTime,
        timeRemaining: timeCheck.remaining,
        students: quiz.settings.students || [],
        savedAnswers: {}, // Пустые ответы для новой сессии
      });
    }

    // Сохранение ответов в сессии
    if (method === "POST" && path.startsWith("/save-answer/")) {
      const quizId = path.split("/")[2];
      const body = await parseJSON(request);
      const { studentName, questionId, answer } = body;
      const ip = getClientIp(request);

      if (!questionId || answer === undefined) {
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const session = db.getSession(studentName, quizId, ip);
      if (!session) {
        return sendJSON({ error: "Сессия не найдена" }, 404);
      }

      try {
        const answers = JSON.parse(session.answers || "{}");
        answers[questionId] = answer;

        db.updateSessionAnswers(session.id, answers);

        return sendJSON({ success: true, message: "Ответ сохранен" });
      } catch (error) {
        console.error("Error saving answer:", error);
        return sendJSON({ error: "Ошибка сохранения ответа" }, 500);
      }
    }

    // Сохранение результатов
    if (method === "POST" && path.startsWith("/submit/")) {
      const quizId = path.split("/")[2];
      const body = await parseJSON(request);
      const { name, answers } = body;

      if (!name || !answers) {
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const quiz = db.getQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      const ip = getClientIp(request);

      // Проверяем время, если есть активная сессия
      const session = db.getSession(name, quizId, ip);
      if (session) {
        const timeCheck = checkTimeLimit(quiz, session.start_time);

        if (timeCheck.expired) {
          // Время истекло, автоматически сохраняем тест и удаляем сессию
          autoSaveTest(session.id, quiz, name, ip);
          return sendJSON(
            {
              error:
                "Час на проходження тесту вичерпано. Тест автоматично збережено.",
              timeExpired: true,
            },
            400
          );
        }

        // Удаляем сессию после успешной отправки
        db.deleteSession(session.id);
      }

      // Находим студента
      let student = db.queries.getStudent.get(name, quizId, ip);
      if (!student) {
        db.queries.insertStudent.run(name, quizId, ip);
        student = db.queries.getStudent.get(name, quizId, ip);
      }

      // Вычисляем результаты
      const results = calculateResults(quiz, answers);

      // Проверяем, есть ли уже результат
      const existingResult = db.getResult(name, quizId, ip);

      if (existingResult) {
        // Обновляем существующий результат
        db.updateResult(
          student.id,
          quizId,
          results.results,
          existingResult.attempts + 1,
          results.averageScore,
          results.totalScore,
          results.correctCount,
          false,
          false
        );
      } else {
        // Создаем новый результат
        db.saveResult(
          student.id,
          quizId,
          results.results,
          1,
          results.averageScore,
          results.totalScore,
          results.correctCount,
          false,
          false
        );
      }

      const newResult = {
        name,
        ip,
        results: results.results,
        attempts: existingResult ? existingResult.attempts + 1 : 1,
        completedAt: new Date().toISOString(),
        quizTitle: quiz.title,
        quizId,
        averageScore: results.averageScore,
        totalScore: results.totalScore,
        correctCount: results.correctCount,
      };

      return sendJSON({
        ...newResult,
        maxAttemptsReached: newResult.attempts >= quiz.settings.maxAttempts,
      });
    }

    // Проверка времени
    if (method === "GET" && path.startsWith("/check-time/")) {
      const quizId = path.split("/")[2];
      const { studentName } = Object.fromEntries(url.searchParams);
      const ip = getClientIp(request);

      const quiz = db.getQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      const session = db.getSession(studentName, quizId, ip);

      if (session) {
        const timeCheck = checkTimeLimit(quiz, session.start_time);

        if (timeCheck.expired) {
          // Время истекло, автоматически сохраняем тест
          autoSaveTest(session.id, quiz, studentName, ip);
          return sendJSON({
            timeExpired: true,
            message:
              "Час на проходження тесту вичерпано. Тест автоматично збережено.",
          });
        }

        return sendJSON({
          timeExpired: false,
          timeRemaining: timeCheck.remaining,
          timeLimit: quiz.settings.timeLimit * 60,
        });
      }

      return sendJSON({ timeExpired: false });
    }

    // Ручная проверка всех сессий
    if (method === "GET" && path === "/admin/check-sessions") {
      checkAllSessions();
      return sendJSON({ message: "Session check completed" });
    }

    // 404 для неизвестных маршрутов
    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("Error handling request:", error);
    return sendJSON({ error: "Internal Server Error" }, 500);
  }
}

// Запуск сервера
console.log(`Сервер запущен: http://0.0.0.0:${PORT}`);
console.log("Пассивная проверка сессий каждые 30 секунд");

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: handleRequest,
});
