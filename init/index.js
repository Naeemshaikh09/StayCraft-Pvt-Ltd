// init/index.js

const mongoose = require("mongoose");
const Listing = require("../models/listing");
const dataDB = require("./data.js");
const User = require("../models/user"); 
// CHANGE THIS LINE:
const mongoose_url = 'mongodb://127.0.0.1:27017/WanderLust'; // Capital 'L'

async function main() {
    await mongoose.connect(mongoose_url);
    console.log("Database is connected");
    await initDB();
}

async function initDB() {
    // 1. Delete existing listings
    await Listing.deleteMany({});
    console.log("Existing listings cleared.");

    // 2. Find or create a default user for all listings
    let defaultUser = await User.findOne({ username: "seederUser" });

    if (!defaultUser) {
        console.log("No default 'seederUser' found. Creating one...");
        const newUser = new User({ email: "seeder@example.com", username: "seederUser" });
        defaultUser = await User.register(newUser, "seederpassword"); 
        console.log(`Default 'seederUser' created with ID: ${defaultUser._id}`);
    } else {
        console.log(`Using existing 'seederUser' with ID: ${defaultUser._id}`);
    }

    // 3. Transform the data to include the category and assign the defaultUser's ObjectId
    const listingsWithOwner = dataDB.data.map((obj) => ({
        ...obj,
        owner: defaultUser._id, 
    }));

    // 4. Insert the new listings
    await Listing.insertMany(listingsWithOwner);
    console.log("Data was initialized successfully!");
}

main().catch((err) => {
    console.error("Database connection error:", err);
});