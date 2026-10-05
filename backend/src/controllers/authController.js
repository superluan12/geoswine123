const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const db = require("../config/database");
const {
    sendVerificationEmail
} = require("../services/emailService");


/* =========================================================
   HELPERS
========================================================= */

function generateVerificationCode() {
    return crypto
        .randomInt(100000, 1000000)
        .toString();
}


function hashVerificationCode(code) {
    return crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");
}


/* =========================================================
   START REGISTRATION
========================================================= */

const startRegistration = async (req, res) => {
    try {
        const {
            last_name,
            first_name,
            middle_initial,
            email,
            phone_number,
            username,
            password,
            farm_name,
            farm_address,
            latitude,
            longitude,
            terms_accepted
        } = req.body;

        // ==============================
        // REQUIRED FIELDS
        // ==============================
        if (
            !last_name ||
            !first_name ||
            !email ||
            !phone_number ||
            !password ||
            !farm_name ||
            !farm_address ||
            latitude === undefined ||
            longitude === undefined ||
            !terms_accepted
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        // ==============================
        // NAME VALIDATION
        // ==============================
        if (last_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Invalid last name."
            });
        }

        if (first_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Invalid first name."
            });
        }

        // ==============================
        // EMAIL VALIDATION
        // ==============================
        const normalizedEmail =
            email.trim().toLowerCase();

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address."
            });
        }

        // ==============================
        // PHONE VALIDATION
        // ==============================
        const normalizedPhone =
            phone_number.trim();

        if (!/^(09\d{9}|\+639\d{9})$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid Philippine phone number."
            });
        }

        // ==============================
        // PASSWORD VALIDATION
        // ==============================
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 8 characters long."
            });
        }

        // ==============================
        // COORDINATE VALIDATION
        // ==============================
        const lat = Number(latitude);
        const lng = Number(longitude);

        if (
            !Number.isFinite(lat) ||
            lat < -90 ||
            lat > 90
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid latitude."
            });
        }

        if (
            !Number.isFinite(lng) ||
            lng < -180 ||
            lng > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid longitude."
            });
        }

        // ==============================
        // CHECK EXISTING ACCOUNT
        // ==============================
        const [existingUsers] = await db.query(
            `
            SELECT
                user_id,
                email,
                phone_number
            FROM users
            WHERE email = ?
               OR phone_number = ?
            `,
            [
                normalizedEmail,
                normalizedPhone
            ]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "An account already exists using that email or phone number."
            });
        }

        // ==============================
        // HASH PASSWORD
        // ==============================
        const passwordHash =
            await bcrypt.hash(password, 10);

        // ==============================
        // GENERATE VERIFICATION CODE
        // ==============================
        const verificationCode =
            generateVerificationCode();

        const verificationCodeHash =
            hashVerificationCode(
                verificationCode
            );

        const termsAcceptedAt =
            new Date();

        const termsVersion =
            "1.0";

        const expiresAt =
            new Date(
                Date.now() + 10 * 60 * 1000
            );

        // Remove previous pending registration
        await db.query(
            `
            DELETE FROM email_verifications
            WHERE email = ?
            `,
            [normalizedEmail]
        );

        // ==============================
        // SAVE TEMPORARY REGISTRATION
        // ==============================
        await db.query(
            `
            INSERT INTO email_verifications
            (
                username,
                last_name,
                first_name,
                middle_initial,
                email,
                phone_number,
                farm_name,
                farm_address,
                latitude,
                longitude,
                password_hash,
                verification_code_hash,
                terms_accepted_at,
                terms_version,
                expires_at
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                null,
                last_name.trim(),
                first_name.trim(),
                middle_initial
                    ? middle_initial.trim()
                    : null,
                normalizedEmail,
                normalizedPhone,
                farm_name.trim(),
                farm_address.trim(),
                lat,
                lng,
                passwordHash,
                verificationCodeHash,
                termsAcceptedAt,
                termsVersion,
                expiresAt
            ]
        );

        // ==============================
        // SEND EMAIL
        // ==============================
        await sendVerificationEmail(
            normalizedEmail,
            verificationCode
        );

        res.status(200).json({
            success: true,
            message:
                "Verification code sent to your email.",
            email: normalizedEmail
        });

    } catch (error) {
        console.error(
            "Start registration error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Server error while starting registration."
        });
    }
};


/* =========================================================
   VERIFY EMAIL
========================================================= */

const verifyRegistration = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: "Email and verification code are required."
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: "Please enter the 6-digit verification code."
            });
        }

        // ==============================
        // FIND PENDING REGISTRATION
        // ==============================
        const [verifications] = await db.query(
            `
            SELECT
                verification_id,
                last_name,
                first_name,
                middle_initial,
                email,
                phone_number,
                farm_name,
                farm_address,
                latitude,
                longitude,
                password_hash,
                verification_code_hash,
                terms_accepted_at,
                terms_version,
                expires_at
            FROM email_verifications
            WHERE email = ?
            ORDER BY verification_id DESC
            LIMIT 1
            `,
            [normalizedEmail]
        );

        if (verifications.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No pending registration found."
            });
        }

        const verification = verifications[0];

        // ==============================
        // CHECK EXPIRATION
        // ==============================
        if (
            new Date(verification.expires_at) <
            new Date()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Verification code has expired. Please request a new code."
            });
        }

        // ==============================
        // CHECK CODE
        // ==============================
        const submittedCodeHash =
            hashVerificationCode(code);

        if (
            submittedCodeHash !==
            verification.verification_code_hash
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification code."
            });
        }

        // ==============================
        // START TRANSACTION
        // ==============================
        await connection.beginTransaction();

        // ==============================
        // CREATE USER
        // ==============================
        const [userResult] = await connection.query(
            `
            INSERT INTO users
            (
                last_name,
                first_name,
                middle_initial,
                username,
                email,
                phone_number,
                password_hash,
                terms_accepted_at,
                terms_version,
                role
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                verification.last_name,
                verification.first_name,
                verification.middle_initial || null,
                null,
                verification.email,
                verification.phone_number,
                verification.password_hash,
                verification.terms_accepted_at,
                verification.terms_version,
                "farmer"
            ]
        );

        const userId =
            userResult.insertId;

        // ==============================
        // CREATE LOCATION
        // ==============================
        const [locationResult] =
            await connection.query(
                `
                INSERT INTO locations
                (
                    region_name,
                    latitude,
                    longitude
                )
                VALUES (?, ?, ?)
                `,
                [
                    null,
                    verification.latitude,
                    verification.longitude
                ]
            );

        const locationId =
            locationResult.insertId;

        // ==============================
        // CREATE FARM
        // ==============================
        await connection.query(
            `
            INSERT INTO farms
            (
                farm_name,
                address,
                owner_id,
                location_id
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                verification.farm_name,
                verification.farm_address,
                userId,
                locationId
            ]
        );

        // ==============================
        // REMOVE TEMPORARY REGISTRATION
        // ==============================
        await connection.query(
            `
            DELETE FROM email_verifications
            WHERE verification_id = ?
            `,
            [verification.verification_id]
        );

        await connection.commit();

        // ==============================
        // CREATE LOGIN TOKEN
        // ==============================
        const token = jwt.sign(
            {
                user_id: userId,
                email: verification.email,
                role: "farmer"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.status(201).json({
            success: true,
            message:
                "Email verified. Farmer account and farm registered successfully.",
            token,
            user: {
                user_id: userId,
                last_name: verification.last_name,
                first_name: verification.first_name,
                middle_initial:
                    verification.middle_initial,
                email: verification.email,
                phone_number:
                    verification.phone_number,
                role: "farmer"
            }
        });

    } catch (error) {
        await connection.rollback();

        console.error(
            "Verify registration error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Server error while completing registration."
        });

    } finally {
        connection.release();
    }
};


/* =========================================================
   RESEND VERIFICATION CODE
========================================================= */

const resendVerification = async (req, res) => {

    try {

        const { email } =
            req.body;


        if (!email) {

            return res.status(400).json({
                message:
                    "Email is required."
            });
        }


        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        const [rows] =
            await db.query(
                `
                SELECT *
                FROM email_verifications
                WHERE email = ?
                LIMIT 1
                `,
                [cleanEmail]
            );


        if (rows.length === 0) {

            return res.status(404).json({
                message:
                    "No pending registration was found for this email."
            });
        }


        const verification =
            rows[0];


        /* =========================
           NEW CODE
        ========================= */

        const verificationCode =
            generateVerificationCode();

        const verificationCodeHash =
            hashVerificationCode(
                verificationCode
            );


        const expiresAt =
            new Date(
                Date.now() +
                10 * 60 * 1000
            );


        await db.query(
            `
            UPDATE email_verifications
            SET
                verification_code_hash = ?,
                expires_at = ?
            WHERE verification_id = ?
            `,
            [
                verificationCodeHash,
                expiresAt,
                verification.verification_id
            ]
        );


        await sendVerificationEmail(
            cleanEmail,
            verificationCode
        );


        return res.status(200).json({
            message:
                "A new verification code has been sent."
        });


    } catch (error) {

        console.error(
            "Resend verification error:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to resend verification code."
        });
    }
};


/* =========================================================
   LOGIN
========================================================= */

const login = async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        if (!username || !password) {

            return res.status(400).json({
                message:
                    "Username and password are required."
            });
        }


        const [rows] =
    await db.query(
        `
        SELECT
            user_id,
            username,
            email,
            phone_number,
            password_hash,
            terms_accepted_at,
            terms_version,
            role
        FROM users
        WHERE email = ?
           OR phone_number = ?
        LIMIT 1
        `,
        [username, username]
    );


        if (rows.length === 0) {

            return res.status(401).json({
                message:
                    "Invalid username or password."
            });
        }


        const user =
            rows[0];


        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordMatches) {

            return res.status(401).json({
                message:
                    "Invalid username or password."
            });
        }


        const token =
            jwt.sign(
                {
                    user_id:
                        user.user_id,
                    username:
                        user.username,
                    email:
                        user.email,
                    role:
                        user.role
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "8h"
                }
            );


        return res.status(200).json({

            message:
                "Login successful.",

            token,

            user: {
                user_id:
                    user.user_id,
                username:
                    user.username,
                email:
                    user.email,
                phone_number:
                    user.phone_number,
                role:
                    user.role
            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to login."
        });
    }
};


module.exports = {
    startRegistration,
    verifyRegistration,
    resendVerification,
    login
};