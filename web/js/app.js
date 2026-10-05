const API_URL = "http://localhost:5000";

let map = null;
let proximityMap = null;

let farms = [];
let outbreaks = [];
let mapOutbreaks = [];

let currentUser = loadSavedUser();


/* =========================
   AUTH STORAGE
========================= */

function getToken() {
    return localStorage.getItem("geoswine_token");
}

function saveAuth(token, user) {
    localStorage.setItem("geoswine_token", token);
    localStorage.setItem("geoswine_user", JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem("geoswine_token");
    localStorage.removeItem("geoswine_user");
}

function loadSavedUser() {
    try {
        const value = localStorage.getItem("geoswine_user");
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}


/* =========================
   API
========================= */

async function apiRequest(endpoint, options = {}) {

    const headers = {
        ...(options.headers || {})
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (
        options.body &&
        !(options.body instanceof FormData)
    ) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message || "Request failed."
        );
    }

    return data;
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
/* =========================
   DATE AND TIME FORMATTING
========================= */
function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

/* =========================
   ROLE PERMISSIONS
========================= */

const ROLE_ACCESS = {

    admin: [
        "home",
        "outbreak-map",
        "case-reports",
        "risk-classification",
        "proximity-analysis"
    ],

    lgu_officer: [
        "home",
        "outbreak-map",
        "case-reports",
        "risk-classification",
        "proximity-analysis"
    ],

    farmer: [
        "home",
        "outbreak-map",
        "risk-classification"
    ]

};


function getUserRole() {

    return String(
        currentUser?.role || ""
    )
    .toLowerCase();

}


function canAccessPage(pageName) {

    if (
        pageName === "home" ||
        pageName === "login" ||
        pageName === "signup"
    ) {

        return true;
    }


    const role =
        getUserRole();


    if (
        !getToken() ||
        !role
    ) {

        return false;
    }


    return (
        ROLE_ACCESS[role] || []
    )
    .includes(
        pageName
    );
}


function updateRoleAccess() {

    const loggedIn =
        !!getToken() &&
        !!currentUser;


    const role =
        getUserRole();


    document
        .querySelectorAll(".nav-item")
        .forEach(
            button => {

                const pageName =
                    button.dataset.page;


                const allowed =
                    loggedIn &&
                    !!role &&
                    canAccessPage(
                        pageName
                    );


                button.style.display =
                    allowed
                        ? ""
                        : "none";
            }
        );
}

/* =========================
   PAGE NAVIGATION
========================= */

    function showPage(pageName) {
        if (
            !canAccessPage(pageName)
        ) {

        if (
            !getToken() ||
            !currentUser
        ) {

            pageName = "login";

        } else {

            pageName = "home";
        }
    }
    document
        .querySelectorAll(".page")
        .forEach(page => {
            page.classList.remove("active-page");
        });

    const page = document.getElementById(
        `page-${pageName}`
    );

    if (page) {
        page.classList.add("active-page");
    }

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === pageName
            );
        });

    if (pageName === "outbreak-map") {
        setTimeout(async () => {
            initializeMap();
            await loadMapData();
        }, 40);
    }

    if (pageName === "case-reports") {
        loadCaseReports();
    }

    if (pageName === "risk-classification") {
        loadRiskClassification();
    }

    if (pageName === "proximity-analysis") {
        setTimeout(() => {
            initializeProximityMap();
            populateOutbreakSelect();
        }, 40);
    }

    document
        .getElementById("sidebar")
        ?.classList.remove("mobile-open");
}


/* =========================
   AUTH UI
========================= */

function updateAuthUI() {

    const loggedIn =
        !!getToken() &&
        !!currentUser;

    const name =
        document.getElementById("accountName");

    const role =
        document.getElementById("accountRole");

    const avatar =
        document.getElementById("accountAvatar");

    const status =
        document.getElementById("accountStatus");

    const loginButton =
        document.getElementById("loginButton");

    const signupButton =
        document.getElementById("signupButton");

    const logoutButton =
        document.getElementById("logoutButton");

    if (loggedIn) {

        name.textContent =
            currentUser.username || "User";

        role.textContent =
            currentUser.role || "Account";

        avatar.textContent =
            (
                currentUser.username || "G"
            )
                .charAt(0)
                .toUpperCase();

        status.classList.add("online");

        loginButton.classList.add("hidden");
        signupButton.classList.add("hidden");
        logoutButton.classList.remove("hidden");

    } else {

        name.textContent = "Guest";
        role.textContent = "Not logged in";
        avatar.textContent = "G";

        status.classList.remove("online");

        loginButton.classList.remove("hidden");
        signupButton.classList.remove("hidden");
        logoutButton.classList.add("hidden");
    }
}


/* =========================
   LOGIN
========================= */

