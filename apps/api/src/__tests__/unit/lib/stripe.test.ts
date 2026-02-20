import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

describe("Stripe lib", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("returns null when STRIPE_SECRET_KEY is not set", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import("../../../lib/stripe");
    expect(getStripe()).toBeNull();
  });

  it("returns a Stripe instance when STRIPE_SECRET_KEY is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const { getStripe } = await import("../../../lib/stripe");
    const stripe = getStripe();
    expect(stripe).not.toBeNull();
  });

  it("returns the same instance on subsequent calls", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const { getStripe } = await import("../../../lib/stripe");
    const s1 = getStripe();
    const s2 = getStripe();
    expect(s1).toBe(s2);
  });
});
