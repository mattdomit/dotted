import { prisma } from "@dotted/db";

/**
 * Truncates all tables in FK-safe order using CASCADE.
 * Call between test files or in beforeEach to ensure a clean state.
 */
export async function cleanDatabase() {
  await prisma.$transaction([
    // v2.0 models first
    prisma.userPreferenceSignal.deleteMany(),
    prisma.achievement.deleteMany(),
    prisma.qualityScore.deleteMany(),
    prisma.subscription.deleteMany(),
    // New social/community models
    prisma.postLike.deleteMany(),
    prisma.postComment.deleteMany(),
    prisma.zonePost.deleteMany(),
    prisma.reviewVote.deleteMany(),
    prisma.reviewReply.deleteMany(),
    prisma.deliveryTracking.deleteMany(),
    prisma.verificationCode.deleteMany(),
    // Original models
    prisma.notification.deleteMany(),
    prisma.review.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.vote.deleteMany(),
    prisma.bid.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.dish.deleteMany(),
    prisma.dailyCycle.deleteMany(),
    prisma.supplierInventory.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.zoneMembership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.zone.deleteMany(),
  ]);
}
