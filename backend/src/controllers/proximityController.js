const db = require("../config/database");

const {
    calculateDistance,
    classifyRisk
} = require("../utils/haversine");

// ==========================================
// PROXIMITY ANALYSIS FOR AN OUTBREAK
// ==========================================

const analyzeProximity = async (req, res) => {
    try {
        const { reportId } = req.params;

        // Get outbreak report
        const [reports] = await db.query(
            `SELECT
                report_id,
                latitude,
                longitude,
                description,
                status,
                date_reported
             FROM outbreak_reports
             WHERE report_id = ?`,
            [reportId]
        );

        if (reports.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Outbreak report not found."
            });
        }

        const outbreak = reports[0];

        // Get all farms and their coordinates
        const [farms] = await db.query(
            `SELECT
                f.farm_id,
                f.farm_name,
                f.address,
                f.owner_id,
                l.region_name,
                l.latitude,
                l.longitude
             FROM farms f
             INNER JOIN locations l
                 ON f.location_id = l.location_id`
        );

        const nearbyFarms = [];

        // Calculate distance from outbreak to every farm
        for (const farm of farms) {
            const distanceKm = calculateDistance(
                Number(outbreak.latitude),
                Number(outbreak.longitude),
                Number(farm.latitude),
                Number(farm.longitude)
            );

            // Only include farms within 10 km
            if (distanceKm <= 10) {
                nearbyFarms.push({
                    farm_id: farm.farm_id,
                    farm_name: farm.farm_name,
                    address: farm.address,
                    owner_id: farm.owner_id,
                    region_name: farm.region_name,
                    latitude: Number(farm.latitude),
                    longitude: Number(farm.longitude),
                    distance_km: Number(distanceKm.toFixed(3)),
                    risk_level: classifyRisk(distanceKm)
                });
            }
        }

        // Nearest farms first
        nearbyFarms.sort((a, b) => {
            return a.distance_km - b.distance_km;
        });

        res.json({
            success: true,
            outbreak: {
                report_id: outbreak.report_id,
                latitude: Number(outbreak.latitude),
                longitude: Number(outbreak.longitude),
                description: outbreak.description,
                status: outbreak.status,
                date_reported: outbreak.date_reported
            },
            radius_km: 10,
            nearby_farms_count: nearbyFarms.length,
            nearby_farms: nearbyFarms
        });

    } catch (error) {
        console.error("Proximity analysis error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during proximity analysis."
        });
    }
};

module.exports = {
    analyzeProximity
};