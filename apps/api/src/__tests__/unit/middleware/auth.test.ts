import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { signToken, verifyToken, authenticate, requireRole, AuthPayload } from "../../../middleware/auth";
import { UserRole } from "@dotted/shared";

describe("Auth Middleware", () => {
  describe("signToken / verifyToken roundtrip", () => {
    it("should sign and verify a token successfully", () => {
      const payload: AuthPayload = { userId: "user-1", email: "test@test.com", role: UserRole.CONSUMER };
      const token = signToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it("should include iat and exp in the token", () => {
      const payload: AuthPayload = { userId: "user-1", email: "test@test.com", role: UserRole.ADMIN };
      const token = signToken(payload);
      const decoded = verifyToken(token) as any;

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it("should reject a tampered token", () => {
      const payload: AuthPayload = { userId: "user-1", email: "test@test.com", role: UserRole.CONSUMER };
      const token = signToken(payload);
      const tampered = token.slice(0, -5) + "XXXXX";

      expect(() => verifyToken(tampered)).toThrow();
    });

    it("should reject a completely invalid token", () => {
      expect(() => verifyToken("not.a.real.token")).toThrow();
    });
  });

  describe("authenticate middleware", () => {
    function makeMocks(authHeader?: string) {
      const req = { headers: { authorization: authHeader } } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;
      return { req, res, next };
    }

    it("should set req.user when valid token is provided", () => {
      const payload: AuthPayload = { userId: "user-1", email: "test@test.com", role: UserRole.CONSUMER };
      const token = signToken(payload);
      const { req, res, next } = makeMocks(`Bearer ${token}`);

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user!.userId).toBe("user-1");
    });

    it("should return 401 when no authorization header", () => {
      const { req, res, next } = makeMocks(undefined);

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it("should return 401 when header does not start with Bearer", () => {
      const { req, res, next } = makeMocks("Basic abc123");

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it("should return 401 when token is invalid", () => {
      const { req, res, next } = makeMocks("Bearer invalid.token.here");

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });

  describe("requireRole middleware", () => {
    function makeMocks(user?: AuthPayload) {
      const req = { user } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;
      return { req, res, next };
    }

    it("should pass when user has the required role", () => {
      const { req, res, next } = makeMocks({ userId: "u1", email: "a@b.com", role: UserRole.ADMIN });
      const middleware = requireRole(UserRole.ADMIN);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("should pass when user has one of multiple allowed roles", () => {
      const { req, res, next } = makeMocks({ userId: "u1", email: "a@b.com", role: UserRole.SUPPLIER });
      const middleware = requireRole(UserRole.ADMIN, UserRole.SUPPLIER);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("should return 403 when user has wrong role", () => {
      const { req, res, next } = makeMocks({ userId: "u1", email: "a@b.com", role: UserRole.CONSUMER });
      const middleware = requireRole(UserRole.ADMIN);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it("should return 401 when user is not authenticated", () => {
      const { req, res, next } = makeMocks(undefined);
      const middleware = requireRole(UserRole.ADMIN);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });
});
