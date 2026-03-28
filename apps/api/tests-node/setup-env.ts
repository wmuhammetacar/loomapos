const baseEnv = {
  NODE_ENV: "test",
  PORT: "5001",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  INTERNAL_ADMIN_TOKEN: "test-internal-admin-token-should-be-long-enough",
  JWT_ACCESS_SECRET: "test-access-secret-should-be-long-enough",
  JWT_REFRESH_SECRET: "test-refresh-secret-should-be-long-enough",
  JWT_ACCESS_TTL_MIN: "15",
  JWT_REFRESH_TTL_DAYS: "30",
  PAYMENT_PROVIDER: "mock",
  PAYMENT_WEBHOOK_SECRET: "test-webhook-secret",
  ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  OFFLINE_GRACE_HOURS: "72"
};

for (const [key, value] of Object.entries(baseEnv)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
