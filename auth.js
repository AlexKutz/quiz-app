import crypto from "crypto";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 години

export class AuthManager {
  constructor(db) {
    this.db = db;
  }

  // Хешування пароля
  hashPassword(password) {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  // Перевірка пароля
  verifyPassword(password, hashedPassword) {
    return this.hashPassword(password) === hashedPassword;
  }

  // Створення токена
  createToken(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${userId}_${timestamp}_${random}`;
  }

  // Реєстрація користувача
  async register(fullName, password) {
    if (!fullName || !password) {
      throw new Error("Повне ім'я та пароль є обов'язковими");
    }

    if (password.length < 6) {
      throw new Error("Пароль повинен містити щонайменше 6 символів");
    }

    const hashedPassword = this.hashPassword(password);

    try {
      const result = this.db.createUser(
        fullName,
        hashedPassword,
        null,
        fullName
      );
      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      throw error;
    }
  }

  // Авторизація користувача
  async login(fullName, password) {
    // Спочатку шукаємо за username, потім за full_name
    let user = this.db.getUserByUsername(fullName);

    if (!user) {
      // Якщо не знайшли за username, шукаємо за full_name
      const allUsers = this.db.queries.getAllUsers?.all() || [];
      user = allUsers.find((u) => u.full_name === fullName);
    }

    if (!user) {
      throw new Error("Невірне ім'я або пароль");
    }

    if (!this.verifyPassword(password, user.password_hash)) {
      throw new Error("Невірне ім'я або пароль");
    }

    // Створюємо токен
    const token = this.createToken(user.id);
    const tokenHash = this.hashPassword(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY).toISOString();

    // Зберігаємо сесію в БД
    this.db.createUserSession(user.id, tokenHash, expiresAt);

    // Оновлюємо час останнього входу
    this.db.updateLastLogin(user.id);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    };
  }

  // Перевірка автентифікації
  authenticate(token) {
    if (!token) {
      return null;
    }

    // Перевіряємо сесію в БД
    const tokenHash = this.hashPassword(token);
    const session = this.db.getUserSession(tokenHash);

    if (!session) {
      return null;
    }

    return {
      id: session.user_id,
      username: session.username,
      fullName: session.username, // Використовуємо username як fullName для сумісності
      role: session.role,
    };
  }

  // Вихід з системи
  logout(token) {
    if (!token) {
      return;
    }

    const tokenHash = this.hashPassword(token);
    this.db.deleteUserSession(tokenHash);
  }

  // Очищення старих сесій
  cleanupSessions() {
    this.db.cleanExpiredSessions();
  }
}
