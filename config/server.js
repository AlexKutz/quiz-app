export const SERVER_CONFIG = {
  PORT: 3000,
  HOSTNAME: "0.0.0.0",
  SESSION_CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 минут
  SESSION_CHECK_INTERVAL: 30 * 1000, // 30 секунд
  SESSION_CHECK_DELAY: 5 * 1000, // 5 секунд
};

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
