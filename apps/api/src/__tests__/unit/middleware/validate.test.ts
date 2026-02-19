import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validate } from "../../../middleware/validate";

const testSchema = z.object({
  name: z.string().min(2),
  age: z.number().int().positive(),
});

function makeMocks(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("validate middleware", () => {
  it("should pass validation with correct data", () => {
    const { req, res, next } = makeMocks({ name: "Alice", age: 25 });
    const middleware = validate(testSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "Alice", age: 25 });
  });

  it("should replace req.body with parsed data (strips extra fields)", () => {
    const { req, res, next } = makeMocks({ name: "Bob", age: 30, extra: "field" });
    const middleware = validate(testSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "Bob", age: 30 });
    expect(req.body.extra).toBeUndefined();
  });

  it("should return 400 when required field is missing", () => {
    const { req, res, next } = makeMocks({ name: "Alice" });
    const middleware = validate(testSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("should return 400 with field path in error message", () => {
    const { req, res, next } = makeMocks({ name: "A", age: -1 });
    const middleware = validate(testSchema);

    middleware(req, res, next);

    const error = (next as any).mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain("name");
  });

  it("should return 400 when body is wrong type", () => {
    const { req, res, next } = makeMocks({ name: 123, age: "not a number" });
    const middleware = validate(testSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("should return 400 when body is empty", () => {
    const { req, res, next } = makeMocks({});
    const middleware = validate(testSchema);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});
