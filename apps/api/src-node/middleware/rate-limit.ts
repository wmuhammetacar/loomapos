import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT",
    message: "Too many auth requests, try again shortly"
  }
});

export const defaultRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT",
    message: "Too many requests"
  }
});

export const mutationRateLimit = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    ["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) || req.path === "/webhook",
  message: {
    error: "RATE_LIMIT",
    message: "Too many write requests"
  }
});

export const adminMutationRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()),
  message: {
    error: "RATE_LIMIT",
    message: "Too many admin mutation requests"
  }
});
