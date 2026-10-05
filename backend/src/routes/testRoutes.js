const express = require("express");
const {
    authenticateToken,
    requireRole
} = require("../middleware/authMiddleware");

const router = express.Router();

// Any logged-in user
router.get("/profile", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "You accessed a protected route.",
        user: req.user
    });
});

// Farmer only
router.get(
    "/farmer-only",
    authenticateToken,
    requireRole("farmer"),
    (req, res) => {
        res.json({
            success: true,
            message: "Farmer access granted.",
            user: req.user
        });
    }
);

// Admin only
router.get(
    "/admin-only",
    authenticateToken,
    requireRole("admin"),
    (req, res) => {
        res.json({
            success: true,
            message: "Admin access granted.",
            user: req.user
        });
    }
);

module.exports = router;