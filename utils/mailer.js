// utils/mailer.js (Mailgun HTTP API)
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const MAILGUN_API_KEY = required("MAILGUN_API_KEY");
const MAILGUN_DOMAIN = required("MAILGUN_DOMAIN");
const MAIL_FROM = required("MAIL_FROM");
const MAILGUN_REGION = (process.env.MAILGUN_REGION || "US").toUpperCase();

const MAILGUN_BASE =
  MAILGUN_REGION === "EU" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";

async function sendMail({ to, subject, html, text }) {
  const url = `${MAILGUN_BASE}/v3/${MAILGUN_DOMAIN}/messages`;

  const body = new URLSearchParams();
  body.set("from", MAIL_FROM);
  body.set("to", to);
  body.set("subject", subject);
  if (text) body.set("text", text);
  if (html) body.set("html", html);

  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || `Mailgun error: HTTP ${res.status}`;
    const err = new Error(msg);
    err.mailgun = data;
    throw err;
  }

  return data; // contains id + message
}

module.exports = { sendMail };