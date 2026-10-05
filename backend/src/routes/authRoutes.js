const express = require("express");

const {
    startRegistration,
    verifyRegistration,
    resendVerification,
    login
} = require("../controllers/authController");

const router =
    express.Router();


/* =========================
   REGISTRATION
========================= */

router.post(
    "/register/start",
    startRegistration
);


router.post(
    "/register/verify",
    verifyRegistration
);


router.post(
    "/register/resend",
    resendVerification
);


/* =========================
   LOGIN
========================= */

router.post(
    "/login",
    login
);


module.exports = router;