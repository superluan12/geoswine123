const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(
        process.env.SMTP_PORT || 587
    ),
    secure:
        String(
            process.env.SMTP_SECURE
        ).toLowerCase() === "true",

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});


async function sendVerificationEmail(
    to,
    code
) {

    const fromAddress =
        process.env.SMTP_FROM ||
        `GeoSwine <${process.env.SMTP_USER}>`;


    await transporter.sendMail({

        from: fromAddress,

        to,

        subject:
            "GeoSwine Email Verification Code",

        text:
`Hello,

Your GeoSwine email verification code is:

${code}

This code will expire in 10 minutes.

If you did not create a GeoSwine account, you can ignore this email.

GeoSwine System`,

        html: `
            <div
                style="
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                "
            >

                <h2>
                    GeoSwine Email Verification
                </h2>

                <p>
                    Hello,
                </p>

                <p>
                    Your GeoSwine email verification
                    code is:
                </p>

                <div
                    style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        margin: 20px 0;
                    "
                >
                    ${code}
                </div>

                <p>
                    This code will expire in
                    <strong>10 minutes</strong>.
                </p>

                <p>
                    If you did not create a
                    GeoSwine account, you can
                    ignore this email.
                </p>

                <p>
                    GeoSwine System
                </p>

            </div>
        `
    });
}


async function verifyEmailTransport() {

    await transporter.verify();

    return true;
}


module.exports = {
    sendVerificationEmail,
    verifyEmailTransport
};