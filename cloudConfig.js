const cloudinary = require("cloudinary"); // ✅ not .v2
const cloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = cloudinaryStorage({
  cloudinary: cloudinary, // ✅ pass whole module
  folder: "staycraft_dev",
  allowedFormats: ["jpg", "jpeg", "png","webp"],
});

module.exports = { cloudinary, storage };