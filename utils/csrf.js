const crypto = require("crypto");

const csrfToken = (req, res, next) => {
  if (req.session) {
    // touch session so cookie is created even with saveUninitialized:false
    req.session._csrfInit = true;

    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
};

const verifyCsrf = (req, res, next) => {
  const sent = req.body?._csrf;
  const expected = req.session?.csrfToken;

  if (!sent || !expected || sent !== expected) {
    const err = new Error("Form expired or invalid. Please try again.");
    err.code = "EBADCSRFTOKEN";
    return next(err);
  }
  next();
};

module.exports = { csrfToken, verifyCsrf };