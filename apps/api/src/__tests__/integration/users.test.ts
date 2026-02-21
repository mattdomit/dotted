import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestRestaurant, createTestZonePost } from "../helpers/fixtures";
import { prisma } from "@dotted/db";

const app = createApp();

describe("User Profiles", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("get public user profile", async () => {
    const { user } = await createTestUser(UserRole.CONSUMER);

    const res = await request(app).get(`/api/users/${user.id}/profile`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.name).toBe(user.name);
    expect(res.body.data.badges).toBeDefined();
    expect(res.body.data.reviewCount).toBe(0);
    expect(res.body.data.postCount).toBe(0);
  });

  it("update dietary preferences", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER);

    const res = await request(app)
      .patch("/api/users/me/dietary")
      .set(getAuthHeader(token))
      .send({ dietaryPreferences: ["Vegetarian", "Gluten-Free"] });

    expect(res.status).toBe(200);
    expect(res.body.data.dietaryPreferences).toEqual(["Vegetarian", "Gluten-Free"]);
  });

  it("update profile (bio, phoneNumber)", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER);

    const res = await request(app)
      .patch("/api/users/me/profile")
      .set(getAuthHeader(token))
      .send({ bio: "I love food!", phoneNumber: "+15551234567" });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe("I love food!");
    expect(res.body.data.phoneNumber).toBe("+15551234567");
  });

  it("badge computation - first_vote", async () => {
    const { user, token } = await createTestUser(UserRole.CONSUMER);
    const zone = await createTestZone();

    // Create a vote
    const cycle = await prisma.dailyCycle.create({
      data: { zoneId: zone.id, date: new Date(), status: "VOTING" },
    });
    const dish = await prisma.dish.create({
      data: {
        dailyCycleId: cycle.id,
        name: "Test",
        description: "Test dish",
        cuisine: "Italian",
        estimatedCost: 10,
      },
    });
    await prisma.vote.create({
      data: { userId: user.id, dishId: dish.id, dailyCycleId: cycle.id },
    });

    const res = await request(app).get(`/api/users/${user.id}/profile`);

    expect(res.status).toBe(200);
    expect(res.body.data.badges).toContain("First Vote");
  });

  it("badge computation - first_review and founding_member", async () => {
    const { user } = await createTestUser(UserRole.CONSUMER);
    const zone = await createTestZone();
    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zone.id);

    // Create a review
    await prisma.review.create({
      data: {
        userId: user.id,
        restaurantId: restaurant.id,
        rating: 5,
        title: "Amazing",
        body: "Absolutely wonderful experience with great food.",
      },
    });

    const res = await request(app).get(`/api/users/${user.id}/profile`);

    expect(res.status).toBe(200);
    expect(res.body.data.badges).toContain("First Review");
    // Should be founding member since it's the first user
    expect(res.body.data.badges).toContain("Founding Member");
    expect(res.body.data.reviewCount).toBe(1);
  });

  it("badge computation - community_contributor", async () => {
    const { user } = await createTestUser(UserRole.CONSUMER);
    const zone = await createTestZone();

    // Create 10 posts
    for (let i = 0; i < 10; i++) {
      await createTestZonePost(zone.id, user.id, `Post ${i}`);
    }

    const res = await request(app).get(`/api/users/${user.id}/profile`);

    expect(res.status).toBe(200);
    expect(res.body.data.badges).toContain("Community Star");
    expect(res.body.data.postCount).toBe(10);
  });

  it("return 404 for nonexistent user", async () => {
    const res = await request(app).get("/api/users/00000000-0000-0000-0000-000000000000/profile");
    expect(res.status).toBe(404);
  });
});
