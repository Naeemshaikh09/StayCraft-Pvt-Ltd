const nodemailer = require("nodemailer");
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();

  // optional: verify connection (helps debugging)
  await transporter.verify();

  return transporter.sendMail({
    from: `"StayCraft" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
 
}

module.exports = { sendMail };