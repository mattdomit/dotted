import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { AppError, errorHandler } from "../../../middleware/error-handler";

function makeMocks() {
  const req = {} as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("error-handler middleware", () => {
  describe("AppError", () => {
    it("should have correct statusCode and message", () => {
      const err = new AppError("Not found", 404);
      expect(err.message).toBe("Not found");
      expect(err.statusCode).toBe(404);
      expect(err).toBeInstanceOf(Error);
    });

    it("should default to 400 if no status provided", () => {
      const err = new AppError("Bad request");
      expect(err.statusCode).toBe(400);
    });
  });

  describe("errorHandler", () => {
    it("should return AppError status and message", () => {
      const { req, res, next } = makeMocks();
      const err = new AppError("Duplicate entry", 409);

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Duplicate entry" });
    });

    it("should return 500 for non-AppError", () => {
      const { req, res, next } = makeMocks();
      const err = new Error("Something broke");

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Internal server error" });
    });

    it("should return 500 for TypeError", () => {
      const { req, res, next } = makeMocks();
      const err = new TypeError("Cannot read property 'x' of undefined");

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("should not expose internal error message for generic errors", () => {
      const { req, res, next } = makeMocks();
      const err = new Error("DB connection string leaked");

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Internal server error" })
      );
    });
  });
});
