const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { verifyCsrf } = require("../utils/csrf");
const { savedRedirectUrl, validateSignup, validateLogin,isLoggedIn } = require("../middelware.js");
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
  limit: 50, // ✅ increase for dev/testing
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
  .post(signupLimiter, verifyCsrf, validateSignup, userControllers.signup);

router
  .route("/login")
  .get(userControllers.renderLoginForm)
  .post(loginLimiter, verifyCsrf, validateLogin, savedRedirectUrl, userControllers.login);

router.get("/logout", userControllers.logout);

router
  .route("/forgot")
  .get(userControllers.renderForgotForm)
  .post(forgotLimiter, verifyCsrf, userControllers.forgotPassword);

router
  .route("/reset/:token")
  .get(userControllers.renderResetForm)
  .post(verifyCsrf, userControllers.resetPassword);

// ✅ resend verify email page + submit (must be FIRST)
router
  .route("/verify-email/resend")
  .get(userControllers.renderResendVerify)
  .post(verifyCsrf, userControllers.resendVerify);

// ✅ verify email link (must be AFTER resend)
router.get("/verify-email/:token", userControllers.verifyEmail);

router.get("/saved", isLoggedIn, userControllers.renderSaved);
router.post("/saved/clear", isLoggedIn, verifyCsrf, userControllers.clearSaved);


module.exports = router;