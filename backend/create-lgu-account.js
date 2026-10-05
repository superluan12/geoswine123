const bcrypt = require("bcryptjs");
const db = require("./src/config/database");

async function createLGUAccount() {
    try {
        const username = "lgu01";
        const email = "lgu01@geoswine.local";
        const password = "Password123!";
        const phone = "09123456789";

        const passwordHash = await bcrypt.hash(password, 10);

        const [existing] = await db.query(
            "SELECT user_id FROM users WHERE username = ? OR email = ?",
            [username, email]
        );

        if (existing.length > 0) {
            console.log("LGU account already exists.");
            process.exit(0);
        }

        const [result] = await db.query(
            `INSERT INTO users
            (
                username,
                email,
                phone_number,
                password_hash,
                terms_accepted_at,
                terms_version,
                role
            )
            VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
            [
                username,
                email,
                phone,
                passwordHash,
                "1.0",
                "lgu_officer"
            ]
        );

        console.log("LGU Officer account created successfully.");
        console.log("User ID:", result.insertId);
        console.log("Username:", username);
        console.log("Password:", password);

    } catch (error) {
        console.error("Error creating LGU account:", error);
    } finally {
        await db.end();
    }
}

createLGUAccount();