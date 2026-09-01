const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// =====================================================
// CORS
// =====================================================

app.use(cors({
    origin: "https://efattechz.github.io"
}));

app.use(express.json());

// =====================================================
// PORT
// =====================================================

const PORT = process.env.PORT || 10000;

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// =====================================================
// QUICK GRAM SETTINGS
// =====================================================

const WEBAPP_URL =
    "https://efattechz.github.io/quick-gram/";

const BOT_USERNAME =
    "Quick_Gram_bot";

const REFERRAL_REWARD = 100;

// =====================================================
// ENVIRONMENT CHECKS
// =====================================================

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing");
}

if (!SUPABASE_URL) {
    console.error("SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_SERVICE_KEY is missing");
}

// =====================================================
// SUPABASE
// =====================================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
);

// =====================================================
// TELEGRAM BOT
// =====================================================

let bot = null;

if (BOT_TOKEN) {

    bot = new TelegramBot(
        BOT_TOKEN,
        {
            polling: true
        }
    );

    console.log("Quick Gram Telegram bot started");

    // =================================================
    // /START
    // =================================================

    bot.onText(
        /^\/start(?:\s+(.+))?$/,
        async (msg, match) => {

            try {

                const chatId = msg.chat.id;

                const startParameter =
                    match && match[1]
                        ? match[1].trim()
                        : null;

                // =====================================
                // NORMAL START
                // =====================================

                if (!startParameter) {

                    await bot.sendMessage(
                        chatId,

                        "Welcome to Quick Gram! 🚀\n\n" +
                        "Tap the button below to open the app.",

                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text:
                                                "🚀 Open Quick Gram",

                                            web_app: {
                                                url:
                                                    WEBAPP_URL
                                            }
                                        }
                                    ]
                                ]
                            }
                        }
                    );

                    return;
                }

                // =====================================
                // REFERRAL START
                // =====================================

                if (
                    startParameter.startsWith("ref_")
                ) {

                    const referralCode =
                        startParameter.substring(4);

                    // Check referral code
                    const {
                        data: referrer,
                        error
                    } = await supabase
                        .from("users")
                        .select(
                            "telegram_id, referral_code"
                        )
                        .eq(
                            "referral_code",
                            referralCode
                        )
                        .maybeSingle();

                    if (error) {

                        console.error(
                            "Referral lookup error:",
                            error
                        );

                    }

                    if (!referrer) {

                        await bot.sendMessage(
                            chatId,

                            "Welcome to Quick Gram! 🚀\n\n" +
                            "The referral code is invalid, " +
                            "but you can still join.",

                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text:
                                                    "🚀 Open Quick Gram",

                                                web_app: {
                                                    url:
                                                        WEBAPP_URL
                                                }
                                            }
                                        ]
                                    ]
                                }
                            }
                        );

                        return;
                    }

                    // Put referral code into WebApp URL
                    const referralWebAppURL =
                        WEBAPP_URL +
                        "?ref=" +
                        encodeURIComponent(
                            referralCode
                        );

                    await bot.sendMessage(
                        chatId,

                        "🎉 You were invited to Quick Gram!\n\n" +
                        "Open the app to continue.",

                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text:
                                                "🚀 Open Quick Gram",

                                            web_app: {
                                                url:
                                                    referralWebAppURL
                                            }
                                        }
                                    ]
                                ]
                            }
                        }
                    );

                    return;
                }

                // =====================================
                // UNKNOWN START PARAMETER
                // =====================================

                await bot.sendMessage(
                    chatId,

                    "Welcome to Quick Gram! 🚀",

                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text:
                                            "🚀 Open Quick Gram",

                                        web_app: {
                                            url:
                                                WEBAPP_URL
                                        }
                                    }
                                ]
                            ]
                        }
                    }
                );

            } catch (error) {

                console.error(
                    "Telegram /start error:",
                    error
                );

            }

        }
    );

}

// =====================================================
// TELEGRAM INIT DATA VALIDATION
// =====================================================