async function handleLogin(event) {

    event.preventDefault();

    const message =
        document.getElementById("loginMessage");

    message.textContent = "Signing in...";

    try {

        const username =
            document.getElementById(
                "loginUsername"
            ).value.trim();

        const password =
            document.getElementById(
                "loginPassword"
            ).value;

        const result = await apiRequest(
            "/api/auth/login",
            {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

        saveAuth(
            result.token,
            result.user
        );

        currentUser =
        result.user;
            updateAuthUI();
            updateRoleAccess();
            await loadAllData();

        message.textContent =
            "Login successful.";

        message.style.color =
            "var(--green)";

        document
            .getElementById("loginForm")
            .reset();

        showPage("home");

    } catch (error) {

        message.textContent =
            error.message;

        message.style.color =
            "var(--red)";
    }
}


/* =========================
   SIGNUP
========================= */

let pendingVerificationEmail = "";


async function handleSignup(event) {

    event.preventDefault();


    const message =
        document.getElementById(
            "signupMessage"
        );

    message.textContent =
        "Preparing registration...";

    message.style.color =
        "";


try {

    const lastName =
        document.getElementById(
            "signupLastName"
        ).value.trim();

    const firstName =
        document.getElementById(
            "signupFirstName"
        ).value.trim();

    const middleInitial =
        document.getElementById(
            "signupMiddleInitial"
        ).value.trim();

    const email =
        document.getElementById(
            "signupEmail"
        ).value.trim();

    const phoneNumber =
        document.getElementById(
            "signupPhone"
        ).value.trim();

    const password =
        document.getElementById(
            "signupPassword"
        ).value;

    const confirmPassword =
        document.getElementById(
            "signupConfirmPassword"
        ).value;

    const farmName =
        document.getElementById(
            "signupFarmName"
        ).value.trim();

    const farmAddress =
        document.getElementById(
            "signupFarmAddress"
        ).value.trim();

    const latitude =
        document.getElementById(
            "signupLatitude"
        ).value.trim();

    const longitude =
        document.getElementById(
            "signupLongitude"
        ).value.trim();

    const termsAccepted =
        document.getElementById(
            "signupTerms"
        ).checked;


        /* =========================
           CLIENT VALIDATION
        ========================= */

        if (
            password !==
            confirmPassword
        ) {

            throw new Error(
                "Passwords do not match."
            );
        }


        if (password.length < 8) {

            throw new Error(
                "Password must be at least 8 characters long."
            );
        }


        if (!termsAccepted) {

            throw new Error(
                "You must accept the Terms and Conditions."
            );
        }
const lat = Number(latitude);
const lng = Number(longitude);

if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
) {
    throw new Error(
        "Please enter a valid latitude or use My Current Location."
    );
}

if (
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
) {
    throw new Error(
        "Please enter a valid longitude or use My Current Location."
    );
}

        message.textContent =
            "Sending verification code...";


        /* =========================
           START REGISTRATION
        ========================= */

        const result =
            await apiRequest(
                "/api/auth/register/start",
                {
                    method: "POST",

                    body:
                    JSON.stringify({

                        last_name:
                            lastName,

                        first_name:
                            firstName,

                        middle_initial:
                            middleInitial,

                        email,

                        phone_number:
                            phoneNumber,

                        password,

                        farm_name:
                            farmName,

                        farm_address:
                            farmAddress,

                        latitude:
                            Number(latitude),

                        longitude:
                            Number(longitude),

                        terms_accepted:
                            termsAccepted
                    })
                }
            );


        pendingVerificationEmail =
            email;


        /* =========================
           SHOW VERIFICATION PANEL
        ========================= */

        document
            .getElementById(
                "signupForm"
            )
            .style.display = "none";


        const verificationPanel =
            document.getElementById(
                "verificationPanel"
            );


        verificationPanel.style.display =
            "block";


        const verificationDescription =
            document.getElementById(
                "verificationDescription"
            );


        verificationDescription.textContent =
            `Enter the 6-digit verification code sent to ${email}.`;


        message.textContent =
            "";


        document
            .getElementById(
                "verificationCode"
            )
            .focus();


    } catch (error) {

        message.textContent =
            error.message;

        message.style.color =
            "var(--red)";
    }
}

// ======================================
// GET CURRENT LOCATION
// ======================================
function getCurrentLocation() {
    const message =
        document.getElementById("locationMessage");

    const button =
        document.getElementById(
            "useCurrentLocationButton"
        );

    const latitudeInput =
        document.getElementById(
            "signupLatitude"
        );

    const longitudeInput =
        document.getElementById(
            "signupLongitude"
        );

    if (!navigator.geolocation) {
        message.textContent =
            "Geolocation is not supported by this browser.";

        message.style.color =
            "var(--red)";

        return;
    }

    button.disabled = true;
    button.textContent = "Getting Location...";

    message.textContent =
        "Requesting your current location...";

    message.style.color = "";

    navigator.geolocation.getCurrentPosition(
        position => {
            const latitude =
                position.coords.latitude;

            const longitude =
                position.coords.longitude;

            latitudeInput.value =
                latitude.toFixed(7);

            longitudeInput.value =
                longitude.toFixed(7);

            message.textContent =
                "Current location detected successfully.";

            message.style.color =
                "var(--green)";

            button.disabled = false;
            button.textContent =
                "My Current Location";
        },

        error => {
            console.error(
                "Geolocation error:",
                error
            );

            let errorMessage =
                "Unable to get your current location.";

            if (error.code === 1) {
                errorMessage =
                    "Location permission was denied.";
            } else if (error.code === 2) {
                errorMessage =
                    "Your location could not be determined.";
            } else if (error.code === 3) {
                errorMessage =
                    "Location request timed out.";
            }

            message.textContent =
                errorMessage;

            message.style.color =
                "var(--red)";

            button.disabled = false;
            button.textContent =
                "My Current Location";
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

/* =========================
   EMAIL VERIFICATION
========================= */

async function handleVerifyEmail() {

    const message =
        document.getElementById(
            "verificationMessage"
        );


    const code =
        document.getElementById(
            "verificationCode"
        ).value.trim();


    if (!pendingVerificationEmail) {

        message.textContent =
            "No pending registration was found.";

        message.style.color =
            "var(--red)";

        return;
    }


    if (!/^\d{6}$/.test(code)) {

        message.textContent =
            "Please enter the 6-digit verification code.";

        message.style.color =
            "var(--red)";

        return;
    }


    message.textContent =
        "Verifying email...";

    message.style.color =
        "";


    try {

        const result =
            await apiRequest(
                "/api/auth/register/verify",
                {
                    method: "POST",

                    body:
                        JSON.stringify({

                            email:
                                pendingVerificationEmail,

                            code
                        })
                }
            );


        /* =========================
           SAVE LOGIN
        ========================= */

        saveAuth(
            result.token,
            result.user
        );


        currentUser =
            result.user;


        updateAuthUI();
        updateRoleAccess();


        /* =========================
           SUCCESS MESSAGE
        ========================= */

        message.textContent =
            "Email verified. Your GeoSwine account has been created.";

        message.style.color =
            "var(--green)";


        /* =========================
           RESET SIGNUP
        ========================= */

        document
            .getElementById(
                "signupForm"
            )
            .reset();


        document
            .getElementById(
                "verificationCode"
            )
            .value = "";


        pendingVerificationEmail =
            "";


        /* =========================
           LOAD DATA
        ========================= */

        await loadAllData();


        /* =========================
           GO TO HOME
        ========================= */

        setTimeout(
            () => {

                document
                    .getElementById(
                        "verificationPanel"
                    )
                    .style.display =
                    "none";


                showPage(
                    "home"
                );

            },
            1000
        );


    } catch (error) {

        message.textContent =
            error.message;

        message.style.color =
            "var(--red)";
    }
}


/* =========================
   RESEND CODE
========================= */

async function handleResendCode() {

    const message =
        document.getElementById(
            "verificationMessage"
        );


    if (!pendingVerificationEmail) {

        message.textContent =
            "No pending registration was found.";

        message.style.color =
            "var(--red)";

        return;
    }


    message.textContent =
        "Sending a new verification code...";

    message.style.color =
        "";


    try {

        const result =
            await apiRequest(
                "/api/auth/register/resend",
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            email:
                                pendingVerificationEmail
                        })
                }
            );


        message.textContent =
            result.message ||
            "A new verification code has been sent.";

        message.style.color =
            "var(--green)";


    } catch (error) {

        message.textContent =
            error.message;

        message.style.color =
            "var(--red)";
    }
}

/* =========================
   LOGOUT
========================= */

function logout() {

    clearAuth();

    currentUser = null;

    farms = [];
    outbreaks = [];
    mapOutbreaks = [];

    if (map) {
        map.eachLayer(layer => {
            if (
                layer instanceof L.Circle ||
                layer instanceof L.CircleMarker
            ) {
                map.removeLayer(layer);
            }
        });
    }

    updateAuthUI();
    updateRoleAccess();

    showPage("login");
}


/* =========================
   FARMS
========================= */

async function loadFarms() {

    const result =
        await apiRequest("/api/farms");

    farms =
        result.farms || [];

    return farms;
}


/* =========================
   OUTBREAKS
========================= */

async function loadOutbreaks() {

    const result =
        await apiRequest("/api/outbreaks");

    outbreaks =
        result.reports || [];

    return outbreaks;
}
// ======================================
// MAP OUTBREAKS
// ======================================
async function loadMapOutbreaks() {

    const result =
        await apiRequest("/api/outbreaks/map");

    mapOutbreaks =
        result.reports || [];

    return mapOutbreaks;
}


/* =========================
   LOAD EVERYTHING
========================= */

async function loadAllData() {

    if (!getToken()) {
        return;
    }

    try {

        await Promise.all([
            loadFarms(),
            loadOutbreaks()
        ]);

        console.log(
            "Data loaded successfully."
        );

        console.log(
            "Farms:",
            farms
        );

        console.log(
            "Outbreaks:",
            outbreaks
        );

        // UPDATE DASHBOARD AFTER DATA LOAD
        updateDashboard();

    } catch (error) {

        console.error(
            "Data loading error:",
            error
        );
    }
}


/* =========================
   DASHBOARD
========================= */

function updateDashboard() {

    document.getElementById(
        "registeredFarms"
    ).textContent = farms.length;

    const active =
    outbreaks.filter(report => {

        const status =
            String(
                report.status || ""
            ).toLowerCase();

        return (
            status === "validated" ||
            status === "active"
        );
    });

    const resolved =
        outbreaks.filter(
            report =>
                String(
                    report.status || ""
                ).toLowerCase() === "resolved"
        );

    document.getElementById(
        "activeOutbreaks"
    ).textContent = active.length;

    document.getElementById(
        "resolvedOutbreaks"
    ).textContent = resolved.length;

    renderDashboardOutbreaks(active);

    calculateDashboardRisk(active);
}


/* =========================
   DASHBOARD OUTBREAKS
========================= */

function renderDashboardOutbreaks(active) {

    const container =
        document.getElementById(
            "dashboardOutbreaks"
        );

    container.innerHTML = "";

    if (!active.length) {

        container.innerHTML = `
            <div class="empty-state">
                No active outbreak reports.
            </div>
        `;

        return;
    }

    active
        .slice(0, 5)
        .forEach(report => {

            const status =
                String(
                    report.status || "pending"
                ).toLowerCase();

            const statusClass =
                status === "validated"
                    ? "status-active"
                    : status === "rejected"
                        ? "status-resolved"
                        : status === "resolved"
                            ? "status-resolved"
                            : status === "active"
                                ? "status-active"
                                : "status-pending";

            const item =
                document.createElement("div");

            item.className =
                "outbreak-item";

            item.innerHTML = `
                <div>

                    <div class="outbreak-name">
                        ${escapeHtml(
                            report.farm_name ||
                            `Report #${report.report_id}`
                        )}
                    </div>

                    <div class="outbreak-sub">
                        ${escapeHtml(
                            report.description ||
                            "No description provided."
                        )}
                    </div>

                </div>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHtml(status)}
                </span>
            `;

            container.appendChild(item);
        });
}


/* =========================
   HAVERSINE
========================= */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const toRad =
        degrees =>
            degrees *
            Math.PI /
            180;

    const dLat =
        toRad(lat2 - lat1);

    const dLon =
        toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );
}


/* =========================
   RISK
========================= */

function riskLevel(distance) {

    if (distance <= 1) {
        return "High Risk";
    }

    if (distance <= 7) {
        return "Medium Risk";
    }

    if (distance <= 10) {
        return "Low Risk";
    }

    return "Outside Risk Range";
}


/* =========================
   DASHBOARD RISK
========================= */

function calculateDashboardRisk(
    activeReports
) {

    let high = 0;
    let medium = 0;
    let low = 0;

    for (const report of activeReports) {

        const rLat =
            Number(report.latitude);

        const rLng =
            Number(report.longitude);

        for (const farm of farms) {

            const distance =
                calculateDistance(
                    rLat,
                    rLng,
                    Number(farm.latitude),
                    Number(farm.longitude)
                );

            if (distance <= 1) {

                high++;

            } else if (distance <= 7) {

                medium++;

            } else if (distance <= 10) {

                low++;
            }
        }
    }

    document.getElementById(
        "highRiskFarms"
    ).textContent = high;

    document.getElementById(
        "mediumRiskFarms"
    ).textContent = medium;

    document.getElementById(
        "lowRiskFarms"
    ).textContent = low;
}


/* =========================
   OUTBREAK MAP
========================= */

function initializeMap() {

    if (map) {

        setTimeout(
            () => map.invalidateSize(),
            80
        );

        return;
    }

    map = L.map("map")
        .setView(
            [
                15.4802,
                120.5979
            ],
            11
        );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);


    /* =========================
       RISK ZONE MAP PANE
    ========================= */

    map.createPane("riskZonePane");

    map.getPane(
        "riskZonePane"
    ).style.zIndex = 450;

    // Risk circles must NOT block farm clicks
    map.getPane(
        "riskZonePane"
    ).style.pointerEvents = "none";


    /* =========================
       FARM MAP PANE
    ========================= */

    map.createPane("farmPane");

    map.getPane(
        "farmPane"
    ).style.zIndex = 600;


    /* =========================
       OUTBREAK MAP PANE
    ========================= */

    map.createPane("outbreakPane");

    map.getPane(
        "outbreakPane"
    ).style.zIndex = 650;
}


async function loadMapData() {

    if (!getToken()) {
        console.log("No login token.");
        return;
    }

    try {

        // ALWAYS reload the logged-in user's data
        farms = [];

        await loadFarms();
        await loadMapOutbreaks();

        console.log("MAP FARMS:", farms);
        console.log("MAP OUTBREAKS:", mapOutbreaks);

        if (!map) {
            initializeMap();
        }

        // Clear previous circles/markers
        map.eachLayer(layer => {

            if (
                layer instanceof L.Circle ||
                layer instanceof L.CircleMarker
            ) {
                map.removeLayer(layer);
            }

        });

        const mapBounds = L.latLngBounds([]);

        // =========================
        // FARM MARKERS
        // =========================

        /* =========================
   FARM MARKERS
========================= */

farms.forEach(farm => {

    const lat =
        Number(farm.latitude);

    const lng =
        Number(farm.longitude);

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {
        return;
    }

    mapBounds.extend([
        lat,
        lng
    ]);


    /* =========================
       FIND NEAREST ACTIVE OUTBREAK
    ========================= */

    let nearestOutbreak = null;
    let nearestDistance = Infinity;

    mapOutbreaks.forEach(report => {

        const status =
            String(
                report.status || ""
            ).toLowerCase();

        // Only validated/active outbreaks affect
        // the farm risk information.
        if (
            status !== "validated" &&
            status !== "active"
        ) {
            return;
        }

        const reportLat =
            Number(report.latitude);

        const reportLng =
            Number(report.longitude);

        if (
            !Number.isFinite(reportLat) ||
            !Number.isFinite(reportLng)
        ) {
            return;
        }

        const distance =
            calculateDistance(
                reportLat,
                reportLng,
                lat,
                lng
            );

        if (
            distance <= 10 &&
            distance < nearestDistance
        ) {

            nearestDistance =
                distance;

            nearestOutbreak =
                report;
        }
    });


    /* =========================
       RISK INFORMATION
    ========================= */

    let riskText =
        "Outside Risk Range";

    if (nearestOutbreak) {

        riskText =
            riskLevel(
                nearestDistance
            );
    }


    /* =========================
       FARM POPUP
    ========================= */

    let farmPopup = `
        <div style="
            min-width: 210px;
            line-height: 1.5;
        ">

            <strong>Farm</strong>

            <br>

            <strong>
                ${escapeHtml(
                    farm.farm_name ||
                    "Unnamed Farm"
                )}
            </strong>

            <br>

            ${escapeHtml(
                farm.address ||
                "No address available"
            )}

            <br><br>

            <strong>Latitude:</strong>
            ${lat.toFixed(7)}

            <br>

            <strong>Longitude:</strong>
            ${lng.toFixed(7)}
    `;


    /* =========================
       RISK DETAILS
    ========================= */

    if (nearestOutbreak) {

        farmPopup += `

            <br><br>

            <strong>Risk:</strong>
            ${escapeHtml(
                riskText
            )}

            <br>

            <strong>
                Distance to outbreak:
            </strong>
            ${nearestDistance.toFixed(2)} km
        `;

    } else {

        farmPopup += `

            <br><br>

            <strong>Risk:</strong>
            Outside Risk Range
        `;
    }


    farmPopup += `
        </div>
    `;


    /* =========================
       FARM MARKER
    ========================= */

    const farmMarker =
        L.circleMarker(
            [
                lat,
                lng
            ],
            {
                pane: "farmPane",

                radius: 8,

                color: "#536A35",

                fillColor: "#536A35",

                fillOpacity: 0.95,

                weight: 2
            }
        )
        .addTo(map);


    /* =========================
       HOVER TOOLTIP
    ========================= */

    farmMarker.bindTooltip(
        `
            <strong>
                ${escapeHtml(
                    farm.farm_name ||
                    "Unnamed Farm"
                )}
            </strong>
            <br>
            ${lat.toFixed(7)},
            ${lng.toFixed(7)}
        `,
        {
            direction: "top",
            sticky: true,
            opacity: 0.95
        }
    );


    /* =========================
       CLICK POPUP
    ========================= */

    farmMarker.bindPopup(
        farmPopup
    );

});


        // =========================
        // OUTBREAKS
        // =========================

        mapOutbreaks.forEach(report => {

            const lat = Number(report.latitude);
            const lng = Number(report.longitude);

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {
                return;
            }

            mapBounds.extend([
                lat,
                lng
            ]);

            // LOW RISK: 7-10 KM
            L.circle(
                [lat, lng],
                {
                    pane: "riskZonePane",
                    radius: 10000,
                    color: "#6B9566",
                    fillColor: "#6B9566",
                    fillOpacity: 0.22,
                    weight: 2
                }
            ).addTo(map);

            // MEDIUM RISK: 1-7 KM
            L.circle(
                [lat, lng],
                {
                    pane: "riskZonePane",
                    radius: 7000,
                    color: "#C99A45",
                    fillColor: "#C99A45",
                    fillOpacity: 0.22,
                    weight: 2
                }
            ).addTo(map);

            // HIGH RISK: 0-1 KM
            L.circle(
                [lat, lng],
                {
                    pane: "riskZonePane",
                    radius: 1000,
                    color: "#C35E5E",
                    fillColor: "#C35E5E",
                    fillOpacity: 0.28,
                    weight: 2
                }
            ).addTo(map);

            // OUTBREAK MARKER
            L.circleMarker(
                [
                    lat,
                    lng
                ],
                {
                    pane: "outbreakPane",

                    radius: 10,

                    color: "#A94848",

                    fillColor: "#C35E5E",

                    fillOpacity: 1,

                    weight: 3
                }
            )
            .addTo(map)
            .bindPopup(`
                <strong>Outbreak</strong>
            `);

        });


        // =========================
        // FIT MAP
        // =========================

        if (mapBounds.isValid()) {

            map.fitBounds(
                mapBounds,
                {
                    padding: [40, 40]
                }
            );

        } else {

            map.setView(
                [15.4802, 120.5979],
                11
            );

        }

        setTimeout(() => {
            map.invalidateSize();
        }, 100);

    } catch (error) {

        console.error(
            "Map data loading error:",
            error
        );

    }
}


/* =========================
   CASE REPORTS
========================= */

async function loadCaseReports() {

    const body =
        document.getElementById(
            "reportsTableBody"
        );

    const count =
        document.getElementById(
            "reportCount"
        );

    body.innerHTML = `
        <tr>
            <td
                colspan="8"
                class="table-empty"
            >
                Loading...
            </td>
        </tr>
    `;

    try {

        if (!outbreaks.length) {
            await loadOutbreaks();
        }

        count.textContent =
            `${outbreaks.length} record${
                outbreaks.length === 1
                    ? ""
                    : "s"
            }`;

        body.innerHTML = "";

        if (!outbreaks.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="table-empty"
                    >
                        No outbreak reports found.
                    </td>
                </tr>
            `;

            return;
        }

        outbreaks.forEach(report => {

            const status =
                String(
                    report.status || "pending"
                ).toLowerCase();

            const statusClass =
                    status === "validated" ||
                    status === "active"
                        ? "status-active"
                        : status === "rejected" ||
                        status === "resolved"
                            ? "status-resolved"
                            : "status-pending";

            const row =
                document.createElement("tr");

            row.innerHTML = `
    <td>
        #${escapeHtml(report.report_id)}
    </td>

    <td>
        ${escapeHtml(report.farm_name || "—")}
    </td>

    <td>
        ${escapeHtml(report.reporter || "—")}
    </td>

    <td>
        ${formatDateTime(report.created_at)}
    </td>

    <td>
        <span class="status-badge ${statusClass}">
            ${escapeHtml(status)}
        </span>
    </td>

    <td>
        ${formatDateTime(report.reviewed_at)}
    </td>

    <td>
        ${escapeHtml(report.reviewer || "—")}
    </td>

    <td>
        ${
            getUserRole() === "lgu_officer" &&
            status === "pending"
                ? `
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button
                            type="button"
                            class="primary-button"
                            onclick="reviewOutbreakReport(${report.report_id}, 'validated')"
                        >
                            Validate
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            onclick="reviewOutbreakReport(${report.report_id}, 'rejected')"
                        >
                            Reject
                        </button>
                    </div>
                `
                : "—"
        }
    </td>

            `;

            body.appendChild(row);
        });

    } catch (error) {

        body.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    ${escapeHtml(
                        error.message
                    )}
                </td>
            </tr>
        `;
    }
}

// ======================================
// REVIEW OUTBREAK REPORT
// ======================================
async function reviewOutbreakReport(reportId, status) {
    const action =
        status === "validated"
            ? "validate"
            : "reject";

    const confirmed = confirm(
        `Are you sure you want to ${action} outbreak report #${reportId}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(
            `/api/outbreaks/${reportId}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status
                })
            }
        );

        // Reload reports
        await loadOutbreaks();

        // Update dashboard counts
        updateDashboard();

        // Refresh case reports table
        await loadCaseReports();

        alert(
            `Outbreak report #${reportId} has been ${status}.`
        );

    } catch (error) {
        alert(error.message);
    }
}
/* =========================
   RISK CLASSIFICATION
========================= */

