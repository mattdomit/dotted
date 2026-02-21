import { Router } from "express";
import { prisma } from "@dotted/db";
import { createZonePostSchema, createPostCommentSchema } from "@dotted/shared";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const feedRouter = Router();

// GET /zones/:id/feed — aggregated zone feed
feedRouter.get("/zones/:id/feed", async (req, res, next) => {
  try {
    const zoneId = req.params.id as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 20);
    const skip = (page - 1) * pageSize;

    const [posts, total] = await Promise.all([
      prisma.zonePost.findMany({
        where: { zoneId },
        include: {
          user: { select: { name: true, avatarUrl: true } },
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.zonePost.count({ where: { zoneId } }),
    ]);

    const enriched = posts.map((p) => ({
      ...p,
      commentCount: p._count.comments,
      likeCount: p._count.likes,
    }));

    res.json({
      success: true,
      data: enriched,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

// POST /zones/:id/posts — create a zone post
feedRouter.post(
  "/zones/:id/posts",
  authenticate,
  validate(createZonePostSchema),
  async (req, res, next) => {
    try {
      const zoneId = req.params.id as string;
      const { body, imageUrl } = req.body;

      // Verify zone exists
      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) throw new AppError("Zone not found", 404);

      const post = await prisma.zonePost.create({
        data: {
          zoneId,
          userId: req.user!.userId,
          body,
          imageUrl,
        },
        include: {
          user: { select: { name: true, avatarUrl: true } },
        },
      });

      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }
);

// POST /posts/:id/comment — add a comment (supports parentId for threads)
feedRouter.post(
  "/posts/:id/comment",
  authenticate,
  validate(createPostCommentSchema),
  async (req, res, next) => {
    try {
      const postId = req.params.id as string;
      const { body, parentId } = req.body;

      const post = await prisma.zonePost.findUnique({ where: { id: postId } });
      if (!post) throw new AppError("Post not found", 404);

      // If replying to a comment, verify it exists and belongs to this post
      if (parentId) {
        const parentComment = await prisma.postComment.findUnique({ where: { id: parentId } });
        if (!parentComment || parentComment.postId !== postId) {
          throw new AppError("Parent comment not found", 404);
        }
      }

      const comment = await prisma.postComment.create({
        data: {
          postId,
          userId: req.user!.userId,
          body,
          parentId,
        },
        include: {
          user: { select: { name: true, avatarUrl: true } },
        },
      });

      res.status(201).json({ success: true, data: comment });
    } catch (err) {
      next(err);
    }
  }
);

// POST /posts/:id/like — toggle like
feedRouter.post("/posts/:id/like", authenticate, async (req, res, next) => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await prisma.zonePost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError("Post not found", 404);

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      res.json({ success: true, data: { liked: false } });
    } else {
      await prisma.postLike.create({ data: { postId, userId } });
      res.json({ success: true, data: { liked: true } });
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /posts/:id — delete own post
feedRouter.delete("/posts/:id", authenticate, async (req, res, next) => {
  try {
    const postId = req.params.id as string;

    const post = await prisma.zonePost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError("Post not found", 404);
    if (post.userId !== req.user!.userId) {
      throw new AppError("You can only delete your own posts", 403);
    }

    await prisma.zonePost.delete({ where: { id: postId } });
    res.json({ success: true, message: "Post deleted" });
  } catch (err) {
    next(err);
  }
});

// GET /posts/:id/comments — get comments for a post (threaded)
feedRouter.get("/posts/:id/comments", async (req, res, next) => {
  try {
    const comments = await prisma.postComment.findMany({
      where: { postId: req.params.id as string, parentId: null },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        children: {
          include: {
            user: { select: { name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: comments });
  } catch (err) {
    next(err);
  }
});
