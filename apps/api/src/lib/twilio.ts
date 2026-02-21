import Twilio from "twilio";

let client: ReturnType<typeof Twilio> | null = null;

export function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;

  if (!client) {
    client = Twilio(sid, token);
  }
  return client;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const tw = getTwilio();
  if (!tw) return false;

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return false;

  try {
    await tw.messages.create({ to, from, body });
    return true;
  } catch (err) {
    console.error("Failed to send SMS:", err);
    return false;
  }
}
