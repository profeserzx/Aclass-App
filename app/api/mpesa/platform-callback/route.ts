import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformStkPushRequests, schools } from "@/db/schema";
import { parseStkCallback, type StkCallbackPayload } from "@/lib/mpesa";

const SUBSCRIPTION_PERIOD_DAYS = 30;

function revalidateBillingViews() {
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  revalidatePath("/parent");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard/payments");
}

// Structural twin of app/api/mpesa/callback/route.ts, but for SCHOOL-PAYS-
// ACLASS subscriptions rather than PARENT-PAYS-SCHOOL fees — kept as a fully
// separate route/table so a bug in one flow can never touch the other's data.
//
// No auth check: Safaricom calls this directly (no session/cookie). Trusted
// because the URL is a long random path known only to Safaricom, and we only
// ever act on a checkoutRequestId WE created via a prior initiateStkPush call.
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
    .from(platformStkPushRequests)
    .where(eq(platformStkPushRequests.checkoutRequestId, result.checkoutRequestId))
    .limit(1);

  if (!request) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // Already processed (Safaricom can retry callbacks) — don't double-apply.
  if (request.status !== "pending") {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  if (result.success) {
    const periodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await db
      .update(schools)
      .set({
        plan: request.plan,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
      })
      .where(eq(schools.id, request.schoolId));

    await db
      .update(platformStkPushRequests)
      .set({
        status: "success",
        resultCode: String(result.resultCode),
        resultDesc: result.resultDesc,
        mpesaReceiptNumber: result.mpesaReceiptNumber ?? null,
        completedAt: new Date(),
      })
      .where(eq(platformStkPushRequests.id, request.id));
  } else {
    await db
      .update(platformStkPushRequests)
      .set({
        status: result.resultCode === 1032 ? "cancelled" : "failed",
        resultCode: String(result.resultCode),
        resultDesc: result.resultDesc,
        completedAt: new Date(),
      })
      .where(eq(platformStkPushRequests.id, request.id));
  }

  revalidateBillingViews();
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
