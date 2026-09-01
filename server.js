const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

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

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing");
}

if (!SUPABASE_URL) {
    console.error("SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_SERVICE_KEY is missing");
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
);


// -------------------------
// Telegram initData check
// -------------------------

function validateTelegramInitData(initData) {

    if (!initData || !BOT_TOKEN) {
        return null;
    }

    const params = new URLSearchParams(initData);

    const hash = params.get("hash");

    if (!hash) {
        return null;
    }

    params.delete("hash");

    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secretKey = crypto
        .createHmac("sha256", "WebAppData")
        .update(BOT_TOKEN)
        .digest();

    const calculatedHash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

    if (calculatedHash !== hash) {
        return null;
    }

    const authDate = Number(params.get("auth_date"));

    if (!authDate) {
        return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);

    // Reject data older than 24 hours.
    if (currentTime - authDate > 86400) {
        return null;
    }

    const userString = params.get("user");

    if (!userString) {
        return null;
    }

    try {
        return JSON.parse(userString);
    } catch {
        return null;
    }
}


// -------------------------
// Health check
// -------------------------

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        app: "Quick Gram",
        status: "online"
    });

});


// -------------------------
// Login / user initialization
// -------------------------

app.post("/api/auth", async (req, res) => {

    try {

        const { initData } = req.body;

        const user = validateTelegramInitData(initData);

        if (!user) {

            return res.status(401).json({
                success: false,
                error: "Invalid Telegram authentication"
            });

        }

        const referralCode =
            "QG" +
            String(user.id).slice(-8);


        const { data: existingUser, error: findError } =
            await supabase
                .from("users")
                .select("*")
                .eq("telegram_id", user.id)
                .maybeSingle();


        if (findError) {
            throw findError;
        }


        if (existingUser) {

            const { data: updatedUser, error } =
                await supabase
                    .from("users")
                    .update({
                        username: user.username || null,
                        first_name: user.first_name || null,
                        last_name: user.last_name || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq("telegram_id", user.id)
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


        const { data: newUser, error } =
            await supabase
                .from("users")
                .insert({
                    telegram_id: user.id,
                    username: user.username || null,
                    first_name: user.first_name || null,
                    last_name: user.last_name || null,
                    balance: 0,
                    referral_code: referralCode
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
            error: "Server error"
        });

    }

});

// -------------------------
// Referral system
// -------------------------

app.post("/api/referral", async (req, res) => {

    try {

        const { initData, referralCode } = req.body;

        const user = validateTelegramInitData(initData);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid Telegram authentication"
            });
        }

        if (!referralCode) {
            return res.status(400).json({
                success: false,
                error: "Referral code missing"
            });
        }

        // Find the person who invited this user
        const { data: referrer, error: referrerError } =
            await supabase
                .from("users")
                .select("*")
                .eq("referral_code", referralCode)
                .maybeSingle();

        if (referrerError) {
            throw referrerError;
        }

        if (!referrer) {
            return res.status(404).json({
                success: false,
                error: "Referral code not found"
            });
        }

        // Prevent self-referral
        if (referrer.telegram_id === user.id) {
            return res.status(400).json({
                success: false,
                error: "You cannot refer yourself"
            });
        }

        // Check current user
        const { data: currentUser, error: userError } =
            await supabase
                .from("users")
                .select("*")
                .eq("telegram_id", user.id)
                .maybeSingle();

        if (userError) {
            throw userError;
        }

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Don't allow changing referral after already referred
        if (currentUser.referred_by) {
            return res.json({
                success: true,
                message: "Referral already applied"
            });
        }

        // Save referrer
        const { error: updateUserError } =
            await supabase
                .from("users")
                .update({
                    referred_by: referrer.telegram_id
                })
                .eq("telegram_id", user.id);

        if (updateUserError) {
            throw updateUserError;
        }

        // Increase referral count
        const { error: updateReferrerError } =
            await supabase
                .from("users")
                .update({
                    referral_count:
                        (referrer.referral_count || 0) + 1
                })
                .eq("telegram_id", referrer.telegram_id);

        if (updateReferrerError) {
            throw updateReferrerError;
        }

        return res.json({
            success: true,
            message: "Referral applied"
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            error: "Server error"
        });

    }

});
// -------------------------
// Start server
// -------------------------

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Quick Gram server running on port ${PORT}`
    );

});
