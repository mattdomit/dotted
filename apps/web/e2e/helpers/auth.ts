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
