# Система для тестування учнів

## Installation and start

### 1. Bun

```bash
# Windows (PowerShell)
irm bun.sh/install.ps1 | iex

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

### 2. Installing dependencies

```bash
# Installing server dependencies
bun install

# Installing client dependencies
cd client
bun install
cd ..
```

### 3. Run in development mode

```bash
# Running the server and client simultaneously
bun run dev
```

Or separately:

```bash
# Server (port 3000)
bun run server

# React application (port 3001)
bun run client
```

### 4. Build

```bash
# Building a React application
bun run build

# Start the server
bun start
```

### 5. Create admin account

```sh
bun ./create-admin.js
```

## Project structure

- `index.js` - Server
- `client/` - React app
- `quizzes/` - Quizzes, tests
- `results/` - Saved results

## Підтримка зображень у запитах

### Додавання зображень до запитань

Система підтримує зображення з зовнішніх файлообмінників. Для додавання зображення до питання, додайте поле `image` до об'єкта питання в JSON файлі:

```json
{
  "id": 1,
  "question": "Що зображено на цьому фото?",
  "type": "multiple_choice",
  "options": ["Варіант 1", "Варіант 2", "Варіант 3", "Варіант 4"],
  "answer": "Варіант 1",
  "image": "https://example.com/image.jpg"
}
```

### Рекомендовані файлообмінники

#### 1. Google Drive

1. Завантажте зображення на Google Drive
2. Відкрийте файл → "Поделиться" → "Копировать ссылку"
3. Замініть `file/d/` на `uc?export=view&id=` в URL
4. Використовуйте отриманий URL

**Приклад:**
