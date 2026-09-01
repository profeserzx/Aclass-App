import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local to send email."
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEmailHtml(params: {
  schoolName: string;
  schoolTagline?: string | null;
  studentName?: string | null;
  bodyText: string;
}): string {
  const { schoolName, schoolTagline, studentName, bodyText } = params;
  const year = new Date().getFullYear();
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(
      (p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#eef3ee;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dbe8db;">
      <tr>
        <td style="background:#2f6b3f;padding:28px 32px;text-align:center;">
          <div style="font-size:26px;font-weight:bold;color:#ffffff;">🏫 ${escapeHtml(schoolName)}</div>
          ${
            schoolTagline
              ? `<div style="margin-top:8px;font-size:15px;color:#dcecdc;">${escapeHtml(schoolTagline)}</div>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td style="background:#f6fbf6;padding:32px;color:#1f2b1f;font-size:15px;line-height:1.5;">
          ${
            studentName
              ? `<div style="margin-bottom:16px;font-size:15px;"><strong style="color:#2f6b3f;">Student:</strong> ${escapeHtml(
                  studentName
                )}</div>`
              : ""
          }
          ${paragraphs}
        </td>
      </tr>
      <tr>
        <td style="background:#e7f2e7;padding:18px 32px;text-align:center;border-top:1px solid #2f6b3f;">
          <div style="font-size:12.5px;color:#5b6b5b;">This is an automated message from ${escapeHtml(
            schoolName
          )} Management System.</div>
          <div style="margin-top:4px;font-size:12.5px;color:#5b6b5b;">© ${year} ${escapeHtml(
            schoolName
          )}. All rights reserved.</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
}): Promise<void> {
  const t = getTransporter();
  const fromAddress = process.env.GMAIL_USER;
  await t.sendMail({
    from: `"${params.fromName ?? "Aclass"}" <${fromAddress}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
