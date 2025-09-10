import DatabaseManager from "./database.js";
import { AuthManager } from "./auth.js";
import { createHash } from "crypto";

async function createAdmin() {
  const db = new DatabaseManager();
  await db.initialize();

  const auth = new AuthManager(db);

  // Створюємо адміністратора
  const adminUsername = "admin";
  const adminPassword = "admin123"; // В продакшені використовуйте складніший пароль
  const adminEmail = "admin@example.com";
  const adminFullName = "Адміністратор";

  try {
    // Перевіряємо, чи існує вже адміністратор
    const existingAdmin = db.getUserByUsername(adminUsername);
    if (existingAdmin) {
      console.log("Адміністратор вже існує!");
      console.log(`Логін: ${adminUsername}`);
      console.log(`Пароль: ${adminPassword}`);
      return;
    }

    // Хешуємо пароль
    const passwordHash = createHash("sha256")
      .update(adminPassword)
      .digest("hex");

    // Створюємо користувача з роллю адміністратора
    db.createUser(
      adminUsername,
      passwordHash,
      adminEmail,
      adminFullName,
      "admin"
    );

    console.log("Адміністратор успішно створений!");
    console.log(`Логін: ${adminUsername}`);
    console.log(`Пароль: ${adminPassword}`);
    console.log(
      "Увійдіть в систему та перейдіть на /admin для доступу до панелі адміністратора"
    );
  } catch (error) {
    console.error("Помилка створення адміністратора:", error);
  } finally {
    db.close();
  }
}

createAdmin();
