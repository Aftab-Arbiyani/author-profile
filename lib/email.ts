import { Resend } from "resend";

/**
 * Transactional email for the ARC reader program, sent via Resend.
 *
 * Follows the same graceful-degradation convention as lib/firestore.ts: when
 * RESEND_API_KEY is missing every send returns "not-configured" instead of
 * throwing, so flows that trigger email (apply, approve, sign-in) still
 * complete — the email is simply skipped and logged.
 */

export type SendResult = "sent" | "not-configured" | "error";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com";

const DEFAULT_FROM = "Aftab Arbiyani <arc@aftabarbiyani.com>";

export function hasEmailConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

function getResend() {
  if (!hasEmailConfig()) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? DEFAULT_FROM;
}

/** Minimal HTML shell shared by every ARC email. Content must be pre-escaped. */
function emailShell(bodyHtml: string) {
  return `<div style="font-family: Georgia, 'Times New Roman', serif; color: #171512; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.6;">
${bodyHtml}
<p style="margin-top: 32px; color: #6b645c; font-size: 13px;">Aftab Arbiyani · <a href="${SITE_URL}" style="color: #6b645c;">aftabarbiyani.com</a></p>
</div>`;
}

/** Escapes user-provided strings (names) before interpolation into email HTML. */
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function send(
  fnName: string,
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const resend = getResend();

  if (!resend) {
    console.warn(`[${fnName}] RESEND_API_KEY not set — email to ${to} skipped.`);
    return "not-configured";
  }

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`[${fnName}]`, error);
      return "error";
    }

    return "sent";
  } catch (err) {
    console.error(`[${fnName}]`, err);
    return "error";
  }
}

/**
 * Magic sign-in link. The URL carries the raw single-use token (15-minute
 * TTL), so this email must never be logged with its contents.
 */
export async function sendMagicLinkEmail(
  email: string,
  url: string,
): Promise<SendResult> {
  return send(
    "sendMagicLinkEmail",
    email,
    "Your ARC library sign-in link",
    emailShell(`<p>Hello,</p>
<p>Use the button below to sign in to your ARC library. The link works once and expires in 15 minutes.</p>
<p style="margin: 28px 0;"><a href="${url}" style="background: #171512; color: #f5f1e8; padding: 12px 24px; border-radius: 24px; text-decoration: none;">Sign in to your library</a></p>
<p style="color: #6b645c; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>`),
  );
}

/** Confirmation that an ARC application was received. */
export async function sendApplicationReceivedEmail(
  email: string,
  name: string,
): Promise<SendResult> {
  return send(
    "sendApplicationReceivedEmail",
    email,
    "Your ARC reader application was received",
    emailShell(`<p>Hi ${esc(name)},</p>
<p>Thanks for applying to the ARC reader program. I read every application personally and will get back to you soon.</p>
<p>— Aftab</p>`),
  );
}

/**
 * Approval notice. Deliberately links to /arc/signin rather than embedding a
 * magic link — a 15-minute token would be dead before most people open the
 * email. The reader requests their own fresh link when they're ready.
 */
export async function sendApplicationApprovedEmail(
  email: string,
  name: string,
): Promise<SendResult> {
  return send(
    "sendApplicationApprovedEmail",
    email,
    "You're in — welcome to the ARC team",
    emailShell(`<p>Hi ${esc(name)},</p>
<p>Great news: your ARC reader application has been approved. You now have early access to read before anyone else.</p>
<p style="margin: 28px 0;"><a href="${SITE_URL}/arc/signin" style="background: #171512; color: #f5f1e8; padding: 12px 24px; border-radius: 24px; text-decoration: none;">Sign in to your ARC library</a></p>
<p>Enter this email address on the sign-in page and you'll receive a one-time link — no password needed.</p>
<p>When you've finished reading, I'd be grateful for your honest review.</p>
<p>— Aftab</p>`),
  );
}

/**
 * Best-effort note to the author when something needs attention (a new
 * application, a new pending review). Requires ARC_NOTIFY_EMAIL.
 */
export async function sendAuthorNotification(
  subject: string,
  bodyHtml: string,
): Promise<SendResult> {
  const notifyEmail = process.env.ARC_NOTIFY_EMAIL;

  if (!notifyEmail) {
    return "not-configured";
  }

  return send("sendAuthorNotification", notifyEmail, subject, emailShell(bodyHtml));
}
