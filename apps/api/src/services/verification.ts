import { prisma } from "@dotted/db";
import { VERIFICATION_CODE_EXPIRY_MINUTES, VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@dotted/shared";
import { notify } from "./notifications";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateVerificationCode(
  userId: string,
  type: "EMAIL" | "SMS"
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

  await prisma.verificationCode.create({
    data: { userId, code, type, expiresAt },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (type === "EMAIL" && user) {
    notify({
      userId,
      type: "VERIFICATION",
      title: "Verify your email",
      body: `Your Dotted verification code is: ${code}. It expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes.`,
      channels: ["EMAIL"],
    }).catch(() => {});
  } else if (type === "SMS") {
    notify({
      userId,
      type: "VERIFICATION",
      title: "Dotted Verification",
      body: `Your verification code is: ${code}`,
      channels: ["SMS"],
    }).catch(() => {});
  }

  return code;
}

export async function verifyCode(
  userId: string,
  code: string,
  type: "EMAIL" | "SMS"
): Promise<boolean> {
  // Test mode bypass: accept 000000 as valid
  if (process.env.NODE_ENV === "test" && code === "000000") {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    return true;
  }

  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      userId,
      code,
      type,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verificationCode) return false;

  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { verifiedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    }),
  ]);

  return true;
}

export async function canResend(userId: string, type: "EMAIL" | "SMS"): Promise<boolean> {
  const recent = await prisma.verificationCode.findFirst({
    where: {
      userId,
      type,
      createdAt: {
        gt: new Date(Date.now() - VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000),
      },
    },
  });

  return !recent;
}
