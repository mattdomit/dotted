import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@dotted/shared";
import { AppError } from "./error-handler";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "dev-secret";

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  try {
    const payload = verifyToken(header.slice(7));
    // Backwards-compat: tokens issued before v1.5 won't have emailVerified
    if (payload.emailVerified === undefined) {
      payload.emailVerified = false;
    }
    req.user = payload;
    next();
  } catch {
    next(new AppError("Invalid token", 401));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentication required", 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
}

export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError("Authentication required", 401));
  if (!req.user.emailVerified) {
    return next(new AppError("Email verification required", 403));
  }
  next();
}
