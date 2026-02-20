import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import { cleanDatabase } from "../../helpers/db";
import { createTestUser } from "../../helpers/auth";

// Mock Resend
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "email_123" }) },
  })),
}));

// Mock socket.io
vi.mock("../../../socket/handlers", () => ({
  getIO: vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
  }),
}));

const { notify } = await import("../../../services/notifications");
const { getIO } = await import("../../../socket/handlers");

describe("Notification Service", () => {
  let userId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const { user } = await createTestUser(UserRole.CONSUMER);
    userId = user.id;
    vi.clearAllMocks();
  });

  it("should create a notification in the database", async () => {
    const notif = await notify({
      userId,
      type: "ORDER_CREATED",
      title: "Order Placed",
      body: "Your order has been placed.",
      channels: ["IN_APP"],
    });

    expect(notif.id).toBeDefined();
    expect(notif.userId).toBe(userId);
    expect(notif.type).toBe("ORDER_CREATED");
    expect(notif.status).toBe("SENT");

    const dbNotif = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(dbNotif).not.toBeNull();
  });

  it("should emit socket.io event for IN_APP channel", async () => {
    await notify({
      userId,
      type: "CYCLE_PHASE",
      title: "Voting Open",
      body: "Cast your vote now!",
      channels: ["IN_APP"],
    });

    const io = getIO();
    expect(io?.to).toHaveBeenCalledWith(`user:${userId}`);
  });

  it("should store metadata", async () => {
    const notif = await notify({
      userId,
      type: "BID_WON",
      title: "Bid Won!",
      body: "Your restaurant was selected.",
      channels: ["IN_APP"],
      metadata: { cycleId: "cycle-123", bidId: "bid-456" },
    });

    const dbNotif = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(dbNotif?.metadata).toEqual({ cycleId: "cycle-123", bidId: "bid-456" });
  });
});
