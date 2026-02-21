import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestRestaurant } from "../helpers/fixtures";
import { prisma } from "@dotted/db";

const app = createApp();

describe("Review Social Features", () => {
  let consumerToken: string;
  let consumer2Token: string;
  let restaurantId: string;
  let reviewId: string;

  beforeEach(async () => {
    await cleanDatabase();

    const zone = await createTestZone();
    const { token: t1 } = await createTestUser(UserRole.CONSUMER);
    const { token: t2 } = await createTestUser(UserRole.CONSUMER);
    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zone.id);

    consumerToken = t1;
    consumer2Token = t2;
    restaurantId = restaurant.id;

    // Create a review
    const res = await request(app)
      .post("/api/reviews")
      .set(getAuthHeader(consumerToken))
      .send({
        restaurantId,
        rating: 4,
        title: "Great food!",
        body: "Really enjoyed the meal, would come back again.",
        imageUrls: ["https://example.com/photo1.jpg"],
      });
    reviewId = res.body.data.id;
  });

  it("create review with imageUrls", async () => {
    const res = await request(app)
      .get(`/api/reviews/restaurant/${restaurantId}`);

    expect(res.status).toBe(200);
    const review = res.body.data.reviews.find((r: any) => r.id === reviewId);
    expect(review.imageUrls).toEqual(["https://example.com/photo1.jpg"]);
  });

  it("create reply on review", async () => {
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/reply`)
      .set(getAuthHeader(consumer2Token))
      .send({ body: "Thanks for sharing!" });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("Thanks for sharing!");
    expect(res.body.data.user.name).toBeDefined();
  });

  it("get replies for review", async () => {
    // Create two replies
    await request(app)
      .post(`/api/reviews/${reviewId}/reply`)
      .set(getAuthHeader(consumer2Token))
      .send({ body: "Reply 1" });
    await request(app)
      .post(`/api/reviews/${reviewId}/reply`)
      .set(getAuthHeader(consumerToken))
      .send({ body: "Reply 2" });

    const res = await request(app).get(`/api/reviews/${reviewId}/replies`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].body).toBe("Reply 1");
  });

  it("vote helpful on review", async () => {
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/vote`)
      .set(getAuthHeader(consumer2Token))
      .send({ helpful: true });

    expect(res.status).toBe(200);
    expect(res.body.data.helpful).toBe(true);
  });

  it("toggle helpful vote (upsert)", async () => {
    // First vote: helpful
    await request(app)
      .post(`/api/reviews/${reviewId}/vote`)
      .set(getAuthHeader(consumer2Token))
      .send({ helpful: true });

    // Change vote: not helpful
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/vote`)
      .set(getAuthHeader(consumer2Token))
      .send({ helpful: false });

    expect(res.status).toBe(200);
    expect(res.body.data.helpful).toBe(false);
  });

  it("restaurant reviews include reply/vote counts and verified purchase flag", async () => {
    // Add a reply and a vote
    await request(app)
      .post(`/api/reviews/${reviewId}/reply`)
      .set(getAuthHeader(consumer2Token))
      .send({ body: "Nice!" });
    await request(app)
      .post(`/api/reviews/${reviewId}/vote`)
      .set(getAuthHeader(consumer2Token))
      .send({ helpful: true });

    const res = await request(app).get(`/api/reviews/restaurant/${restaurantId}`);

    expect(res.status).toBe(200);
    const review = res.body.data.reviews.find((r: any) => r.id === reviewId);
    expect(review.replyCount).toBe(1);
    expect(review.helpfulCount).toBe(1);
    expect(review.isVerifiedPurchase).toBe(false); // no orderId
  });

  it("reject reply on nonexistent review", async () => {
    const res = await request(app)
      .post("/api/reviews/00000000-0000-0000-0000-000000000000/reply")
      .set(getAuthHeader(consumerToken))
      .send({ body: "This won't work" });

    expect(res.status).toBe(404);
  });
});
