// utils/mailer.js (Brevo HTTP API)
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const BREVO_API_KEY = required("BREVO_API_KEY");
const MAIL_FROM_EMAIL = required("MAIL_FROM_EMAIL"); // must be verified in Brevo
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "StayCraft";

async function sendMail({ to, subject, html, text }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || `Brevo API error: HTTP ${res.status}`);
  }

  return data; // contains messageId
}

module.exports = { sendMail };