const nodemailer = require("nodemailer");

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = required("SMTP_USER");
const SMTP_PASS = required("SMTP_PASS");
const SMTP_FROM = required("SMTP_FROM");

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true,                 // IMPORTANT for 465
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 30000,
});

async function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({ from: SMTP_FROM, to, subject, html, text });
}

module.exports = { sendMail };