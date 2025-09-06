import { Database } from "bun:sqlite";
import { join } from "path";
import { readdirSync, existsSync } from "fs";

class DatabaseManager {
  constructor() {
    this.db = new Database("testing_server.db");
    this.queries = {};
    this.initDatabase();
    this.prepareQueries();
  }

  // Создание таблиц
  initDatabase() {
    // Таблица тестов
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        settings TEXT NOT NULL,
        questions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица учеников
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quiz_id TEXT NOT NULL,
        ip TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
      )
    `);

    // Таблица сессий
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        quiz_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        answers TEXT DEFAULT '{}',
        questions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
      )
    `);

    // Таблица результатов
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        quiz_id TEXT NOT NULL,
        results TEXT NOT NULL,
        attempts INTEGER DEFAULT 1,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        average_score REAL NOT NULL,
        total_score REAL NOT NULL,
        correct_count INTEGER NOT NULL,
        auto_saved BOOLEAN DEFAULT FALSE,
        time_expired BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
      )
    `);

    // Таблица пользователей (для авторизации)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        full_name TEXT,
        role TEXT DEFAULT 'student',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Таблица сессий пользователей (JWT)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log("Database initialized successfully");
  }

  // Подготовка запросов
  prepareQueries() {
    this.queries = {
      // Quizzes
      insertQuiz: this.db.prepare(`
        INSERT OR REPLACE INTO quizzes (id, title, settings, questions)
        VALUES (?, ?, ?, ?)
      `),
      getQuiz: this.db.prepare(`SELECT * FROM quizzes WHERE id = ?`),
      getAllQuizzes: this.db.prepare(
        `SELECT * FROM quizzes ORDER BY created_at DESC`
      ),

      // Students
      insertStudent: this.db.prepare(`
        INSERT INTO students (name, quiz_id, ip)
        VALUES (?, ?, ?)
      `),
      getStudent: this.db.prepare(`
        SELECT * FROM students WHERE name = ? AND quiz_id = ? AND ip = ?
      `),
      getStudentById: this.db.prepare(`SELECT * FROM students WHERE id = ?`),

      // Sessions
      insertSession: this.db.prepare(`
        INSERT INTO sessions (student_id, quiz_id, start_time, answers, questions)
        VALUES (?, ?, ?, ?, ?)
      `),
      getSession: this.db.prepare(`
        SELECT s.*, st.name, st.ip 
        FROM sessions s
        JOIN students st ON s.student_id = st.id
        WHERE st.name = ? AND s.quiz_id = ? AND st.ip = ?
      `),
      updateSessionAnswers: this.db.prepare(`
        UPDATE sessions SET answers = ? WHERE id = ?
      `),
      deleteSession: this.db.prepare(`DELETE FROM sessions WHERE id = ?`),
      getAllSessions: this.db.prepare(`
        SELECT s.*, st.name, st.ip, q.title as quiz_title
        FROM sessions s
        JOIN students st ON s.student_id = st.id
        JOIN quizzes q ON s.quiz_id = q.id
      `),

      // Results
      insertResult: this.db.prepare(`
        INSERT INTO results (student_id, quiz_id, results, attempts, average_score, total_score, correct_count, auto_saved, time_expired)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateResult: this.db.prepare(`
        UPDATE results 
        SET results = ?, attempts = ?, completed_at = CURRENT_TIMESTAMP, 
            average_score = ?, total_score = ?, correct_count = ?, auto_saved = ?, time_expired = ?
        WHERE student_id = ? AND quiz_id = ?
      `),
      getResult: this.db.prepare(`
        SELECT r.*, st.name, st.ip, q.title as quiz_title
        FROM results r
        JOIN students st ON r.student_id = st.id
        JOIN quizzes q ON r.quiz_id = q.id
        WHERE st.name = ? AND r.quiz_id = ? AND st.ip = ?
      `),
      getResultsByQuiz: this.db.prepare(`
        SELECT r.*, st.name, st.ip, q.title as quiz_title
        FROM results r
        JOIN students st ON r.student_id = st.id
        JOIN quizzes q ON r.quiz_id = q.id
        WHERE r.quiz_id = ?
        ORDER BY r.completed_at DESC
      `),

      // User authentication queries
      insertUser: this.db.prepare(`
        INSERT INTO users (username, password_hash, email, full_name, role)
        VALUES (?, ?, ?, ?, ?)
      `),
      getUserByUsername: this.db.prepare(`
        SELECT * FROM users WHERE username = ?
      `),
      getUserById: this.db.prepare(`
        SELECT * FROM users WHERE id = ?
      `),
      updateLastLogin: this.db.prepare(`
        UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
      `),

      // Session management
      insertUserSession: this.db.prepare(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `),
      getUserSession: this.db.prepare(`
        SELECT us.*, u.username, u.role 
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.token_hash = ? AND us.expires_at > datetime('now')
      `),
      deleteUserSession: this.db.prepare(`
        DELETE FROM user_sessions WHERE token_hash = ?
      `),
      deleteExpiredSessions: this.db.prepare(`
        DELETE FROM user_sessions WHERE expires_at <= datetime('now')
      `),
    };
  }

  // Загрузка существующих тестов из JSON файлов в базу данных
  async loadExistingQuizzes() {
    const quizzesDir = join(import.meta.dir, "quizzes");
    if (!existsSync(quizzesDir)) {
      return;
    }

    try {
      const files = readdirSync(quizzesDir).filter((file) =>
        file.endsWith(".json")
      );

      for (const file of files) {
        const quizId = file.replace(".json", "");
        const quizPath = join(quizzesDir, file);

        try {
          const quizData = JSON.parse(await Bun.file(quizPath).text());

          // Проверяем, есть ли уже такой тест в базе
          const existingQuiz = this.queries.getQuiz.get(quizId);
          if (!existingQuiz) {
            this.queries.insertQuiz.run(
              quizId,
              quizData.settings.title,
              JSON.stringify(quizData.settings),
              JSON.stringify(quizData.questions)
            );
            console.log(`Loaded quiz: ${quizData.settings.title}`);
          }
        } catch (error) {
          console.error(`Error loading quiz ${file}:`, error);
        }
      }
    } catch (error) {
      console.error("Error reading quizzes directory:", error);
    }
  }

  // Загрузка существующих результатов из JSON файлов в базу данных
  async loadExistingResults() {
    const resultsDir = join(import.meta.dir, "results");
    if (!existsSync(resultsDir)) {
      return;
    }

    try {
      const files = readdirSync(resultsDir).filter((file) =>
        file.endsWith(".json")
      );

      for (const file of files) {
        const quizId = file.replace(".json", "");

        try {
          const resultsPath = join(resultsDir, file);
          const resultsData = JSON.parse(await Bun.file(resultsPath).text());

          for (const result of resultsData) {
            // Находим или создаем студента
            let student = this.queries.getStudent.get(
              result.name,
              quizId,
              result.ip
            );
            if (!student) {
              this.queries.insertStudent.run(result.name, quizId, result.ip);
              student = this.queries.getStudent.get(
                result.name,
                quizId,
                result.ip
              );
            }

            // Вставляем результат
            this.queries.insertResult.run(
              student.id,
              quizId,
              JSON.stringify(result.results),
              result.attempts || 1,
              result.averageScore || 0,
              result.totalScore || 0,
              result.correctCount || 0,
              result.autoSaved || false,
              result.timeExpired || false
            );
          }

          console.log(`Loaded results for quiz: ${quizId}`);
        } catch (error) {
          console.error(`Error loading results ${file}:`, error);
        }
      }
    } catch (error) {
      console.error("Error reading results directory:", error);
    }
  }

  // Инициализация и загрузка данных
  async initialize() {
    await this.loadExistingQuizzes();
    await this.loadExistingResults();
  }

  // Методы для работы с тестами
  getAvailableQuizzes() {
    const quizzes = this.queries.getAllQuizzes.all();
    return quizzes.map((quiz) => {
      const settings = JSON.parse(quiz.settings);
      const questions = JSON.parse(quiz.questions);

      return {
        id: quiz.id,
        title: quiz.title,
        maxAttempts: settings.maxAttempts,
        totalQuestions: questions.length,
        randomQuestionsCount: settings.randomQuestionsCount,
        students: settings.students || [],
      };
    });
  }

  getQuiz(quizId) {
    const quiz = this.queries.getQuiz.get(quizId);
    if (!quiz) {
      return null;
    }

    return {
      id: quiz.id,
      title: quiz.title,
      settings: JSON.parse(quiz.settings),
      questions: JSON.parse(quiz.questions),
    };
  }

  // Методы для работы с сессиями
  createSession(studentName, quizId, ip, questions) {
    // Находим или создаем студента
    let student = this.queries.getStudent.get(studentName, quizId, ip);
    if (!student) {
      this.queries.insertStudent.run(studentName, quizId, ip);
      student = this.queries.getStudent.get(studentName, quizId, ip);
    }

    const startTime = Date.now();
    this.queries.insertSession.run(
      student.id,
      quizId,
      startTime,
      "{}",
      JSON.stringify(questions)
    );

    return { student, startTime };
  }

  getSession(studentName, quizId, ip) {
    return this.queries.getSession.get(studentName, quizId, ip);
  }

  updateSessionAnswers(sessionId, answers) {
    this.queries.updateSessionAnswers.run(JSON.stringify(answers), sessionId);
  }

  deleteSession(sessionId) {
    this.queries.deleteSession.run(sessionId);
  }

  getAllSessions() {
    return this.queries.getAllSessions.all();
  }

  // Методы для работы с результатами
  getResult(studentName, quizId, ip) {
    return this.queries.getResult.get(studentName, quizId, ip);
  }

  saveResult(
    studentId,
    quizId,
    results,
    attempts,
    averageScore,
    totalScore,
    correctCount,
    autoSaved = false,
    timeExpired = false
  ) {
    this.queries.insertResult.run(
      studentId,
      quizId,
      JSON.stringify(results),
      attempts,
      averageScore,
      totalScore,
      correctCount,
      autoSaved,
      timeExpired
    );
  }

  updateResult(
    studentId,
    quizId,
    results,
    attempts,
    averageScore,
    totalScore,
    correctCount,
    autoSaved = false,
    timeExpired = false
  ) {
    this.queries.updateResult.run(
      JSON.stringify(results),
      attempts,
      averageScore,
      totalScore,
      correctCount,
      autoSaved,
      timeExpired,
      studentId,
      quizId
    );
  }

  getResultsByQuiz(quizId) {
    return this.queries.getResultsByQuiz.all(quizId);
  }

  // Методы для работы с пользователями
  createUser(username, passwordHash, email, fullName, role = "student") {
    try {
      return this.queries.insertUser.run(
        username,
        passwordHash,
        email,
        fullName,
        role
      );
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error("Користувач з таким логіном вже існує");
      }
      throw error;
    }
  }

  getUserByUsername(username) {
    return this.queries.getUserByUsername.get(username);
  }

  getUserById(id) {
    return this.queries.getUserById.get(id);
  }

  updateLastLogin(userId) {
    this.queries.updateLastLogin.run(userId);
  }

  // Методы для работы с сессиями
  createUserSession(userId, tokenHash, expiresAt) {
    return this.queries.insertUserSession.run(userId, tokenHash, expiresAt);
  }

  getUserSession(tokenHash) {
    return this.queries.getUserSession.get(tokenHash);
  }

  deleteUserSession(tokenHash) {
    this.queries.deleteUserSession.run(tokenHash);
  }

  cleanExpiredSessions() {
    this.queries.deleteExpiredSessions.run();
  }

  // Закрытие соединения с базой данных
  close() {
    this.db.close();
  }
}

export default DatabaseManager;
