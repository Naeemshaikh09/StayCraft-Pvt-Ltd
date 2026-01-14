const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

// IMPORTANT: filename must match EXACTLY on Render/Linux.
// If the real file is middleware.js, rename or fix this import.
const {
  savedRedirectUrl,
  validateSignup,
  validateLogin,
  isLoggedIn,
} = require("../middelware.js");

const userControllers = require("../controllers/users.js");

const signupLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("error", "Too many signup attempts. Please try again later.");
    return res.redirect("/signup");
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("error", "Too many login attempts. Please try again later.");
    return res.redirect("/login");
  },
});

const forgotLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("error", "Too many requests. Please try again later.");
    return res.redirect("/forgot");
  },
});

router
  .route("/signup")
  .get(userControllers.renderSignUpForm)
  .post(signupLimiter, validateSignup, userControllers.signup);

router
  .route("/login")
  .get(userControllers.renderLoginForm)
  .post(loginLimiter, validateLogin, savedRedirectUrl, userControllers.login);

router.get("/logout", userControllers.logout);

router
  .route("/forgot")
  .get(userControllers.renderForgotForm)
  .post(forgotLimiter, userControllers.forgotPassword);

router
  .route("/reset/:token")
  .get(userControllers.renderResetForm)
  .post(userControllers.resetPassword);

router
  .route("/verify-email/resend")
  .get(userControllers.renderResendVerify)
  .post(userControllers.resendVerify);

router.get("/verify-email/:token", userControllers.verifyEmail);

router.get("/saved", isLoggedIn, userControllers.renderSaved);
router.post("/saved/clear", isLoggedIn, userControllers.clearSaved);

module.exports = router;