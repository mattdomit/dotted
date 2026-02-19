import { test as base, type Page } from "@playwright/test";
import { registerUser, injectAuthToken } from "./auth";
import { getDemoZoneId } from "./api-setup";

type Fixtures = {
  consumerPage: Page;
  restaurantPage: Page;
  adminUser: { id: string; token: string };
  demoZoneId: string;
};

export const test = base.extend<Fixtures>({
  consumerPage: async ({ browser }, use) => {
    const user = await registerUser("CONSUMER");
    const context = await browser.newContext();
    const page = await context.newPage();
    await injectAuthToken(page, user.token);
    await use(page);
    await context.close();
  },

  restaurantPage: async ({ browser }, use) => {
    const user = await registerUser("RESTAURANT_OWNER");
    const context = await browser.newContext();
    const page = await context.newPage();
    await injectAuthToken(page, user.token);
    await use(page);
    await context.close();
  },

  adminUser: async ({}, use) => {
    const user = await registerUser("ADMIN");
    await use({ id: user.id, token: user.token });
  },

  demoZoneId: async ({}, use) => {
    const zoneId = await getDemoZoneId();
    await use(zoneId);
  },
});

export { expect } from "@playwright/test";
