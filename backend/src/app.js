const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const db = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const farmRoutes = require("./routes/farmRoutes");
const outbreakRoutes = require("./routes/outbreakRoutes");
const proximityRoutes = require("./routes/proximityRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded files
app.use("/uploads", express.static("uploads"));

// ROUTES

// Root
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "GeoSwine API is running"
    });
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "GeoSwine backend is healthy"
    });
});

// Database test
app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS result");

        res.json({
            success: true,
            message: "Database connection successful",
            database: rows[0]
        });
    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
});

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/farms", farmRoutes);
app.use("/api/outbreaks", outbreakRoutes);
app.use("/api/proximity", proximityRoutes);
// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
    console.log(`GeoSwine API running at http://localhost:${PORT}`);
});