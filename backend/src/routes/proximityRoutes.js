const express = require("express");

const {
    analyzeProximity
} = require("../controllers/proximityController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

// Analyze farms near an outbreak report
router.get(
    "/report/:reportId",
    authenticateToken,
    analyzeProximity
);

module.exports = router;