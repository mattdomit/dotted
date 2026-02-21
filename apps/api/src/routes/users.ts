import { Router } from "express";
import { prisma } from "@dotted/db";
import { updateDietaryPreferencesSchema, updateProfileSchema, BADGES } from "@dotted/shared";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const userRouter = Router();

// PATCH /me/dietary — update dietary preferences
userRouter.patch(
  "/me/dietary",
  authenticate,
  validate(updateDietaryPreferencesSchema),
  async (req, res, next) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { dietaryPreferences: req.body.dietaryPreferences },
        select: { id: true, dietaryPreferences: true },
      });
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /me/profile — update bio, phoneNumber
userRouter.patch(
  "/me/profile",
  authenticate,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const { bio, phoneNumber } = req.body;
      const data: Record<string, string | undefined> = {};
      if (bio !== undefined) data.bio = bio;
      if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data,
        select: { id: true, bio: true, phoneNumber: true },
      });
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/profile — public user profile with badges
userRouter.get("/:id/profile", async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        role: true,
        dietaryPreferences: true,
        createdAt: true,
      },
    });
    if (!user) throw new AppError("User not found", 404);

    // Compute badges
    const badges: string[] = [];

    const voteCount = await prisma.vote.count({ where: { userId } });
    if (voteCount >= 1) badges.push(BADGES.first_vote.name);

    const reviewCount = await prisma.review.count({ where: { userId } });
    if (reviewCount >= 1) badges.push(BADGES.first_review.name);
    if (reviewCount >= 10) badges.push(BADGES.ten_reviews.name);

    // Founding member: joined within first 30 days of platform (approximate)
    const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
    if (firstUser) {
      const thirtyDaysAfter = new Date(firstUser.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (user.createdAt <= thirtyDaysAfter) badges.push(BADGES.founding_member.name);
    }

    const helpfulVotes = await prisma.reviewVote.count({
      where: { review: { userId }, helpful: true },
    });
    if (helpfulVotes >= 10) badges.push(BADGES.helpful_reviewer.name);

    const postCount = await prisma.zonePost.count({ where: { userId } });
    if (postCount >= 10) badges.push(BADGES.community_contributor.name);

    res.json({
      success: true,
      data: {
        ...user,
        badges,
        reviewCount,
        postCount,
      },
    });
  } catch (err) {
    next(err);
  }
});
