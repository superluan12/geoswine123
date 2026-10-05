const db = require("../config/database");

// ======================================
// CREATE OUTBREAK REPORT
// ======================================
const createOutbreakReport = async (req, res) => {
    try {
        const {
            farm_id,
            latitude,
            longitude,
            description
        } = req.body;

        // Validate coordinates
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required."
            });
        }

        const lat = Number(latitude);
        const lng = Number(longitude);

        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({
                success: false,
                message: "Invalid latitude."
            });
        }

        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            return res.status(400).json({
                success: false,
                message: "Invalid longitude."
            });
        }

        // Farmers must report from their own registered farm
if (
    farm_id === undefined ||
    farm_id === null ||
    farm_id === ""
) {
    return res.status(400).json({
        success: false,
        message: "Farm ID is required."
    });
}

const [farms] = await db.query(
    `
    SELECT
        farm_id,
        owner_id
    FROM farms
    WHERE farm_id = ?
    `,
    [farm_id]
);

if (farms.length === 0) {
    return res.status(404).json({
        success: false,
        message: "Farm not found."
    });
}

if (
    farms[0].owner_id !==
    req.user.user_id
) {
    return res.status(403).json({
        success: false,
        message:
            "You can only submit a report for your own farm."
    });
}

        // Uploaded photo path
        const photo = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        // Create the report
        const [result] = await db.query(
            `INSERT INTO outbreak_reports
            (
                farm_id,
                reporter_id,
                latitude,
                longitude,
                photo,
                description,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [
                farm_id || null,
                req.user.user_id,
                lat,
                lng,
                photo,
                description || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Outbreak report submitted successfully.",
            report: {
                report_id: result.insertId,
                farm_id: farm_id || null,
                reporter_id: req.user.user_id,
                latitude: lat,
                longitude: lng,
                photo,
                description: description || null,
                status: "pending"
            }
        });

    } catch (error) {
        console.error("Create outbreak report error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while creating outbreak report."
        });
    }
};

// ======================================
// GET OUTBREAK REPORTS
// ======================================

// ======================================
// GET OUTBREAK REPORTS
// ======================================
const getOutbreakReports = async (req, res) => {
    try {
        let query = `
            SELECT
                o.report_id,
                o.farm_id,
                o.reporter_id,
                u.username AS reporter,
                o.date_reported,
                o.latitude,
                o.longitude,
                o.photo,
                o.description,
                o.status,
                o.reviewed_at,
                o.reviewed_by,
                reviewer.username AS reviewer,
                o.created_at,
                f.farm_name
            FROM outbreak_reports o
            INNER JOIN users u
                ON o.reporter_id = u.user_id
            LEFT JOIN users reviewer
                ON o.reviewed_by = reviewer.user_id
            LEFT JOIN farms f
                ON o.farm_id = f.farm_id
        `;

        const params = [];

        // Farmers can only see their own reports
        if (req.user.role === "farmer") {
            query += ` WHERE o.reporter_id = ? `;
            params.push(req.user.user_id);
        }

        query += ` ORDER BY o.created_at DESC `;

        const [reports] = await db.query(query, params);

        return res.json({
            success: true,
            count: reports.length,
            reports
        });

    } catch (error) {
        console.error(
            "Get outbreak reports error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving outbreak reports.",
            error: error.message
        });
    }
};

// ======================================
// GET OUTBREAK REPORT BY ID
// ======================================
const getOutbreakReportById = async (req, res) => {
    try {
        const { id } = req.params;

        const [reports] = await db.query(`
            SELECT
                o.report_id,
                o.farm_id,
                o.reporter_id,
                u.username AS reporter,
                o.date_reported,
                o.latitude,
                o.longitude,
                o.photo,
                o.description,
                o.status,
                o.created_at,
                o.reviewed_at,
                o.reviewed_by,
                reviewer.username AS reviewer,
                f.farm_name
            FROM outbreak_reports o
            INNER JOIN users u
                ON o.reporter_id = u.user_id

            LEFT JOIN farms f
                ON o.farm_id = f.farm_id
                ON o.reviewed_by = reviewer.user_id
            WHERE o.report_id = ?
        `, [id]);

        if (reports.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Outbreak report not found."
            });
        }

        res.json({
            success: true,
            report: reports[0]
        });

    } catch (error) {
        console.error("Get outbreak report error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while retrieving outbreak report."
        });
    }
};
// ======================================
// UPDATE OUTBREAK REPORT STATUS
// ======================================
const updateOutbreakStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Only these review decisions are allowed
        if (!["validated", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be validated or rejected."
            });
        }

        // Check if report exists
        const [reports] = await db.query(
            `
            SELECT
                report_id,
                status
            FROM outbreak_reports
            WHERE report_id = ?
            `,
            [id]
        );

        if (reports.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Outbreak report not found."
            });
        }

        // Only pending reports can be reviewed
        if (String(reports[0].status).toLowerCase() !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Only pending reports can be reviewed."
            });
        }

        // Update status
        await db.query(
    `
    UPDATE outbreak_reports
    SET
        status = ?,
        reviewed_at = NOW(),
        reviewed_by = ?
    WHERE report_id = ?
    `,
    [
        status,
        req.user.user_id,
        id
    ]
);

        res.json({
            success: true,
            message: `Outbreak report ${status} successfully.`,
            report: {
                report_id: Number(id),
                status
            }
        });

    } catch (error) {
        console.error(
            "Update outbreak status error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Server error while updating outbreak report status."
        });
    }
};
// ======================================
// GET OUTBREAKS FOR MAP
// ======================================
const getMapOutbreaks = async (req, res) => {
    try {
        let query;
        let params = [];

        // ======================================
        // FARMER
        // Only return validated/active outbreak
        // locations. Do NOT return other farm
        // information.
        // ======================================
        if (req.user.role === "farmer") {

            query = `
                SELECT
                    report_id,
                    latitude,
                    longitude,
                    status,
                    date_reported,
                    description,
                    created_at
                FROM outbreak_reports
                WHERE LOWER(status) IN ('validated', 'active')
                ORDER BY created_at DESC
            `;

        } else {

            // ======================================
            // LGU / ADMIN
            // Return full map information
            // ======================================

            query = `
                SELECT
                    o.report_id,
                    o.farm_id,
                    o.reporter_id,
                    u.username AS reporter,
                    o.date_reported,
                    o.latitude,
                    o.longitude,
                    o.photo,
                    o.description,
                    o.status,
                    o.reviewed_at,
                    o.reviewed_by,
                    reviewer.username AS reviewer,
                    o.created_at,
                    f.farm_name,
                    f.address
                FROM outbreak_reports o

                INNER JOIN users u
                    ON o.reporter_id = u.user_id

                LEFT JOIN users reviewer
                    ON o.reviewed_by = reviewer.user_id

                LEFT JOIN farms f
                    ON o.farm_id = f.farm_id

                ORDER BY o.created_at DESC
            `;
        }

        const [reports] = await db.query(
            query,
            params
        );

        return res.json({
            success: true,
            count: reports.length,
            reports
        });

    } catch (error) {

        console.error(
            "Get map outbreaks error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error while retrieving map outbreaks."
        });
    }
};

module.exports = {
    createOutbreakReport,
    getOutbreakReports,
    getMapOutbreaks,
    getOutbreakReportById,
    updateOutbreakStatus
};
