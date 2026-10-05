// ==========================================
// HAVERSINE DISTANCE CALCULATOR
// Returns distance in kilometers
// ==========================================

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const earthRadiusKm = 6371;

    const toRadians = (degrees) => {
        return degrees * (Math.PI / 180);
    };

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return earthRadiusKm * c;
};

// ==========================================
// RISK CLASSIFICATION
// ==========================================

const classifyRisk = (distanceKm) => {
    if (distanceKm <= 1) {
        return "High Risk";
    }

    if (distanceKm <= 7) {
        return "Medium Risk";
    }

    if (distanceKm <= 10) {
        return "Low Risk";
    }

    return "Outside Risk Range";
};

module.exports = {
    calculateDistance,
    classifyRisk
};