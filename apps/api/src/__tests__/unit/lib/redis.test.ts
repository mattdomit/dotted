import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockKeys = vi.fn();
const mockDel = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    keys: mockKeys,
    del: mockDel,
    connect: mockConnect,
  })),
}));

describe("Redis lib", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockKeys.mockReset();
    mockDel.mockReset();
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it("cacheGet returns null when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { cacheGet } = await import("../../../lib/redis");
    const result = await cacheGet("test-key");
    expect(result).toBeNull();
  });

  it("cacheSet does nothing when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { cacheSet } = await import("../../../lib/redis");
    await cacheSet("test-key", { value: 1 }, 60);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("cacheInvalidate does nothing when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { cacheInvalidate } = await import("../../../lib/redis");
    await cacheInvalidate("test:*");
    expect(mockKeys).not.toHaveBeenCalled();
  });

  it("cacheGet returns parsed data when Redis has the key", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { cacheGet } = await import("../../../lib/redis");
    mockGet.mockResolvedValue(JSON.stringify({ value: 42 }));

    const result = await cacheGet<{ value: number }>("test-key");
    expect(result).toEqual({ value: 42 });
  });

  it("cacheGet returns null when key not found", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { cacheGet } = await import("../../../lib/redis");
    mockGet.mockResolvedValue(null);

    const result = await cacheGet("missing-key");
    expect(result).toBeNull();
  });

  it("cacheSet calls Redis set with TTL", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { cacheSet } = await import("../../../lib/redis");
    mockSet.mockResolvedValue("OK");

    await cacheSet("test-key", { data: "hello" }, 300);
    expect(mockSet).toHaveBeenCalledWith(
      "test-key",
      JSON.stringify({ data: "hello" }),
      "EX",
      300
    );
  });

  it("cacheInvalidate deletes matching keys", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { cacheInvalidate } = await import("../../../lib/redis");
    mockKeys.mockResolvedValue(["cycle:status:1", "cycle:status:2"]);
    mockDel.mockResolvedValue(2);

    await cacheInvalidate("cycle:status:*");
    expect(mockKeys).toHaveBeenCalledWith("cycle:status:*");
    expect(mockDel).toHaveBeenCalledWith("cycle:status:1", "cycle:status:2");
  });

  it("cacheInvalidate does nothing when no keys match", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { cacheInvalidate } = await import("../../../lib/redis");
    mockKeys.mockResolvedValue([]);

    await cacheInvalidate("nonexistent:*");
    expect(mockDel).not.toHaveBeenCalled();
  });
});
