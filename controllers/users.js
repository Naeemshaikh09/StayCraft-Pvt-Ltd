const User = require("../models/user.js");
const passport = require("passport");
const crypto = require("crypto");
const { sendMail } = require("../utils/mailer");
const Listing = require("../models/listing");
const LoginAttempt = require("../models/loginAttempt");

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min window
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // lock for 15 min

function usernameLowerFromReq(req) {
  return (req.body.username || "").toString().trim().toLowerCase();
}

function formatWait(ms) {
  const m = Math.ceil(ms / 60000);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

async function recordFailedLogin(usernameLower, ip) {
  if (!usernameLower || !ip) return;

  const now = new Date();

  let doc = await LoginAttempt.findOne({ usernameLower, ip });

  if (!doc) {
    doc = await LoginAttempt.create({
      usernameLower,
      ip,
      count: 1,
      lastAttempt: now,
      lockedUntil: null,
    });
    return doc;
  }

  // reset count if outside window
  const last = doc.lastAttempt ? new Date(doc.lastAttempt) : null;
  if (!last || (now - last) > LOGIN_WINDOW_MS) {
    doc.count = 0;
    doc.lockedUntil = null;
  }

  doc.count += 1;
  doc.lastAttempt = now;

  // lock if exceeded
  if (doc.count >= LOGIN_MAX_ATTEMPTS) {
    doc.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MS);
  }

  await doc.save();
  return doc;
}

async function clearLoginAttempts(usernameLower, ip) {
  if (!usernameLower || !ip) return;
  await LoginAttempt.deleteOne({ usernameLower, ip });
}


async function sendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  user.verifyEmailTokenHash = tokenHash;
  user.verifyEmailExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/verify-email/${token}`;

  await sendMail({
    to: user.email,
    subject: "Verify your StayCraft email",
    html: `
      <p>Welcome to StayCraft!</p>
      <p>Please verify your email to unlock all features.</p>
      <p><a href="${verifyLink}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
module.exports.renderSignUpForm = (req, res) => {
  return res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      req.flash("error", "Email is already registered. Try logging in.");
      return res.redirect("/login");
    }

    if (!password || password.length < 8) {
      req.flash("error", "Password must be at least 8 characters long.");
      return res.redirect("/signup");
    }

    const newUser = new User({ email: cleanEmail, username });
    const registeredUser = await User.register(newUser, password);

    req.session.regenerate((err) => {
      if (err) return next(err);

      req.login(registeredUser, async (err) => {
        if (err) return next(err);

        try {
          await sendVerificationEmail(registeredUser);
          req.flash("success", "Account created! Please verify your email (check inbox).");
        } catch (e) {
          console.error("VERIFY MAIL ERROR:", e.message);
          req.flash("error", "Account created, but verification email could not be sent. Try again later.");
        }

        return res.redirect("/listings");
      });
    });
  } catch (e) {
    if (e && e.code === 11000) {
      req.flash("error", "Email is already registered.");
      return res.redirect("/signup");
    }
    req.flash("error", e.message || "Could not create account.");
    return res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  return res.render("users/login.ejs");
};

module.exports.login = async (req, res, next) => {
  const redirectUrl = res.locals.redirectUrl || "/listings";

  const usernameLower = usernameLowerFromReq(req);
  const ip = req.ip;

  // ✅ block if locked
  if (usernameLower) {
    const attempt = await LoginAttempt.findOne({ usernameLower, ip });

    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const waitMs = attempt.lockedUntil.getTime() - Date.now();
      req.flash("error", `Too many failed attempts. Try again in ${formatWait(waitMs)}.`);
      return res.redirect("/login");
    }
  }

  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      // ✅ record failure + maybe lock
      return (async () => {
        await recordFailedLogin(usernameLower, ip);

        req.flash("error", info?.message || "Invalid username or password.");
        return res.redirect("/login");
      })().catch(next);
    }

    // ✅ success: clear attempts
    return (async () => {
      await clearLoginAttempts(usernameLower, ip);

      req.session.regenerate((err) => {
        if (err) return next(err);

        req.login(user, (err) => {
          if (err) return next(err);
          req.flash("success", "Welcome back to StayCraft!");
          return res.redirect(redirectUrl);
        });
      });
    })().catch(next);
  })(req, res, next);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out successfully.");
    return res.redirect("/listings");
  });
};
module.exports.renderForgotForm = (req, res) => {
  return res.render("users/forgot.ejs");
};

