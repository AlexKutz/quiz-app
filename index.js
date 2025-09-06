import { file } from "bun";
import { join, dirname } from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "fs";

const PORT = 3000;
const __dirname = import.meta.dir;

// Ensure results and sessions directories exist
const resultsDir = join(__dirname, "results");
const sessionsDir = join(__dirname, "sessions");

if (!existsSync(resultsDir)) {
  mkdirSync(resultsDir, { recursive: true });
}

if (!existsSync(sessionsDir)) {
  mkdirSync(sessionsDir, { recursive: true });
}

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
  if (!quiz.settings.timeLimit) {
    return { expired: false, remaining: null, total: null };
  }

  if (!startTime) {
    console.error("startTime is not provided to checkTimeLimit");
    return { expired: false, remaining: null, total: null };
  }

  const timeLimitMs = quiz.settings.timeLimit * 60 * 1000; // конвертируем минуты в миллисекунды
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, timeLimitMs - elapsed);

  return {
    expired: elapsed >= timeLimitMs,
    remaining: Math.floor(remaining / 1000), // оставшееся время в секундах
    total: quiz.settings.timeLimit * 60, // общее время в секундах
  };
}

// Функция для вычисления результатов на основе сохраненных ответов
function calculateResults(quiz, savedAnswers) {
  let totalScore = 0;
  let correctCount = 0;

  for (const question of quiz.questions) {
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

  const averageScore = totalScore / quiz.questions.length;

  return {
    totalScore,
    correctCount,
    averageScore,
    results: quiz.questions.map((q) => {
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
function autoSaveTest(sessionPath, quiz, studentName, ip) {
  if (!existsSync(sessionPath)) {
    return;
  }

  try {
    const sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));
    const startTime =
      studentName && sessionData.students && sessionData.students[studentName]
        ? sessionData.students[studentName].startTime
        : sessionData.startTime;

    if (!startTime) {
      return;
    }

    const timeCheck = checkTimeLimit(quiz, startTime);
    if (timeCheck.expired) {
      console.log(`Time expired for session: ${sessionPath}`);

      // Получаем сохраненные ответы
      const savedAnswers =
        studentName && sessionData.students && sessionData.students[studentName]
          ? sessionData.students[studentName].answers || {}
          : sessionData.answers || {};

      // Вычисляем результаты на основе сохраненных ответов
      const results = calculateResults(quiz, savedAnswers);

      // Создаем результат с сохраненными ответами
      const autoSaveResult = {
        name: studentName || "Unknown",
        ip: ip,
        results: results.results,
        attempts: 1,
        completedAt: new Date().toISOString(),
        quizTitle: quiz.settings.title,
        quizId: quiz.id || "unknown",
        averageScore: results.averageScore,
        totalScore: results.totalScore,
        correctCount: results.correctCount,
        autoSaved: true,
        timeExpired: true,
      };

      // Сохраняем результат
      const resultsPath = join("results", `${quiz.id || "unknown"}.json`);
      let allResults = [];
      if (existsSync(resultsPath)) {
        allResults = JSON.parse(readFileSync(resultsPath, "utf-8"));
      }

      const existingIndex = allResults.findIndex(
        (result) =>
          result.name === autoSaveResult.name && result.ip === autoSaveResult.ip
      );

      if (existingIndex >= 0) {
        allResults[existingIndex] = autoSaveResult;
      } else {
        allResults.push(autoSaveResult);
      }

      writeFileSync(resultsPath, JSON.stringify(allResults, null, 2), "utf-8");

      // Удаляем сессию
      unlinkSync(sessionPath);
      console.log(`Session deleted and test auto-saved: ${sessionPath}`);
      return true; // Возвращаем true если сессия была завершена
    }
  } catch (error) {
    console.error(`Error auto-saving test for session ${sessionPath}:`, error);
  }

  return false; // Возвращаем false если сессия не была завершена
}

// Функция для пассивной проверки всех сессий
function checkAllSessions() {
  try {
    if (!existsSync(sessionsDir)) {
      return;
    }

    const sessionFiles = readdirSync(sessionsDir);
    const sessionJsonFiles = sessionFiles.filter((file) =>
      file.endsWith("_session.json")
    );

    console.log(`Checking ${sessionJsonFiles.length} active sessions...`);

    let completedSessions = 0;

    for (const sessionFile of sessionJsonFiles) {
      const sessionPath = join(sessionsDir, sessionFile);

      try {
        const sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));

        // Извлекаем информацию о квизе и студенте из имени файла
        const fileName = sessionFile.replace("_session.json", "");
        const parts = fileName.split("_");

        if (parts.length < 2) {
          console.log(`Invalid session file format: ${sessionFile}`);
          continue;
        }

        const ip = parts[0];
        const quizId = parts[1];
        const studentName = parts.length > 2 ? parts.slice(2).join("_") : null;

        // Загружаем квиз
        const quiz = loadQuiz(quizId);
        if (!quiz) {
          console.log(`Quiz not found for session: ${sessionFile}`);
          continue;
        }

        // Проверяем время
        const startTime =
          studentName &&
          sessionData.students &&
          sessionData.students[studentName]
            ? sessionData.students[studentName].startTime
            : sessionData.startTime;

        if (startTime) {
          const timeCheck = checkTimeLimit(quiz, startTime);

          if (timeCheck.expired) {
            // Время истекло, автоматически сохраняем тест
            const wasCompleted = autoSaveTest(
              sessionPath,
              quiz,
              studentName,
              ip
            );
            if (wasCompleted) {
              completedSessions++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing session file ${sessionFile}:`, error);
        // Если файл поврежден, удаляем его
        try {
          unlinkSync(sessionPath);
          console.log(`Removed corrupted session file: ${sessionFile}`);
        } catch (unlinkError) {
          console.error(
            `Error removing corrupted session file ${sessionFile}:`,
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

// Функция для получения списка доступных тестов
function getAvailableQuizzes() {
  const quizzesDir = join(__dirname, "quizzes");
  if (!existsSync(quizzesDir)) {
    return [];
  }

  const files = readdirSync(quizzesDir);
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const filePath = join(quizzesDir, file);
      const content = JSON.parse(readFileSync(filePath, "utf-8"));
      return {
        id: file.replace(".json", ""),
        title: content.settings.title,
        maxAttempts: content.settings.maxAttempts,
        totalQuestions: content.questions.length,
        randomQuestionsCount: content.settings.randomQuestionsCount,
        students: content.settings.students || [],
      };
    });
}

// Функция для загрузки теста
function loadQuiz(quizId) {
  const quizPath = join(__dirname, "quizzes", `${quizId}.json`);
  if (!existsSync(quizPath)) {
    return null;
  }
  const quiz = JSON.parse(readFileSync(quizPath, "utf-8"));
  quiz.id = quizId; // Добавляем ID квиза для использования в autoSaveTest
  return quiz;
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

  if (existsSync(filePath)) {
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
    // Получение списка доступных тестов
    if (method === "GET" && path === "/quizzes") {
      const quizzes = getAvailableQuizzes();
      return sendJSON(quizzes);
    }

    // Получение информации о тесте
    if (method === "GET" && path.startsWith("/quiz-info/")) {
      const quizId = path.split("/")[2];
      const quiz = loadQuiz(quizId);

      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      return sendJSON({
        quizTitle: quiz.settings.title,
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
      const resultsPath = join("results", `${quizId}.json`);
      const { newAttempt, studentName } = Object.fromEntries(url.searchParams);

      const quiz = loadQuiz(quizId);
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

      // Створюємо унікальний шлях сесії для кожного учня в папці sessions
      const sessionPath = join(
        "sessions",
        `${ip}_${quizId}_${studentName}_session.json`
      );

      // Проверяем истечение времени для существующей сессии
      if (existsSync(sessionPath) && !newAttempt) {
        const sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));

        // Знаходимо час початку
        let studentStartTime = null;
        if (
          studentName &&
          sessionData.students &&
          sessionData.students[studentName]
        ) {
          studentStartTime = sessionData.students[studentName].startTime;
        } else if (sessionData.startTime) {
          // Fallback для старого формату
          studentStartTime = sessionData.startTime;
        }

        if (studentStartTime) {
          const timeCheck = checkTimeLimit(quiz, studentStartTime);
          console.log("Time check for existing session:", {
            studentName,
            startTime: studentStartTime,
            timeLimit: quiz.settings.timeLimit,
            timeCheck,
          });

          if (timeCheck.expired) {
            // Время истекло, автоматически сохраняем тест и удаляем сессию
            autoSaveTest(sessionPath, quiz, studentName, ip);
            return sendJSON({
              timeExpired: true,
              message:
                "Час на проходження тесту вичерпано. Тест автоматично збережено.",
              quizTitle: quiz.settings.title,
            });
          }

          // Возвращаем активную сессию с сохраненными ответами
          const savedAnswers =
            studentName &&
            sessionData.students &&
            sessionData.students[studentName]
              ? sessionData.students[studentName].answers || {}
              : sessionData.answers || {};

          return sendJSON({
            completed: false,
            questions:
              sessionData.students && sessionData.students[studentName]
                ? sessionData.students[studentName].questions
                : sessionData.questions,
            totalQuestions:
              sessionData.students && sessionData.students[studentName]
                ? sessionData.students[studentName].questions.length
                : sessionData.questions.length,
            quizTitle: quiz.settings.title,
            maxAttempts: quiz.settings.maxAttempts,
            timeLimit: quiz.settings.timeLimit,
            startTime: studentStartTime,
            timeRemaining: timeCheck.remaining,
            students: quiz.settings.students || [],
            savedAnswers: savedAnswers, // Добавляем сохраненные ответы
          });
        }
      }

      // Проверяем, есть ли результаты для этого студента (только если передано имя)
      if (existsSync(resultsPath) && !newAttempt && studentName) {
        const allResults = JSON.parse(readFileSync(resultsPath, "utf-8"));
        const studentResults = allResults.find(
          (result) => result.name === studentName && result.ip === ip
        );

        if (studentResults) {
          if (studentResults.attempts >= quiz.settings.maxAttempts) {
            return sendJSON({
              completed: true,
              results: studentResults,
              maxAttemptsReached: true,
              quizTitle: quiz.settings.title,
              students: quiz.settings.students || [],
            });
          }

          return sendJSON({
            completed: true,
            results: studentResults,
            attemptsLeft: quiz.settings.maxAttempts - studentResults.attempts,
            quizTitle: quiz.settings.title,
            students: quiz.settings.students || [],
          });
        }
      }

      const randomQuestions = getRandomQuestions(
        quiz.questions,
        quiz.settings.randomQuestionsCount
      );

      // Завантажуємо існуючу сесію або створюємо нову
      let sessionData = {};
      if (existsSync(sessionPath)) {
        sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));
      }

      // Створюємо час початку
      const startTime = Date.now();

      // Створюємо нову сесію з іменем учня
      sessionData = {
        startTime: startTime,
        answers: {}, // Инициализируем пустой объект для ответов
        questions: randomQuestions.map((q) => {
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
        }),
      };

      writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), "utf-8");

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
        questions: sessionData.questions,
        totalQuestions: randomQuestions.length,
        quizTitle: quiz.settings.title,
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

      const sessionPath = studentName
        ? join("sessions", `${ip}_${quizId}_${studentName}_session.json`)
        : join("sessions", `${ip}_${quizId}_session.json`);

      if (!existsSync(sessionPath)) {
        return sendJSON({ error: "Сессия не найдена" }, 404);
      }

      try {
        const sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));

        // Сохраняем ответ
        if (
          studentName &&
          sessionData.students &&
          sessionData.students[studentName]
        ) {
          if (!sessionData.students[studentName].answers) {
            sessionData.students[studentName].answers = {};
          }
          sessionData.students[studentName].answers[questionId] = answer;
        } else {
          if (!sessionData.answers) {
            sessionData.answers = {};
          }
          sessionData.answers[questionId] = answer;
        }

        writeFileSync(
          sessionPath,
          JSON.stringify(sessionData, null, 2),
          "utf-8"
        );

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

      const quiz = loadQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      const ip = getClientIp(request);
      const resultsPath = join("results", `${quizId}.json`);
      const sessionPath = join(
        "sessions",
        `${ip}_${quizId}_${name}_session.json`
      );

      // Проверяем время, если есть активная сессия
      if (existsSync(sessionPath)) {
        const sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));
        const timeCheck = checkTimeLimit(quiz, sessionData.startTime);

        if (timeCheck.expired) {
          // Время истекло, автоматически сохраняем тест и удаляем сессию
          autoSaveTest(sessionPath, quiz, name, ip);
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
        unlinkSync(sessionPath);
      }

      // Вычисляем результаты
      const results = calculateResults(quiz, answers);

      const newResult = {
        name,
        ip,
        results: results.results,
        attempts: 1, // Always 1 for new attempts
        completedAt: new Date().toISOString(),
        quizTitle: quiz.settings.title,
        quizId,
        averageScore: results.averageScore,
        totalScore: results.totalScore,
        correctCount: results.correctCount,
      };

      // Читаем существующие результаты или создаем новый массив
      let allResults = [];
      if (existsSync(resultsPath)) {
        allResults = JSON.parse(readFileSync(resultsPath, "utf-8"));
      }

      // Находим существующий результат этого студента (по имени И IP) или добавляем новый
      const existingIndex = allResults.findIndex(
        (result) => result.name === name && result.ip === ip
      );
      if (existingIndex >= 0) {
        allResults[existingIndex] = newResult;
      } else {
        allResults.push(newResult);
      }

      writeFileSync(resultsPath, JSON.stringify(allResults, null, 2), "utf-8");

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

      const quiz = loadQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      const sessionPath = studentName
        ? join("sessions", `${ip}_${quizId}_${studentName}_session.json`)
        : join("sessions", `${ip}_${quizId}_session.json`);

      if (existsSync(sessionPath)) {
        const sessionData = JSON.parse(readFileSync(sessionPath, "utf-8"));
        const startTime =
          studentName &&
          sessionData.students &&
          sessionData.students[studentName]
            ? sessionData.students[studentName].startTime
            : sessionData.startTime;

        if (startTime) {
          const timeCheck = checkTimeLimit(quiz, startTime);

          if (timeCheck.expired) {
            // Время истекло, автоматически сохраняем тест
            autoSaveTest(sessionPath, quiz, studentName, ip);
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
