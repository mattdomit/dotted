import { Router } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { prisma } from "@dotted/db";
import { registerSchema, loginSchema, verifyCodeSchema, resendVerificationSchema, UserRole } from "@dotted/shared";
import { validate } from "../middleware/validate";
import { authenticate, signToken } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { isOAuthConfigured } from "../lib/passport";
import { loginLimiter, registerLimiter } from "../middleware/rate-limit";
import { generateVerificationCode, verifyCode, canResend } from "../services/verification";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, role, phoneNumber } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("Email already registered", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash, phoneNumber },
      select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as unknown as UserRole,
      emailVerified: false,
    });

    // Send verification code
    generateVerificationCode(user.id, "EMAIL").catch(() => {});

    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid credentials", 401);

    if (!user.passwordHash) {
      throw new AppError("This account uses Google sign-in. Please use the Google button to log in.", 400);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError("Invalid credentials", 401);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as unknown as UserRole,
      emailVerified: user.emailVerified,
    });
    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify", authenticate, validate(verifyCodeSchema), async (req, res, next) => {
  try {
    const { code, type } = req.body;
    const verified = await verifyCode(req.user!.userId, code, type);
    if (!verified) throw new AppError("Invalid or expired verification code", 400);

    // Issue new token with emailVerified: true
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError("User not found", 404);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as unknown as UserRole,
      emailVerified: true,
    });

    res.json({ success: true, data: { token, emailVerified: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/resend-verification", authenticate, validate(resendVerificationSchema), async (req, res, next) => {
  try {
    const { type } = req.body;
    const allowed = await canResend(req.user!.userId, type);
    if (!allowed) throw new AppError("Please wait before requesting another code", 429);

    await generateVerificationCode(req.user!.userId, type);
    res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, emailVerified: true, createdAt: true },
    });
    if (!user) throw new AppError("User not found", 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// Google OAuth routes
authRouter.get("/google", (req, res, next) => {
  if (!isOAuthConfigured()) {
    return next(new AppError("Google OAuth is not configured", 501));
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    if (!isOAuthConfigured()) {
      return next(new AppError("Google OAuth is not configured", 501));
    }
    passport.authenticate("google", { session: false, failureRedirect: "/login" }, (err: Error | null, data: { user: { id: string }; token: string } | false) => {
      if (err || !data) {
        return res.redirect(`${process.env.WEB_URL || "http://localhost:3000"}/login?error=oauth_failed`);
      }
      res.redirect(`${process.env.WEB_URL || "http://localhost:3000"}/login?token=${data.token}`);
    })(req, res, next);
  }
);
