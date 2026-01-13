const express = require("express");
const router = express.Router();

router.get("/privacy", (req, res) => res.render("static/privacy.ejs"));
router.get("/terms", (req, res) => res.render("static/terms.ejs"));
router.get("/cookies", (req, res) => res.render("static/cookies.ejs"));

router.get("/help", (req, res) => res.render("static/help.ejs"));
router.get("/contact", (req, res) => res.render("static/contact.ejs"));

router.post("/newsletter", (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();

  // basic validation
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) {
    req.flash("error", "Please enter a valid email address.");
    return res.redirect(req.get("Referrer") || "/listings");
  }

  // In real production: store email / send to email provider
  req.flash("success", "Subscribed! You’ll receive updates in your inbox.");
  return res.redirect(req.get("Referrer") || "/listings");
});

module.exports = router;