async function loadRiskClassification() {

    try {

        if (!farms.length) {
            await loadFarms();
        }

        if (!outbreaks.length) {
            await loadOutbreaks();
        }

        const activeReports = outbreaks.filter(report => {
        const status = String(report.status || "").toLowerCase();
        return status === "validated" || status === "active";
        });

        const groups = {
            high: [],
            medium: [],
            low: []
        };

        const seen = {
            high: new Set(),
            medium: new Set(),
            low: new Set()
        };

        for (const report of activeReports) {

            for (const farm of farms) {

                const distance =
                    calculateDistance(
                        Number(report.latitude),
                        Number(report.longitude),
                        Number(farm.latitude),
                        Number(farm.longitude)
                    );

                const risk =
                    riskLevel(distance);

                if (
                    risk === "High Risk" &&
                    !seen.high.has(farm.farm_id)
                ) {

                    groups.high.push({
                        farm,
                        distance
                    });

                    seen.high.add(
                        farm.farm_id
                    );

                } else if (
                    risk === "Medium Risk" &&
                    !seen.medium.has(farm.farm_id)
                ) {

                    groups.medium.push({
                        farm,
                        distance
                    });

                    seen.medium.add(
                        farm.farm_id
                    );

                } else if (
                    risk === "Low Risk" &&
                    !seen.low.has(farm.farm_id)
                ) {

                    groups.low.push({
                        farm,
                        distance
                    });

                    seen.low.add(
                        farm.farm_id
                    );
                }
            }
        }

        renderRiskGroup(
            "highRiskList",
            "highRiskCount",
            groups.high
        );

        renderRiskGroup(
            "mediumRiskList",
            "mediumRiskCount",
            groups.medium
        );

        renderRiskGroup(
            "lowRiskList",
            "lowRiskCount",
            groups.low
        );

    } catch (error) {

        console.error(
            "Risk classification failed:",
            error
        );
    }
}


