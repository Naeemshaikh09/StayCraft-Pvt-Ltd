const nodemailer = require("nodemailer");

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

if (!user || !pass) {
  throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // 587 = STARTTLS (NOT SSL)
  auth: { user, pass },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});
async function verifyMailerOnce() {
  // Don't keep verifying again and again in production logs
  if (process.env.NODE_ENV === "production") return;

  try {
    await transporter.verify();
    console.log("MAIL OK: SMTP connected");
  } catch (err) {
    console.error("VERIFY MAIL ERROR:", err.code || err.message);
  }
}

async function sendMail(options) {
  // options: { to, subject, text, html }
  return transporter.sendMail({
    from: user,
    ...options,
  });
}

module.exports = { transporter, verifyMailerOnce, sendMail };