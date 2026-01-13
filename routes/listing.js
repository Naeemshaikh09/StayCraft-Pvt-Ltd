const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapasync.js");
const { verifyCsrf } = require("../utils/csrf");

const { isLoggedIn, isOwner, isVerified, validateListing, validateObjectId } = require("../middelware.js");
const listingController = require("../controllers/listings.js");

const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB

const fileFilter = (req, file, cb) => {
  // allow only common image types
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) return cb(null, true);

  const err = new Error("Only JPG, PNG, or WEBP images are allowed.");
  err.code = "INVALID_FILE_TYPE";
  cb(err);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter,
});

router
  .route("/")
  .get(wrapAsync(listingController.indexListing))
  .post(isLoggedIn, isVerified, upload.single("listing[image]"), verifyCsrf, validateListing, wrapAsync(listingController.createRoute))

router.get("/new", isLoggedIn, isVerified, listingController.renderNew);
router.post("/:id/save", validateObjectId("id"), isLoggedIn, verifyCsrf, wrapAsync(listingController.toggleSave));

router
  .route("/:id")
  .get(validateObjectId("id"), wrapAsync(listingController.showRoute))
  .put(validateObjectId("id"), isLoggedIn, isOwner, upload.single("listing[image]"), verifyCsrf, validateListing, wrapAsync(listingController.updateRoute))
  .delete(validateObjectId("id"), isLoggedIn, isOwner, wrapAsync(listingController.destroyRoute)); // global CSRF covers it

router.get("/:id/edit", validateObjectId("id"), isLoggedIn, isOwner, wrapAsync(listingController.editRoute));

module.exports = router;