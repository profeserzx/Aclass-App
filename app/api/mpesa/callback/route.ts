import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stkPushRequests, payments } from "@/db/schema";
import { parseStkCallback, type StkCallbackPayload } from "@/lib/mpesa";
import { recomputeFeeStatus } from "@/app/actions/payments";

function revalidateMpesaViews() {
  revalidatePath("/parent");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
}

// Safaricom calls this URL directly (no session/cookie — it's their server,
// not a browser), so there's no auth check here. Instead we trust it because:
// (a) the URL itself is a long random path known only to Safaricom, and
// (b) we only ever act on a checkoutRequestId that WE created via a prior
// initiateStkPush call, matched against our own stk_push_requests row.
export async function POST(req: NextRequest) {
  let payload: StkCallbackPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid payload" }, { status: 400 });
  }

  const result = parseStkCallback(payload);

  const [request] = await db
    .select()
    .from(stkPushRequests)
    .where(eq(stkPushRequests.checkoutRequestId, result.checkoutRequestId))
    .limit(1);

  // Always acknowledge with the shape Safaricom expects, even if we can't
  // find a matching request — otherwise Safaricom will keep retrying.
  if (!request) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // Already processed (Safaricom can retry callbacks) — don't double-record.
  if (request.status !== "pending") {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  if (result.success) {
    // Safaricom itself is confirming the money moved — unlike a
    // self-reported payment claim, this can safely become a real payment.
    const [payment] = await db
      .insert(payments)
      .values({
        feeId: request.feeId,
        amount: String(result.amount ?? request.amount),
        method: "mpesa",
        transactionRef: result.mpesaReceiptNumber ?? null,
      })
      .returning();

    await recomputeFeeStatus(request.feeId);

    await db
      .update(stkPushRequests)
      .set({
        status: "success",
        resultCode: String(result.resultCode),
        resultDesc: result.resultDesc,
        mpesaReceiptNumber: result.mpesaReceiptNumber ?? null,
        paymentId: payment.id,
        completedAt: new Date(),
      })
      .where(eq(stkPushRequests.id, request.id));
  } else {
    // ResultCode 1032 = user cancelled/dismissed the prompt; other codes are
    // various failure reasons (insufficient funds, timeout, etc).
    await db
      .update(stkPushRequests)
      .set({
        status: result.resultCode === 1032 ? "cancelled" : "failed",
        resultCode: String(result.resultCode),
        resultDesc: result.resultDesc,
        completedAt: new Date(),
      })
      .where(eq(stkPushRequests.id, request.id));
  }

  revalidateMpesaViews();
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
