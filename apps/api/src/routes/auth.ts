import { Router } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { prisma } from "@dotted/db";
import { registerSchema, loginSchema, UserRole } from "@dotted/shared";
import { validate } from "../middleware/validate";
import { authenticate, signToken } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { isOAuthConfigured } from "../lib/passport";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("Email already registered", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role as unknown as UserRole });
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid credentials", 401);

    if (!user.passwordHash) {
      throw new AppError("This account uses Google sign-in. Please use the Google button to log in.", 400);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError("Invalid credentials", 401);

    const token = signToken({ userId: user.id, email: user.email, role: user.role as unknown as UserRole });
    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
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
