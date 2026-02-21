import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestZonePost } from "../helpers/fixtures";
import { prisma } from "@dotted/db";

const app = createApp();

describe("Community Feed", () => {
  let consumerToken: string;
  let consumer2Token: string;
  let consumerId: string;
  let consumer2Id: string;
  let zoneId: string;

  beforeEach(async () => {
    await cleanDatabase();

    const zone = await createTestZone();
    zoneId = zone.id;

    const { token: t1, user: u1 } = await createTestUser(UserRole.CONSUMER);
    const { token: t2, user: u2 } = await createTestUser(UserRole.CONSUMER);
    consumerToken = t1;
    consumer2Token = t2;
    consumerId = u1.id;
    consumer2Id = u2.id;
  });

  it("create a zone post", async () => {
    const res = await request(app)
      .post(`/api/feed/zones/${zoneId}/posts`)
      .set(getAuthHeader(consumerToken))
      .send({ body: "Hello from the community!" });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("Hello from the community!");
    expect(res.body.data.user.name).toBeDefined();
  });

  it("get zone feed with posts", async () => {
    await createTestZonePost(zoneId, consumerId, "Post 1");
    await createTestZonePost(zoneId, consumer2Id, "Post 2");

    const res = await request(app).get(`/api/feed/zones/${zoneId}/feed`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("add comment to post", async () => {
    const post = await createTestZonePost(zoneId, consumerId, "Test post");

    const res = await request(app)
      .post(`/api/feed/posts/${post.id}/comment`)
      .set(getAuthHeader(consumer2Token))
      .send({ body: "Great post!" });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("Great post!");
  });

  it("threaded comments", async () => {
    const post = await createTestZonePost(zoneId, consumerId, "Parent post");

    // Top-level comment
    const parentRes = await request(app)
      .post(`/api/feed/posts/${post.id}/comment`)
      .set(getAuthHeader(consumer2Token))
      .send({ body: "Top level" });

    const parentCommentId = parentRes.body.data.id;

    // Reply to comment
    const childRes = await request(app)
      .post(`/api/feed/posts/${post.id}/comment`)
      .set(getAuthHeader(consumerToken))
      .send({ body: "Reply to comment", parentId: parentCommentId });

    expect(childRes.status).toBe(201);
    expect(childRes.body.data.parentId).toBe(parentCommentId);

    // Get threaded comments
    const commentsRes = await request(app).get(`/api/feed/posts/${post.id}/comments`);
    expect(commentsRes.status).toBe(200);
    expect(commentsRes.body.data).toHaveLength(1); // Only top-level
    expect(commentsRes.body.data[0].children).toHaveLength(1);
    expect(commentsRes.body.data[0].children[0].body).toBe("Reply to comment");
  });

  it("toggle like on post", async () => {
    const post = await createTestZonePost(zoneId, consumerId, "Likeable post");

    // Like
    const likeRes = await request(app)
      .post(`/api/feed/posts/${post.id}/like`)
      .set(getAuthHeader(consumer2Token));

    expect(likeRes.status).toBe(200);
    expect(likeRes.body.data.liked).toBe(true);

    // Unlike
    const unlikeRes = await request(app)
      .post(`/api/feed/posts/${post.id}/like`)
      .set(getAuthHeader(consumer2Token));

    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.data.liked).toBe(false);
  });

  it("delete own post", async () => {
    const post = await createTestZonePost(zoneId, consumerId, "My post");

    const res = await request(app)
      .delete(`/api/feed/posts/${post.id}`)
      .set(getAuthHeader(consumerToken));

    expect(res.status).toBe(200);

    // Verify deleted
    const dbPost = await prisma.zonePost.findUnique({ where: { id: post.id } });
    expect(dbPost).toBeNull();
  });

  it("cannot delete another user's post", async () => {
    const post = await createTestZonePost(zoneId, consumerId, "Not yours");

    const res = await request(app)
      .delete(`/api/feed/posts/${post.id}`)
      .set(getAuthHeader(consumer2Token));

    expect(res.status).toBe(403);
  });

  it("feed is paginated", async () => {
    for (let i = 0; i < 5; i++) {
      await createTestZonePost(zoneId, consumerId, `Post ${i}`);
    }

    const res = await request(app).get(`/api/feed/zones/${zoneId}/feed?page=1&pageSize=2`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
  });
});