/* =========================
   RENDER RISK GROUP
========================= */

function renderRiskGroup(
    listId,
    countId,
    items
) {

    const list =
        document.getElementById(listId);

    const count =
        document.getElementById(countId);

    count.textContent =
        `${items.length} farm${
            items.length === 1
                ? ""
                : "s"
        }`;

    list.innerHTML = "";

    if (!items.length) {

        list.innerHTML = `
            <div class="empty-state">
                No farms in this classification.
            </div>
        `;

        return;
    }

    items.sort(
        (a, b) =>
            a.distance -
            b.distance
    );

    items.forEach(item => {

        const element =
            document.createElement("div");

        element.className =
            "risk-item";

        element.innerHTML = `
            <div>

                <strong>
                    ${escapeHtml(
                        item.farm.farm_name
                    )}
                </strong>

                <span>
                    ${escapeHtml(
                        item.farm.address
                    )}
                </span>

            </div>

            <span class="distance-pill">
                ${item.distance.toFixed(2)}
                km
            </span>
        `;

        list.appendChild(element);
    });
}


/* =========================
   PROXIMITY MAP
========================= */

function initializeProximityMap() {

    if (proximityMap) {

        setTimeout(
            () => proximityMap.invalidateSize(),
            80
        );

        return;
    }

    proximityMap =
        L.map("proximityMap")
            .setView(
                [
                    15.4802,
                    120.5979
                ],
                11
            );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(proximityMap);

    proximityMap.createPane("riskZonePane");

    proximityMap.getPane(
        "riskZonePane"
    ).style.zIndex = 450;
}


