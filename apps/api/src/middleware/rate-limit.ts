import rateLimit from "express-rate-limit";

const isProduction = process.env.NODE_ENV === "production";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, error: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});
