const express = require("express");
const multer = require("multer");
const path = require("path");

const {
    createOutbreakReport,
    getOutbreakReports,
    getMapOutbreaks,
    getOutbreakReportById,
    updateOutbreakStatus
} = require("../controllers/outbreakController");

const {
    authenticateToken,
    requireRole
} = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================
// PHOTO UPLOAD CONFIGURATION
// ======================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);

        const filename =
            `outbreak-${Date.now()}-${Math.round(Math.random() * 1E9)}${extension}`;

        cb(null, filename);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/jpg",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(
                new Error("Only JPG, PNG, and WEBP images are allowed.")
            );
        }

        cb(null, true);
    }
});

// ======================================
// ROUTES
// ======================================

// Create report
router.post(
    "/",
    authenticateToken,
    upload.single("photo"),
    createOutbreakReport
);

// Get all reports
router.get(
    "/",
    authenticateToken,
    getOutbreakReports
);
// Get outbreaks for map
router.get(
    "/map",
    authenticateToken,
    getMapOutbreaks
);
// Review outbreak report
router.patch(
    "/:id/status",
    authenticateToken,
    requireRole("lgu_officer", "admin"),
    updateOutbreakStatus
);

// Get one report
router.get(
    "/:id",
    authenticateToken,
    getOutbreakReportById
);

module.exports = router;