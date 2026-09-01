"use server";

import { redirect } from "next/navigation";
import crypto from "crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, schools, passwordResetTokens } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Step 1 of "forgot password": always shows the same generic confirmation
 * regardless of whether the email matched anything, so this can't be used to
 * probe which email addresses have accounts. `users.email` is only unique
 * per-school (not globally), so — in the rare case the same email exists at
 * more than one school — every matching account gets its own token and its
 * own line in a single email, rather than only handling the first match.
 */
export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const genericMessage =
    "If that email matches an account, we've sent a password reset link to it.";

  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Enter your email address.")}`);
  }

  // Caps how many reset emails one address can be sent (3 per 15 minutes),
  // so this form can't be used to mail-bomb someone else's inbox. Always
  // shows the same generic message either way — if we branched the response
  // when the limit is hit, that itself would leak whether the email exists.
  const key = `reset:${email}`;
  const limited = await isRateLimited(key, { maxAttempts: 3, windowMinutes: 15 });
  await recordAttempt(key);

  const matches = limited ? [] : await db.select().from(users).where(eq(users.email, email));

  if (matches.length > 0) {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const links: { schoolName: string; url: string }[] = [];

    for (const user of matches) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      });

      const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId)).limit(1);
      links.push({
        schoolName: school?.name ?? "your school",
        url: `${appUrl}/reset-password?token=${rawToken}`,
      });
    }

    const bodyLines = links
      .map(
        (l) =>
          `<p style="margin:0 0 16px;">Account at <strong>${l.schoolName}</strong>: <a href="${l.url}" style="color:#2f6b3f;">Reset your password</a></p>`
      )
      .join("");

    await sendEmail({
      to: email,
      subject: "Reset your Aclass password",
      text: links.map((l) => `Account at ${l.schoolName}: ${l.url}`).join("\n\n"),
      html: `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#eef3ee;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dbe8db;">
      <tr><td style="background:#2f6b3f;padding:24px 32px;"><div style="font-size:20px;font-weight:bold;color:#ffffff;">Aclass</div></td></tr>
      <tr>
        <td style="padding:32px;color:#1f2b1f;font-size:15px;line-height:1.5;">
          <p style="margin:0 0 16px;">Someone requested a password reset for this email address. If that was you, use the link below — it expires in 1 hour.</p>
          ${bodyLines}
          <p style="margin:16px 0 0;font-size:13px;color:#5b6b5b;">If you didn't request this, you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      fromName: "Aclass Account Security",
    });
  }

  redirect(`/forgot-password?success=${encodeURIComponent(genericMessage)}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!token) {
    redirect(`/forgot-password?error=${encodeURIComponent("Missing or invalid reset link.")}`);
  }
  if (!newPassword || newPassword.length < 8) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
        "New password must be at least 8 characters."
      )}`
    );
  }
  if (newPassword !== confirmPassword) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
        "Passwords don't match."
      )}`
    );
  }

  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!row) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(
        "That reset link is invalid or has expired. Request a new one."
      )}`
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, row.id));

  redirect(
    `/login?success=${encodeURIComponent("Password updated — log in with your new password.")}`
  );
}