function validateTelegramInitData(initData) {

    if (!initData || !BOT_TOKEN) {
        return null;
    }

    const params =
        new URLSearchParams(initData);

    const hash =
        params.get("hash");

    if (!hash) {
        return null;
    }

    params.delete("hash");

    const dataCheckString =
        [...params.entries()]
            .sort(
                ([a], [b]) =>
                    a.localeCompare(b)
            )
            .map(
                ([key, value]) =>
                    `${key}=${value}`
            )
            .join("\n");

    const secretKey =
        crypto
            .createHmac(
                "sha256",
                "WebAppData"
            )
            .update(BOT_TOKEN)
            .digest();

    const calculatedHash =
        crypto
            .createHmac(
                "sha256",
                secretKey
            )
            .update(dataCheckString)
            .digest("hex");

    if (calculatedHash !== hash) {
        return null;
    }

    const authDate =
        Number(
            params.get("auth_date")
        );

    if (!authDate) {
        return null;
    }

    const currentTime =
        Math.floor(
            Date.now() / 1000
        );

    if (
        currentTime - authDate >
        86400
    ) {
        return null;
    }

    const userString =
        params.get("user");

    if (!userString) {
        return null;
    }

    try {

        return JSON.parse(
            userString
        );

    } catch {

        return null;

    }

}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            app: "Quick Gram",
            status: "online"
        });

    }
);

// =====================================================
// AUTH / CREATE USER
// =====================================================

app.post(
    "/api/auth",
    async (req, res) => {

        try {

            const {
                initData
            } = req.body;

            const user =
                validateTelegramInitData(
                    initData
                );

            if (!user) {

                return res.status(401).json({
                    success: false,
                    error:
                        "Invalid Telegram authentication"
                });

            }

            const referralCode =
                "QG" +
                String(user.id)
                    .slice(-8);

            // Find user
            const {
                data: existingUser,
                error: findError
            } =
                await supabase
                    .from("users")
                    .select("*")
                    .eq(
                        "telegram_id",
                        user.id
                    )
                    .maybeSingle();

            if (findError) {
                throw findError;
            }

            // =========================================
            // EXISTING USER
            // =========================================

            if (existingUser) {

                const {
                    data: updatedUser,
                    error
                } =
                    await supabase
                        .from("users")
                        .update({

                            username:
                                user.username ||
                                null,

                            first_name:
                                user.first_name ||
                                null,

                            last_name:
                                user.last_name ||
                                null,

                            updated_at:
                                new Date()
                                    .toISOString()

                        })
                        .eq(
                            "telegram_id",
                            user.id
                        )
                        .select()
                        .single();

                if (error) {
                    throw error;
                }

                return res.json({
                    success: true,
                    user: updatedUser
                });
            }

            // =========================================
            // NEW USER
            // =========================================

            const {
                data: newUser,
                error
            } =
                await supabase
                    .from("users")
                    .insert({

                        telegram_id:
                            user.id,

                        username:
                            user.username ||
                            null,

                        first_name:
                            user.first_name ||
                            null,

                        last_name:
                            user.last_name ||
                            null,

                        balance:
                            0,

                        referral_code:
                            referralCode,

                        referral_count:
                            0,

                        referred_by:
                            null

                    })
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            return res.json({
                success: true,
                user: newUser
            });

        } catch (error) {

            console.error(
                "Auth error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Server error"
            });

        }

    }
);

// =====================================================
// GET CURRENT USER
// This makes the opening-page balance always fresh.
// =====================================================

app.post(
    "/api/user",
    async (req, res) => {

        try {

            const {
                initData
            } = req.body;

            const user =
                validateTelegramInitData(
                    initData
                );

            if (!user) {

                return res.status(401).json({
                    success: false,
                    error:
                        "Invalid Telegram authentication"
                });

            }

            const {
                data: currentUser,
                error
            } =
                await supabase
                    .from("users")
                    .select("*")
                    .eq(
                        "telegram_id",
                        user.id
                    )
                    .maybeSingle();

            if (error) {
                throw error;
            }

            if (!currentUser) {

                return res.status(404).json({
                    success: false,
                    error:
                        "User not found"
                });

            }

            return res.json({
                success: true,
                user: currentUser
            });

        } catch (error) {

            console.error(
                "Get user error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Server error"
            });

        }

    }
);

// =====================================================
// APPLY REFERRAL + REWARD
// =====================================================

