// app.js

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
console.log("NODE_ENV =", process.env.NODE_ENV);
const express = require("express");
const app = express();

// IMPORTANT (Render/any proxy):
// Fixes express-rate-limit X-Forwarded-For warning and helps secure cookies work behind proxy.
app.set("trust proxy", 1);

const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("./utils/flash");
const staticRouter = require("./routes/static.js");
const apiRouter = require("./routes/api.js");

const { csrfToken, verifyCsrf } = require("./utils/csrf");

const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const multer = require("multer");

const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const connectMongo = require("connect-mongo");
const MongoStore = connectMongo.default || connectMongo;

const listings = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// view + parsing
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser(process.env.SESSION_SECRET));

// -------------------- security middleware --------------------
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);

const cspDirectives = {
  defaultSrc: ["'self'"],

  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://unpkg.com",
  ],

  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com",
    "https://unpkg.com",
  ],

  fontSrc: [
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
    "https://cdnjs.cloudflare.com",
  ],

  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "https://res.cloudinary.com",
    "https://source.unsplash.com",
    "https://images.unsplash.com",
  ],

  // map libs / tiles
  connectSrc: [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
    "https://tiles.stadiamaps.com",
    "https://api.stadiamaps.com",
  ],

  workerSrc: ["'self'", "blob:"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'self'"],
};

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: cspDirectives,
  })
);

app.use(mongoSanitize());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// db
const dbUrl = process.env.ATLASDB_URL;
mongoose
  .connect(dbUrl)
  .then(() => console.log("✅ Database connected"))
  .catch(console.log);

// session store
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret: process.env.SESSION_SECRET || "dev_secret" },
  touchAfter: 24 * 3600,
});

const sessionOptions = {
  store,
  name: "staycraft.sid",
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// expose csrfToken to all ejs
app.use(csrfToken);

// global CSRF verification for non-multipart write requests
app.use((req, res, next) => {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!writeMethods.includes(req.method)) return next();

  const ct = req.headers["content-type"] || "";
  if (ct.startsWith("multipart/form-data")) return next(); // handled inside routes

  return verifyCsrf(req, res, next);
});

// passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// locals
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// routes
app.use("/api", apiRouter);
app.get("/", (req, res) => res.redirect("/listings"));
app.use("/listings", listings);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRouter);
app.use("/", staticRouter);

// error handlers
const safeBack = (req) => req.get("Referrer") || "/listings";

app.use((err, req, res, next) => {
  if (err?.code === "EBADCSRFTOKEN") {
    req.flash(
      "error",
      err.message || "Form expired or invalid. Please try again."
    );
    return res.redirect(safeBack(req));
  }
  next(err);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    req.flash("error", "Image too large. Max size is 4 MB.");
    return res.redirect(req.get("Referrer") || "/listings");
  }

  if (err && err.code === "INVALID_FILE_TYPE") {
    req.flash("error", err.message || "Invalid file type.");
    return res.redirect(req.get("Referrer") || "/listings");
  }

  next(err);
});

app.use((err, req, res, next) => {
  console.error(err);
  req.flash("error", err.message || "Something went wrong");
  return res.redirect(safeBack(req));
});

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Server running on port 3000")
);