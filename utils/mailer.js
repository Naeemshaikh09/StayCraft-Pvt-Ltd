// utils/mailer.js
const { Resend } = require("resend");

async function sendMail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!from) throw new Error("Missing MAIL_FROM");

  const resend = new Resend(apiKey);

  return resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });
}

module.exports = { sendMail };