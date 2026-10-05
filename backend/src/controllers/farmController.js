const db = require("../config/database");

// ======================================
// CREATE FARM
// ======================================
const createFarm = async (req, res) => {
    try {
        const {
            farm_name,
            address,
            region_name,
            latitude,
            longitude
        } = req.body;

        // Validate required fields
        if (
            !farm_name ||
            !address ||
            !region_name ||
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Farm name, address, region, latitude, and longitude are required."
            });
        }

        // Validate coordinates
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

        // Create location record
        const [locationResult] = await db.query(
            `INSERT INTO locations
            (region_name, latitude, longitude)
            VALUES (?, ?, ?)`,
            [region_name, lat, lng]
        );

        const locationId = locationResult.insertId;

        // Create farm record
        const [farmResult] = await db.query(
            `INSERT INTO farms
            (farm_name, address, owner_id, location_id)
            VALUES (?, ?, ?, ?)`,
            [
                farm_name,
                address,
                req.user.user_id,
                locationId
            ]
        );

        res.status(201).json({
            success: true,
            message: "Farm created successfully.",
            farm: {
                farm_id: farmResult.insertId,
                farm_name,
                address,
                owner_id: req.user.user_id,
                location_id: locationId,
                latitude: lat,
                longitude: lng
            }
        });

    } catch (error) {
        console.error("Create farm error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while creating farm."
        });
    }
};

// ======================================
// GET ALL FARMS
// ======================================
// ======================================
// GET FARMS
// ======================================
const getFarms = async (req, res) => {
    try {
        let query = `
            SELECT
                f.farm_id,
                f.farm_name,
                f.address,
                f.owner_id,
                f.location_id,
                l.region_name,
                l.latitude,
                l.longitude,
                f.created_at
            FROM farms f
            INNER JOIN locations l
                ON f.location_id = l.location_id
        `;

        const params = [];

        // Farmer can only see their own farm
        if (req.user.role === "farmer") {
            query += `
                WHERE f.owner_id = ?
            `;

            params.push(
                req.user.user_id
            );
        }

        query += `
            ORDER BY f.created_at DESC
        `;

        const [farms] =
            await db.query(
                query,
                params
            );

        res.json({
            success: true,
            count: farms.length,
            farms
        });

    } catch (error) {
        console.error(
            "Get farms error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Server error while retrieving farms."
        });
    }
};

// ======================================
// GET FARM BY ID
// ======================================
// ======================================
// GET FARM BY ID
// ======================================
const getFarmById = async (req, res) => {
    try {
        const { id } =
            req.params;

        const [farms] =
            await db.query(
                `
                SELECT
                    f.farm_id,
                    f.farm_name,
                    f.address,
                    f.owner_id,
                    f.location_id,
                    l.region_name,
                    l.latitude,
                    l.longitude,
                    f.created_at
                FROM farms f
                INNER JOIN locations l
                    ON f.location_id =
                       l.location_id
                WHERE f.farm_id = ?
                `,
                [id]
            );

        if (farms.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Farm not found."
            });
        }

        const farm =
            farms[0];

        // Farmer can only access their own farm
        if (
            req.user.role === "farmer" &&
            farm.owner_id !==
                req.user.user_id
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You do not have permission to access this farm."
            });
        }

        res.json({
            success: true,
            farm
        });

    } catch (error) {
        console.error(
            "Get farm error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Server error while retrieving the farm."
        });
    }
};

module.exports = {
    createFarm,
    getFarms,
    getFarmById
};