module.exports.forgotPassword = async (req, res, next) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();

    // Prevent account-enumeration
    const genericMsg =
      "If an account exists for that email, we sent a password reset link.";

    const user = await User.findOne({ email });

    if (!user) {
      req.flash("success", genericMsg);
      return res.redirect("/forgot");
    }

    // Create token and store only hash
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save();

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset/${token}`;

    try {
      await sendMail({
        to: user.email,
        subject: "StayCraft password reset",
        html: `
          <p>You requested a password reset for your StayCraft account.</p>
          <p>This link expires in <b>30 minutes</b>.</p>
          <p><a href="${resetLink}">Reset your password</a></p>
          <p>If you did not request this, ignore this email.</p>
        `,
      });
    } catch (mailErr) {
      console.error("MAIL ERROR:", mailErr.message);

      // cleanup token since email was not sent
      user.resetPasswordTokenHash = null;
      user.resetPasswordExpires = null;
      await user.save();

      req.flash("error", "Email service error. Please try again later.");
      return res.redirect("/forgot");
    }

    req.flash("success", genericMsg);
    return res.redirect("/forgot");
  } catch (err) {
    return next(err);
  }
};

module.exports.renderResetForm = async (req, res) => {
  const { token } = req.params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    req.flash("error", "Reset link is invalid or expired.");
    return res.redirect("/forgot");
  }

  return res.render("users/reset.ejs", { token });
};

module.exports.resetPassword = async (req, res) => {
  console.log("HIT POST", req.originalUrl); // ✅ you should see this in terminal

  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      req.flash("error", "Password must be at least 8 characters long.");
      return res.redirect(`/reset/${token}`);
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      req.flash("error", "Reset link is invalid or expired.");
      return res.redirect("/forgot");
    }

    // ✅ Use promise form (no callback wrapper)
    await user.setPassword(password);

    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    req.flash("success", "Password updated successfully. Please log in.");
    return res.redirect("/login");
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    req.flash("error", "Could not reset password. Please try again.");
    return res.redirect("/forgot");
  }
};
module.exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    verifyEmailTokenHash: tokenHash,
    verifyEmailExpires: { $gt: new Date() },
  });

  if (!user) {
    req.flash("error", "Verification link is invalid or expired.");
    return res.redirect("/verify-email/resend");
  }

  user.isEmailVerified = true;
  user.verifyEmailTokenHash = null;
  user.verifyEmailExpires = null;
  await user.save();

  req.flash("success", "Email verified successfully!");
  return res.redirect("/listings");
};

module.exports.renderResendVerify = (req, res) => {
  return res.render("users/resend-verify.ejs");
};

module.exports.resendVerify = async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  const user = await User.findOne({ email });

  // don't reveal whether user exists
  const msg = "If the email exists, a verification link has been sent.";

  if (!user) {
    req.flash("success", msg);
    return res.redirect("/verify-email/resend");
  }

  if (user.isEmailVerified) {
    req.flash("success", "Email is already verified. You can log in.");
    return res.redirect("/login");
  }

  try {
    await sendVerificationEmail(user);
    req.flash("success", msg);
    return res.redirect("/verify-email/resend");
  } catch (e) {
    console.error("VERIFY MAIL ERROR:", e.message);
    req.flash("error", "Could not send verification email. Try again later.");
    return res.redirect("/verify-email/resend");
  }
};
module.exports.renderSaved = async (req, res) => {
  const user = await User.findById(req.user._id).populate("savedListings");
  return res.render("users/saved.ejs", { savedListings: user.savedListings });
};

module.exports.clearSaved = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $set: { savedListings: [] } });

  // JSON support (optional)
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.json({ ok: true });
  }

  req.flash("success", "Cleared all saved listings.");
  return res.redirect("/saved");
};