/* =========================
   OUTBREAK SELECT
========================= */

async function populateOutbreakSelect() {

    const select =
        document.getElementById(
            "outbreakSelect"
        );

    try {

        if (!outbreaks.length) {
            await loadOutbreaks();
        }

        select.innerHTML = `
            <option value="">
                Select an outbreak
            </option>
        `;

        outbreaks
            .filter(
                report => {
                    const status =
                        String(
                            report.status || ""
                        ).toLowerCase();

                    return (
                        status === "validated" ||
                        status === "active"
                    );
                }
            )
            .forEach(report => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    report.report_id;

                option.textContent =
                    report.farm_name
                        ? `${report.farm_name} — Report #${report.report_id}`
                        : `Report #${report.report_id}`;

                select.appendChild(option);
            });

    } catch (error) {

        console.error(error);
    }
}


/* =========================
   PROXIMITY ANALYSIS
========================= */

async function performProximityAnalysis(
    reportId
) {

    const affected =
        document.getElementById(
            "affectedFarms"
        );

    const origin =
        document.getElementById(
            "originFarmName"
        );

    const coords =
        document.getElementById(
            "originCoordinates"
        );

    if (!reportId) {

        origin.textContent =
            "No outbreak selected";

        coords.textContent = "—";

        affected.innerHTML = `
            <div class="empty-state">
                Select an outbreak to begin.
            </div>
        `;

        return;
    }

    try {

        const result =
            await apiRequest(
                `/api/proximity/report/${reportId}`
            );

        const outbreak =
            result.outbreak;

        origin.textContent =
            `Outbreak #${outbreak.report_id}`;

        coords.textContent =
            `${Number(
                outbreak.latitude
            ).toFixed(5)}, ${
                Number(
                    outbreak.longitude
                ).toFixed(5)
            }`;

        affected.innerHTML = "";

        if (
            !result.nearby_farms.length
        ) {

            affected.innerHTML = `
                <div class="empty-state">
                    No affected farms within 10 km.
                </div>
            `;

        } else {

            result.nearby_farms.forEach(
                farm => {

                    const element =
                        document.createElement(
                            "div"
                        );

                    element.className =
                        "affected-item";

                    element.innerHTML = `
                        <div class="affected-top">

                            <strong>
                                ${escapeHtml(
                                    farm.farm_name
                                )}
                            </strong>

                            <span class="distance-pill">
                                ${Number(
                                    farm.distance_km
                                ).toFixed(2)}
                                km
                            </span>

                        </div>

                        <div class="affected-bottom">

                            <span>
                                ${escapeHtml(
                                    farm.address
                                )}
                            </span>

                            <strong>
                                ${escapeHtml(
                                    farm.risk_level
                                )}
                            </strong>

                        </div>
                    `;

                    affected.appendChild(
                        element
                    );
                }
            );
        }

        renderProximityMap(
            outbreak,
            result.nearby_farms
        );

    } catch (error) {

        affected.innerHTML = `
            <div class="empty-state">
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;
    }
}


/* =========================
   PROXIMITY MAP RENDER
========================= */

function renderProximityMap(
    outbreak,
    nearbyFarms
) {

    if (!proximityMap) {
        initializeProximityMap();
    }

    proximityMap.eachLayer(layer => {

        if (
            layer instanceof L.Circle ||
            layer instanceof L.CircleMarker
        ) {
            proximityMap.removeLayer(layer);
        }

    });

    const outbreakLat =
        Number(outbreak.latitude);

    const outbreakLng =
        Number(outbreak.longitude);

    const mapBounds =
        L.latLngBounds([]);

    mapBounds.extend([
        outbreakLat,
        outbreakLng
    ]);


    /* =========================
       LOW RISK — 7 TO 10 KM
    ========================= */

    const lowRiskCircle =
        L.circle(
            [
                outbreakLat,
                outbreakLng
            ],
            {
                pane: "riskZonePane",
                radius: 10000,
                color: "#6B9566",
                fillColor: "#6B9566",
                fillOpacity: 0.16,
                opacity: 1,
                weight: 2
            }
        )
        .addTo(proximityMap);

    mapBounds.extend(
        lowRiskCircle.getBounds()
    );


    /* =========================
       MEDIUM RISK — 1 TO 7 KM
    ========================= */

    L.circle(
        [
            outbreakLat,
            outbreakLng
        ],
        {
            pane: "riskZonePane",
            radius: 7000,
            color: "#C99A45",
            fillColor: "#C99A45",
            fillOpacity: 0.18,
            opacity: 1,
            weight: 2
        }
    )
    .addTo(proximityMap);


    /* =========================
       HIGH RISK — 0 TO 1 KM
    ========================= */

    L.circle(
        [
            outbreakLat,
            outbreakLng
        ],
        {
            pane: "riskZonePane",
            radius: 1000,
            color: "#C35E5E",
            fillColor: "#C35E5E",
            fillOpacity: 0.24,
            opacity: 1,
            weight: 2
        }
    )
    .addTo(proximityMap);


    /* =========================
       OUTBREAK MARKER
    ========================= */

    L.circleMarker(
        [
            outbreakLat,
            outbreakLng
        ],
        {
            radius: 10,
            color: "#A94848",
            fillColor: "#C35E5E",
            fillOpacity: 1,
            weight: 3
        }
    )
    .addTo(proximityMap)
    .bindPopup(
        "<strong>Outbreak</strong>"
    );


    /* =========================
       FARM MARKERS
    ========================= */

    nearbyFarms.forEach(farm => {

        const lat =
            Number(farm.latitude);

        const lng =
            Number(farm.longitude);

        mapBounds.extend([
            lat,
            lng
        ]);

        L.circleMarker(
            [
                lat,
                lng
            ],
            {
                radius: 7,
                color: "#536A35",
                fillColor: "#536A35",
                fillOpacity: 0.90,
                weight: 2
            }
        )
        .addTo(proximityMap)
        .bindPopup(`
            <strong>
                ${escapeHtml(
                    farm.farm_name
                )}
            </strong>

            <br>

            ${Number(
                farm.distance_km
            ).toFixed(2)}
            km

            <br>

            ${escapeHtml(
                farm.risk_level
            )}
        `);
    });


    /* =========================
       FIT COMPLETE 10 KM ZONE
    ========================= */

    if (mapBounds.isValid()) {

        proximityMap.fitBounds(
            mapBounds,
            {
                padding: [
                    25,
                    25
                ]
            }
        );
    }
}


/* =========================
   NAVIGATION
========================= */

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.page
                    );
                }
            );
        });

    document
        .querySelectorAll("[data-page-link]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.pageLink
                    );
                }
            );
        });

    document
        .getElementById("loginButton")
        .addEventListener(
            "click",
            () => showPage("login")
        );

    document
        .getElementById("signupButton")
        .addEventListener(
            "click",
            () => showPage("signup")
        );

    document
        .getElementById("logoutButton")
        .addEventListener(
            "click",
            logout
        );
}


/* =========================
   FORMS
========================= */

function setupForms() {

    document
        .getElementById("loginForm")
        .addEventListener(
            "submit",
            handleLogin
        );

    document
        .getElementById("signupForm")
        .addEventListener(
            "submit",
            handleSignup
        );
        document
        .getElementById("useCurrentLocationButton")
        .addEventListener(
            "click",
            getCurrentLocation
        );
    document
        .getElementById("verifyEmailButton")
        .addEventListener(
            "click",
            handleVerifyEmail
        );


document
    .getElementById("resendCodeButton")
    .addEventListener(
        "click",
        handleResendCode
    );

    document
        .getElementById("refreshMapButton")
        .addEventListener(
            "click",
            loadMapData
        );

    document
        .getElementById("refreshReportsButton")
        .addEventListener(
            "click",
            loadCaseReports
        );

    document
        .getElementById("outbreakSelect")
        .addEventListener(
            "change",
            event =>
                performProximityAnalysis(
                    event.target.value
                )
        );
}


/* =========================
   MOBILE MENU
========================= */

function setupMobileMenu() {

    document
        .getElementById("mobileMenuButton")
        .addEventListener(
            "click",
            () => {

                document
                    .getElementById("sidebar")
                    .classList.toggle(
                        "mobile-open"
                    );
            }
        );
}


/* =========================
   INITIALIZATION
========================= */

async function initializeApp() {

    setupNavigation();
    setupForms();
    setupMobileMenu();
    updateAuthUI();
    updateRoleAccess();

    if (getToken() && currentUser) {
        await loadAllData();
        showPage("home");
    } else {
        showPage("login");
    }
}


document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);