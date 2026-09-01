"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leaveRequests } from "@/db/schema";
import { getSession } from "@/lib/session";

const LEAVE_TYPES = ["annual", "sick", "study", "compassionate", "other"] as const;

function canReview(role: string): boolean {
  return role === "admin" || role === "dean";
}

export async function requestLeaveAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const leaveTypeRaw = String(formData.get("leaveType") || "").trim();
  const startDate = String(formData.get("startDate") || "").trim();
  const endDate = String(formData.get("endDate") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;

  if (!startDate || !endDate) {
    redirect(`/dashboard/leave?error=${encodeURIComponent("Choose a start and end date.")}`);
  }
  if (endDate < startDate) {
    redirect(`/dashboard/leave?error=${encodeURIComponent("End date can't be before the start date.")}`);
  }
  const leaveType = (LEAVE_TYPES as readonly string[]).includes(leaveTypeRaw)
    ? (leaveTypeRaw as (typeof LEAVE_TYPES)[number])
    : "annual";

  await db.insert(leaveRequests).values({
    schoolId: session.schoolId,
    userId: session.userId,
    leaveType,
    startDate,
    endDate,
    reason,
  });
  // No redirect: called from /dashboard/leave itself.
  revalidatePath("/dashboard/leave");
}

export async function reviewLeaveAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canReview(session.role)) {
    redirect(`/dashboard/leave?error=${encodeURIComponent("Only an admin or dean can approve or reject leave.")}`);
  }

  const requestId = String(formData.get("requestId") || "");
  const decisionRaw = String(formData.get("decision") || "");
  if (!requestId || (decisionRaw !== "approved" && decisionRaw !== "rejected")) return;
  const decision = decisionRaw as "approved" | "rejected";

  await db
    .update(leaveRequests)
    .set({ status: decision, reviewedBy: session.userId, reviewedAt: new Date() })
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.schoolId, session.schoolId)));
  revalidatePath("/dashboard/leave");
}

export async function cancelLeaveAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return;

  // The requester can cancel their own still-pending request; an admin can
  // clean up any request for the school.
  if (session.role === "admin") {
    await db
      .delete(leaveRequests)
      .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.schoolId, session.schoolId)));
  } else {
    await db
      .delete(leaveRequests)
      .where(
        and(
          eq(leaveRequests.id, requestId),
          eq(leaveRequests.schoolId, session.schoolId),
          eq(leaveRequests.userId, session.userId),
          eq(leaveRequests.status, "pending")
        )
      );
  }
  revalidatePath("/dashboard/leave");
}