app.post(
    "/api/referral",
    async (req, res) => {

        try {

            const {
                initData,
                referralCode
            } = req.body;

            // =========================================
            // VALIDATE USER
            // =========================================

            const user =
                validateTelegramInitData(
                    initData
                );

            if (!user) {

                return res.status(401).json({
                    success: false,
                    error:
                        "Invalid Telegram authentication"
                });

            }

            // =========================================
            // CHECK REFERRAL CODE
            // =========================================

            if (!referralCode) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Referral code missing"
                });

            }

            // =========================================
            // FIND REFERRER
            // =========================================

            const {
                data: referrer,
                error: referrerError
            } =
                await supabase
                    .from("users")
                    .select("*")
                    .eq(
                        "referral_code",
                        referralCode
                    )
                    .maybeSingle();

            if (referrerError) {

                console.error(
                    "Referrer lookup error:",
                    referrerError
                );

                throw referrerError;
            }

            if (!referrer) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Referral code not found"
                });

            }

            // =========================================
            // SELF REFERRAL CHECK
            // =========================================

            if (
                Number(
                    referrer.telegram_id
                ) ===
                Number(user.id)
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "You cannot refer yourself"
                });

            }

            // =========================================
            // FIND NEW USER
            // =========================================

            const {
                data: currentUser,
                error: currentUserError
            } =
                await supabase
                    .from("users")
                    .select("*")
                    .eq(
                        "telegram_id",
                        user.id
                    )
                    .maybeSingle();

            if (currentUserError) {

                console.error(
                    "Current user error:",
                    currentUserError
                );

                throw currentUserError;
            }

            if (!currentUser) {

                return res.status(404).json({
                    success: false,
                    error:
                        "User not found"
                });

            }

            // =========================================
            // DUPLICATE CHECK
            // =========================================

            if (currentUser.referred_by) {

                // Get the actual latest referrer
                const {
                    data: latestReferrer,
                    error: latestError
                } =
                    await supabase
                        .from("users")
                        .select(
                            "balance, referral_count"
                        )
                        .eq(
                            "telegram_id",
                            currentUser.referred_by
                        )
                        .maybeSingle();

                if (latestError) {
                    throw latestError;
                }

                return res.json({

                    success: true,

                    alreadyApplied:
                        true,

                    reward:
                        0,

                    balance:
                        latestReferrer
                            ? Number(
                                latestReferrer.balance ||
                                0
                            )
                            : 0,

                    referralCount:
                        latestReferrer
                            ? Number(
                                latestReferrer.referral_count ||
                                0
                            )
                            : 0,

                    message:
                        "Referral already applied"

                });

            }

            // =========================================
            // CURRENT REFERRER VALUES
            // =========================================

            const oldBalance =
                Number(
                    referrer.balance ||
                    0
                );

            const oldReferralCount =
                Number(
                    referrer.referral_count ||
                    0
                );

            const newBalance =
                oldBalance +
                REFERRAL_REWARD;

            const newReferralCount =
                oldReferralCount +
                1;

            // =========================================
            // FIRST: MARK NEW USER AS REFERRED
            // =========================================

            const {
                error: referredUpdateError
            } =
                await supabase
                    .from("users")
                    .update({

                        referred_by:
                            referrer.telegram_id,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "telegram_id",
                        user.id
                    );

            if (referredUpdateError) {

                console.error(
                    "Referred user update error:",
                    referredUpdateError
                );

                throw referredUpdateError;
            }

            // =========================================
            // SECOND: GIVE REFERRER REWARD
            // =========================================

            const {
                data: updatedReferrer,
                error: rewardError
            } =
                await supabase
                    .from("users")
                    .update({

                        balance:
                            newBalance,

                        referral_count:
                            newReferralCount,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "telegram_id",
                        referrer.telegram_id
                    )
                    .select()
                    .single();

            if (rewardError) {

                console.error(
                    "Reward update error:",
                    rewardError
                );

                throw rewardError;
            }

            // =========================================
            // SUCCESS LOG
            // =========================================

            console.log(
                "================================="
            );

            console.log(
                "REFERRAL SUCCESS"
            );

            console.log(
                "Referrer ID:",
                referrer.telegram_id
            );

            console.log(
                "New User ID:",
                user.id
            );

            console.log(
                "Reward:",
                REFERRAL_REWARD
            );

            console.log(
                "Old Balance:",
                oldBalance
            );

            console.log(
                "New Balance:",
                updatedReferrer.balance
            );

            console.log(
                "New Referral Count:",
                updatedReferrer.referral_count
            );

            console.log(
                "================================="
            );

            // =========================================
            // RETURN UPDATED REFERRER DATA
            // =========================================

            return res.json({

                success: true,

                alreadyApplied:
                    false,

                reward:
                    REFERRAL_REWARD,

                balance:
                    Number(
                        updatedReferrer.balance ||
                        0
                    ),

                referralCount:
                    Number(
                        updatedReferrer.referral_count ||
                        0
                    ),

                message:
                    "Referral applied successfully"

            });

        } catch (error) {

            console.error(
                "Referral system error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Server error"

            });

        }

    }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Quick Gram server running on port ${PORT}`
        );

    }
);
