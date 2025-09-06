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

## Project structure

- `index.js` - Server
- `client/` - React app
- `quizzes/` - Quizzes, tests
- `results/` - Saved results
