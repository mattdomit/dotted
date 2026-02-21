import { prisma } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import bcrypt from "bcryptjs";
import { signToken, AuthPayload } from "../../middleware/auth";

let userCounter = 0;

export async function createTestUser(
  role: UserRole,
  overrides: Partial<{ email: string; name: string; password: string; emailVerified: boolean }> = {}
) {
  userCounter++;
  const email = overrides.email ?? `test-${role.toLowerCase()}-${userCounter}-${Date.now()}@dotted.test`;
  const name = overrides.name ?? `Test ${role} ${userCounter}`;
  const password = overrides.password ?? "TestPass123!";
  const emailVerified = overrides.emailVerified ?? true; // Default true so existing tests pass

  const passwordHash = await bcrypt.hash(password, 4); // fast rounds for tests

  const user = await prisma.user.create({
    data: { email, name, role, passwordHash, emailVerified },
  });

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as unknown as UserRole,
    emailVerified,
  };
  const token = signToken(payload);

  return { user, token, password };
}

export function getAuthHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
