// utils/mailer.js (safe)
function isSendGridConfigured() {
  return process.env.SENDGRID_API_KEY && process.env.MAIL_FROM_EMAIL;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error("Missing 'to'");
  if (!subject) throw new Error("Missing 'subject'");
  if (!html && !text) throw new Error("Missing email content (html/text)");

  if (!isSendGridConfigured()) {
    throw new Error("Email service not configured: set SENDGRID_API_KEY and MAIL_FROM_EMAIL");
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME || "StayCraft";

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [],
  };

  if (text) payload.content.push({ type: "text/plain", value: text });
  if (html) payload.content.push({ type: "text/html", value: html });

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 202) return { ok: true };

  const data = await res.json().catch(() => ({}));
  throw new Error(
    data?.errors?.[0]?.message ||
      data?.message ||
      `SendGrid error: HTTP ${res.status}`
  );
}

module.exports = { sendMail };