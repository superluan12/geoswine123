const express = require("express");

const {
    createFarm,
    getFarms,
    getFarmById
} = require("../controllers/farmController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

// Create a farm
router.post(
    "/",
    authenticateToken,
    createFarm
);

// Get all farms
router.get(
    "/",
    authenticateToken,
    getFarms
);

// Get a single farm
router.get(
    "/:id",
    authenticateToken,
    getFarmById
);

module.exports = router;