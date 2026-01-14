// utils/mailer.js
const nodemailer = require("nodemailer");

console.log("MAILER LOADED: Nodemailer SMTP version 67f1415");
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing in environment variables`);
  return v;
}

function createTransporter() {
  const host = required("SMTP_HOST");
  const port = Number(required("SMTP_PORT"));
  const secure = process.env.SMTP_SECURE === "true"; // true for 465, false for 587/2525

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
    },
    requireTLS: !secure,
    tls: { minVersion: "TLSv1.2" },

    // Avoid hanging on production
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
}

let transporter;
function getTransporter() {
  if (!transporter) transporter = createTransporter();
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error("Missing 'to'");
  if (!subject) throw new Error("Missing 'subject'");
  if (!html && !text) throw new Error("Missing email content (html/text)");

  const fromEmail = required("MAIL_FROM_EMAIL");
  const fromName = process.env.MAIL_FROM_NAME || "StayCraft";
  const from = `${fromName} <${fromEmail}>`;

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return info;
  } catch (err) {
    // Helpful in Render logs
    console.error("SMTP SEND ERROR:", err);
    console.error("SMTP CODE:", err?.code);
    console.error("SMTP RESPONSE:", err?.response);
    throw err;
  }
}

// Call this once at startup to see if Render can connect/auth to SMTP
async function verifySmtp() {
  await getTransporter().verify();
  console.log("✅ SMTP transporter verified and ready");
}

module.exports = { sendMail, verifySmtp };