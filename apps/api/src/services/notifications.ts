import { prisma } from "@dotted/db";
import { Resend } from "resend";
import { getIO } from "../socket/handlers";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface NotifyOptions {
  userId: string;
  type: string;
  title: string;
  body: string;
  channels?: ("EMAIL" | "IN_APP")[];
  metadata?: Record<string, string | number | boolean>;
}

export async function notify({
  userId,
  type,
  title,
  body,
  channels = ["IN_APP"],
  metadata = {},
}: NotifyOptions) {
  // Persist notification to database
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      channel: channels.join(","),
      status: "SENT",
      metadata,
    },
  });

  // Emit via socket.io for real-time in-app notifications
  if (channels.includes("IN_APP")) {
    getIO()?.to(`user:${userId}`).emit("notification", {
      id: notification.id,
      type,
      title,
      body,
      createdAt: notification.createdAt,
    });
  }

  // Send email via Resend if configured and EMAIL channel requested
  if (channels.includes("EMAIL")) {
    const emailClient = getResend();
    if (emailClient) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user) {
        try {
          await emailClient.emails.send({
            from: "Dotted <notifications@dotted.app>",
            to: user.email,
            subject: title,
            text: body,
          });
        } catch (err) {
          console.error("Failed to send email notification:", err);
        }
      }
    }
  }

  return notification;
}
