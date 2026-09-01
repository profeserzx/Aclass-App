// Safaricom Daraja API client — Lipa Na M-Pesa Online (STK Push).
//
// Flow: we ask Safaricom for an OAuth token, then POST a push request that
// makes the customer's phone show a PIN prompt. Safaricom replies to that
// POST immediately with just an acknowledgement (checkoutRequestId etc) —
// the actual pay/cancel result arrives later, asynchronously, as a POST to
// our own callback URL (see app/api/mpesa/callback/route.ts).
//
// Each school brings its own Paybill/Till + Daraja app (stored, encrypted,
// on that school's row — see app/actions/mpesaSettings.ts), so credentials
// are passed in per call rather than read from a single global env var. The
// callback URL is the one thing that stays app-wide, since Safaricom always
// calls our one deployed route regardless of which school's payment it is.

const SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke";
const PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";

export interface MpesaCredentials {
  env: "sandbox" | "production";
  shortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}

function baseUrl(env: "sandbox" | "production"): string {
  return env === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

function requireCallbackUrl(): string {
  const value = process.env.MPESA_CALLBACK_URL;
  if (!value) {
    throw new Error(
      "MPESA_CALLBACK_URL is not set in .env.local. See the M-Pesa setup instructions."
    );
  }
  return value;
}

/** Normalizes a Kenyan phone number to Safaricom's required 2547XXXXXXXX / 2541XXXXXXXX format. */
export function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) return digits;
  if (digits.length === 10 && (digits.startsWith("07") || digits.startsWith("01"))) {
    return `254${digits.slice(1)}`;
  }
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) {
    return `254${digits}`;
  }
  return null;
}

// Keyed by consumer key since different schools have different tokens.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(creds: MpesaCredentials): Promise<string> {
  const cached = tokenCache.get(creds.consumerKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const basicAuth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

  const res = await fetch(`${baseUrl(creds.env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basicAuth}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`M-Pesa auth failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: string };

  // Refresh a minute early to be safe.
  tokenCache.set(creds.consumerKey, {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
  });
  return data.access_token;
}

function timestampNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

/**
 * Initiates an STK push — the customer's phone will show a PIN prompt.
 * `accountReference` shows up on the customer's phone (we use the fee
 * description); `amount` is whole-shilling only per Safaricom's API.
 */
export async function initiateStkPush(
  creds: MpesaCredentials,
  params: {
    phoneNumber: string; // already normalized to 2547XXXXXXXX
    amount: number;
    accountReference: string;
    transactionDesc: string;
    // Defaults to MPESA_CALLBACK_URL (parent-fee flow). The platform billing
    // flow passes PLATFORM_MPESA_CALLBACK_URL here instead, so Safaricom hits
    // a completely separate route for school-pays-Aclass subscriptions.
    callbackUrl?: string;
  }
): Promise<StkPushResult> {
  const callbackUrl = params.callbackUrl ?? requireCallbackUrl();
  const timestamp = timestampNow();
  const password = Buffer.from(`${creds.shortcode}${creds.passkey}${timestamp}`).toString("base64");

  const token = await getAccessToken(creds);

  const res = await fetch(`${baseUrl(creds.env)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: creds.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(params.amount),
      PartyA: params.phoneNumber,
      PartyB: creds.shortcode,
      PhoneNumber: params.phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: params.accountReference.slice(0, 12),
      TransactionDesc: params.transactionDesc.slice(0, 13),
    }),
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(
      `M-Pesa STK push failed: ${data.errorMessage || data.ResponseDescription || res.statusText}`
    );
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

/** Shape Safaricom posts to our callback URL when a push resolves. */
export interface StkCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: { Name: string; Value?: string | number }[];
      };
    };
  };
}

export function parseStkCallback(payload: StkCallbackPayload) {
  const cb = payload.Body.stkCallback;
  const items = cb.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find((i) => i.Name === name)?.Value;

  return {
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    success: cb.ResultCode === 0,
    amount: get("Amount") as number | undefined,
    mpesaReceiptNumber: get("MpesaReceiptNumber") as string | undefined,
    phoneNumber: get("PhoneNumber") as string | undefined,
  };
}
