const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors({
    origin: "https://efattechz.github.io"
}));

app.use(express.json());

const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const WEBAPP_URL =
    "https://efattechz.github.io/quick-gram/";

const BOT_USERNAME =
    "Quick_Gram_bot";

// =====================================
// REFERRAL SETTINGS
// =====================================

// Amount of Quicks given to the referrer
const REFERRAL_REWARD = 100;


// =====================================
// ENVIRONMENT CHECKS
// =====================================

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing");
}

if (!SUPABASE_URL) {
    console.error("SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_SERVICE_KEY is missing");
}


// =====================================
// SUPABASE
// =====================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
);


// =====================================
// TELEGRAM BOT
// =====================================

let bot = null;

if (BOT_TOKEN) {

    bot = new TelegramBot(
        BOT_TOKEN,
        {
            polling: true
        }
    );

    console.log(
        "Quick Gram Telegram bot started"
    );


    // =================================
    // /START COMMAND
    // =================================

    bot.onText(
        /^\/start(?:\s+(.+))?$/,
        async (msg, match) => {

            try {

                const chatId =
                    msg.chat.id;

                const startParameter =
                    match && match[1]
                        ? match[1].trim()
                        : null;


                // -------------------------
                // NORMAL START
                // -------------------------

                if (!startParameter) {

                    await bot.sendMessage(
                        chatId,
                        "Welcome to Quick Gram! 🚀\n\nTap the button below to open the app.",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "🚀 Open Quick Gram",
                                            web_app: {
                                                url: WEBAPP_URL
                                            }
                                        }
                                    ]
                                ]
                            }
                        }
                    );

                    return;
                }


                // -------------------------
                // REFERRAL START
                // -------------------------

                if (
                    startParameter.startsWith(
                        "ref_"
                    )
                ) {

                    const referralCode =
                        startParameter.substring(
                            4
                        );


                    // Check referrer

                    const {
                        data: referrer,
                        error
                    } =
                        await supabase
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
                        console.error(error);
                    }


                    if (!referrer) {

                        await bot.sendMessage(
                            chatId,
                            "Welcome to Quick Gram! 🚀\n\nThe referral code is invalid, but you can still join.",
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: "🚀 Open Quick Gram",
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


                    const referralWebAppURL =
                        WEBAPP_URL +
                        "?ref=" +
                        encodeURIComponent(
                            referralCode
                        );


                    await bot.sendMessage(
                        chatId,
                        "🎉 You were invited to Quick Gram!\n\nOpen the app to continue.",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "🚀 Open Quick Gram",
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


                // -------------------------
                // UNKNOWN PARAMETER
                // -------------------------

                await bot.sendMessage(
                    chatId,
                    "Welcome to Quick Gram! 🚀",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "🚀 Open Quick Gram",
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


// =====================================
// TELEGRAM INIT DATA VALIDATION
// =====================================

function validateTelegramInitData(
    initData
) {

    if (
        !initData ||
        !BOT_TOKEN
    ) {
        return null;
    }

    const params =
        new URLSearchParams(
            initData
        );

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


    if (
        calculatedHash !== hash
    ) {
        return null;
    }


    const authDate =
        Number(
            params.get(
                "auth_date"
            )
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


// =====================================
// HEALTH CHECK
// =====================================

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


// =====================================
// AUTH / CREATE USER
// =====================================

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

                return res.status(
                    401
                ).json({
                    success: false,
                    error:
                        "Invalid Telegram authentication"
                });

            }


            const referralCode =
                "QG" +
                String(user.id)
                    .slice(-8);


            // Find existing user

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


            // -------------------------
            // EXISTING USER
            // -------------------------

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
                    user: updatedUser,
                    referralReward:
                        REFERRAL_REWARD
                });

            }


            // -------------------------
            // NEW USER
            // -------------------------

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

                        balance: 0,

                        referral_code:
                            referralCode,

                        referral_count: 0,

                        referred_by: null
                    })
                    .select()
                    .single();


            if (error) {
                throw error;
            }


            return res.json({
                success: true,
                user: newUser,
                referralReward:
                    REFERRAL_REWARD
            });


        } catch (error) {

            console.error(
                "Auth error:",
                error
            );


            return res.status(
                500
            ).json({
                success: false,
                error:
                    "Server error"
            });

        }

    }
);


