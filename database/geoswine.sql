CREATE DATABASE IF NOT EXISTS geoswine;

USE geoswine;

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role ENUM('admin', 'lgu_officer', 'farmer') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- LOCATIONS
-- =========================
CREATE TABLE IF NOT EXISTS locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    region_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- FARMS
-- =========================
CREATE TABLE IF NOT EXISTS farms (
    farm_id INT AUTO_INCREMENT PRIMARY KEY,
    farm_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    owner_id INT NOT NULL,
    location_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_farm_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_farm_location
        FOREIGN KEY (location_id)
        REFERENCES locations(location_id)
        ON DELETE CASCADE
);

-- =========================
-- OUTBREAK REPORTS
-- =========================
CREATE TABLE IF NOT EXISTS outbreak_reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    farm_id INT NULL,
    reporter_id INT NOT NULL,
    date_reported DATETIME DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    photo VARCHAR(500) NULL,
    description TEXT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_report_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_reporter
        FOREIGN KEY (reporter_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);