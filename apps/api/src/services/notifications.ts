import { prisma } from "@dotted/db";
import { Resend } from "resend";
import { getIO } from "../socket/handlers";
import { sendSms } from "../lib/twilio";
import { enqueueEmail, enqueueSms } from "../lib/queue";
import { logger } from "../lib/logger";

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
  channels?: ("EMAIL" | "SMS" | "IN_APP")[];
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

  // Send email via Resend (queue if available, else inline)
  if (channels.includes("EMAIL")) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user) {
      const queued = await enqueueEmail({ to: user.email, subject: title, body });
      if (!queued) {
        // Fallback: send inline
        const emailClient = getResend();
        if (emailClient) {
          try {
            await emailClient.emails.send({
              from: "Dotted <notifications@dotted.app>",
              to: user.email,
              subject: title,
              text: body,
            });
          } catch (err) {
            logger.error({ err, userId }, "Failed to send email notification");
          }
        }
      }
    }
  }

  // Send SMS via Twilio (queue if available, else inline)
  if (channels.includes("SMS")) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    // Use phone from restaurant/supplier profile if available
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: userId },
      select: { phone: true },
    });

    const phone = restaurant?.phone;
    if (phone) {
      const queued = await enqueueSms({ to: phone, body: `${title}: ${body}` });
      if (!queued) {
        // Fallback: send inline
        const sent = await sendSms(phone, `${title}: ${body}`);
        if (!sent) {
          logger.warn({ userId }, "SMS send failed (inline fallback)");
        }
      }
    }
  }

  return notification;
}