// =====================================
// APPLY REFERRAL
// =====================================

app.post(
    "/api/referral",
    async (req, res) => {

        try {

            const {
                initData,
                referralCode
            } = req.body;


            // -------------------------
            // VALIDATE USER
            // -------------------------

            const user =
                validateTelegramInitData(
                    initData
                );


            if (!user) {

                return res.status(
                    401
                ).json({
                    success: false,
                    error:
                        "Invalid Telegram authentication"
                });

            }


            if (!referralCode) {

                return res.status(
                    400
                ).json({
                    success: false,
                    error:
                        "Referral code missing"
                });

            }


            // -------------------------
            // FIND REFERRER
            // -------------------------

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
                throw referrerError;
            }


            if (!referrer) {

                return res.status(
                    404
                ).json({
                    success: false,
                    error:
                        "Referral code not found"
                });

            }


            // -------------------------
            // BLOCK SELF REFERRAL
            // -------------------------

            if (
                String(
                    referrer.telegram_id
                ) ===
                String(user.id)
            ) {

                return res.status(
                    400
                ).json({
                    success: false,
                    error:
                        "You cannot refer yourself"
                });

            }


            // -------------------------
            // FIND CURRENT USER
            // -------------------------

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
                throw currentUserError;
            }


            if (!currentUser) {

                return res.status(
                    404
                ).json({
                    success: false,
                    error:
                        "User not found. Open Quick Gram first."
                });

            }


            // -------------------------
            // PREVENT DOUBLE REFERRAL
            // -------------------------

            if (
                currentUser.referred_by
            ) {

                return res.json({
                    success: true,
                    alreadyApplied: true,
                    message:
                        "Referral already applied",
                    user: currentUser,
                    reward: 0
                });

            }


            // -------------------------
            // SAVE REFERRAL
            // -------------------------

            const {
                error: saveReferralError
            } =
                await supabase
                    .from("users")
                    .update({
                        referred_by:
                            referrer.telegram_id
                    })
                    .eq(
                        "telegram_id",
                        user.id
                    );


            if (saveReferralError) {
                throw saveReferralError;
            }


            // -------------------------
            // INCREASE REFERRER COUNT
            // AND MAIN BALANCE
            // -------------------------

            const newReferralCount =
                Number(
                    referrer.referral_count ||
                    0
                ) + 1;


            const newBalance =
                Number(
                    referrer.balance ||
                    0
                ) + REFERRAL_REWARD;


            const {
                data: updatedReferrer,
                error:
                    updateReferrerError
            } =
                await supabase
                    .from("users")
                    .update({

                        referral_count:
                            newReferralCount,

                        balance:
                            newBalance,

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


            if (updateReferrerError) {

                // Try to undo referred_by
                await supabase
                    .from("users")
                    .update({
                        referred_by: null
                    })
                    .eq(
                        "telegram_id",
                        user.id
                    );

                throw updateReferrerError;
            }


            // -------------------------
            // SUCCESS
            // -------------------------

            return res.json({

                success: true,

                alreadyApplied: false,

                message:
                    "Referral applied successfully",

                reward:
                    REFERRAL_REWARD,

                referralCount:
                    updatedReferrer.referral_count,

                balance:
                    updatedReferrer.balance

            });


        } catch (error) {

            console.error(
                "Referral error:",
                error
            );


            return res.status(
                500
            ).json({
                success: false,
                error:
                    "Server error"
            });

        }

    }
);


// =====================================
// GET USER
// =====================================

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

                return res.status(
                    401
                ).json({
                    success: false,
                    error:
                        "Invalid Telegram authentication"
                });

            }


            const {
                data,
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


            if (!data) {

                return res.status(
                    404
                ).json({
                    success: false,
                    error:
                        "User not found"
                });

            }


            return res.json({
                success: true,
                user: data
            });


        } catch (error) {

            console.error(
                "User error:",
                error
            );


            return res.status(
                500
            ).json({
                success: false,
                error:
                    "Server error"
            });

        }

    }
);


// =====================================
// START SERVER
// =====================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Quick Gram server running on port ${PORT}`
        );

    }
);
