import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let userCounter = 0;

export async function registerUser(role: string = "CONSUMER") {
  userCounter++;
  const email = `e2e-${role.toLowerCase()}-${Date.now()}-${userCounter}@test.local`;
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "testpass123",
      name: `E2E ${role} ${userCounter}`,
      role,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Register failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const token = json.data.token as string;
  const userId = json.data.user.id as string;

  // Auto-verify in E2E tests using test-mode bypass code 000000
  const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: "000000", type: "EMAIL" }),
  });

  let finalToken = token;
  if (verifyRes.ok) {
    const verifyJson = await verifyRes.json();
    finalToken = verifyJson.data.token;
  }

  return {
    id: userId,
    email: json.data.user.email as string,
    token: finalToken,
  };
}

export async function registerUnverifiedUser(role: string = "CONSUMER") {
  userCounter++;
  const email = `e2e-unverified-${role.toLowerCase()}-${Date.now()}-${userCounter}@test.local`;
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "testpass123",
      name: `E2E Unverified ${role} ${userCounter}`,
      role,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Register failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return {
    id: json.data.user.id as string,
    email: json.data.user.email as string,
    token: json.data.token as string,
  };
}

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return {
    id: json.data.user.id as string,
    token: json.data.token as string,
  };
}

export async function injectAuthToken(page: Page, token: string) {
  await page.addInitScript((t) => {
    localStorage.setItem("token", t);
  }, token);
}
