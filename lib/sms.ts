// Africa's Talking Bulk SMS — the standard SMS gateway for Kenya (same role
// here as Safaricom Daraja plays for M-Pesa). Unlike M-Pesa, no money lands
// in a specific business account for an SMS send, so this is ONE shared
// Aclass account used by every school (AT_USERNAME/AT_API_KEY in .env.local)
// rather than per-school credentials — same pattern as the shared Gmail
// account in lib/email.ts.

const SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";
const PRODUCTION_URL = "https://api.africastalking.com/version1/messaging";

interface SendSmsParams {
  to: string; // normalized to 2547XXXXXXXX / 2541XXXXXXXX (see lib/mpesa.ts normalizeKenyanPhone)
  message: string;
}

interface SendSmsResult {
  status: string;
  cost: string | null;
  messageId: string | null;
}

export async function sendSms({ to, message }: SendSmsParams): Promise<SendSmsResult> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey) {
    throw new Error("SMS isn't configured yet — AT_USERNAME / AT_API_KEY are missing in .env.local.");
  }

  // Africa's Talking's own sandbox app is always named "sandbox" — using it
  // routes to their test gateway instead of sending (and billing) for real.
  const url = username === "sandbox" ? SANDBOX_URL : PRODUCTION_URL;
  const senderId = process.env.AT_SENDER_ID; // optional registered shortcode/alphanumeric sender ID

  const body = new URLSearchParams({ username, to, message });
  if (senderId) body.set("from", senderId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`SMS request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (!recipient) {
    throw new Error(data?.SMSMessageData?.Message || "SMS gateway returned no recipient status.");
  }
  if (recipient.status !== "Success") {
    throw new Error(recipient.status || "SMS failed to send.");
  }

  return {
    status: recipient.status,
    cost: recipient.cost ?? null,
    messageId: recipient.messageId ?? null,
  };
}
