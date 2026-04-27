module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    }
    const message = body && body.message ? String(body.message) : "";

    if (!botToken || !chatId) {
        return res.status(500).json({
            ok: false,
            error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
        });
    }

    if (!message.trim()) {
        return res.status(400).json({ ok: false, error: "Missing message" });
    }

    try {
        const telegramResponse = await fetch(
            "https://api.telegram.org/bot" + botToken + "/sendMessage",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message
                })
            }
        );

        if (!telegramResponse.ok) {
            const text = await telegramResponse.text();
            return res.status(telegramResponse.status).json({
                ok: false,
                error: "Telegram API error",
                detail: text
            });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: "Failed to send Telegram message",
            detail: error && error.message ? error.message : String(error)
        });
    }
};
