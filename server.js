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

// -------------------------
// Environment checks
// -------------------------

if (!BOT_TOKEN) {
console.error("BOT_TOKEN is missing");
}

if (!SUPABASE_URL) {
console.error("SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_KEY) {
console.error("SUPABASE_SERVICE_KEY is missing");
}

// -------------------------
// Supabase
// -------------------------

const supabase = createClient(
SUPABASE_URL,
SUPABASE_SERVICE_KEY
);

// -------------------------
// Telegram Bot
// -------------------------

let bot = null;

if (BOT_TOKEN) {

bot = new TelegramBot(
    BOT_TOKEN,
    {
        polling: true
    }
);

console.log("Quick Gram Telegram bot started");


// /start command
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {

    try {

        const chatId = msg.chat.id;

        const startParameter =
            match && match[1]
                ? match[1].trim()
                : null;


        // Normal start
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


        // Referral start
        if (startParameter.startsWith("ref_")) {

            const referralCode =
                startParameter.substring(4);


            // Check referral code
            const { data: referrer, error } =
                await supabase
                    .from("users")
                    .select("telegram_id, referral_code")
                    .eq("referral_code", referralCode)
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


            // Store referral temporarily in Telegram WebApp URL
            const referralWebAppURL =
                WEBAPP_URL +
                "?ref=" +
                encodeURIComponent(referralCode);


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
                                        url: referralWebAppURL
                                    }
                                }
                            ]
                        ]
                    }
                }
            );

            return;
        }


        // Unknown /start parameter
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
                                    url: WEBAPP_URL
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

});

}

// -------------------------
// Telegram initData validation
// -------------------------

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
        .sort(([a], [b]) =>
            a.localeCompare(b)
        )
        .map(([key, value]) =>
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

// -------------------------
// Health check
// -------------------------

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

// -------------------------
// Login / user initialization
// -------------------------

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

                    referral_count: 0
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

        console.error(error);


        return res.status(500).json({
            success: false,
            error:
                "Server error"
        });

    }

}

);

// -------------------------
// Apply referral
// -------------------------

app.post(
"/api/referral",
async (req, res) => {

    try {

        const {
            initData,
            referralCode
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


        if (!referralCode) {

            return res.status(400).json({
                success: false,
                error:
                    "Referral code missing"
            });

        }


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

            return res.status(404).json({
                success: false,
                error:
                    "Referral code not found"
            });

        }


        if (
            referrer.telegram_id ===
            user.id
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "You cannot refer yourself"
            });

        }


        const {
            data: currentUser,
            error: userError
        } =
            await supabase
                .from("users")
                .select("*")
                .eq(
                    "telegram_id",
                    user.id
                )
                .maybeSingle();


        if (userError) {
            throw userError;
        }


        if (!currentUser) {

            return res.status(404).json({
                success: false,
                error:
                    "User not found"
            });

        }


        if (currentUser.referred_by) {

            return res.json({
                success: true,
                message:
                    "Referral already applied"
            });

        }


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


        await supabase
            .from("users")
            .update({
                referral_count:
                    (referrer.referral_count || 0) + 1
            })
            .eq(
                "telegram_id",
                referrer.telegram_id
            );


        return res.json({
            success: true,
            message:
                "Referral applied"
        });


    } catch (error) {

        console.error(error);


        return res.status(500).json({
            success: false,
            error:
                "Server error"
        });

    }

}

);

// -------------------------
// Start server
// -------------------------

app.listen(
PORT,
"0.0.0.0",
() => {

    console.log(
        `Quick Gram server running on port ${PORT}`
    );

}

);
