const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const telegramHandler = require("./api/telegram-notify");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const SOCIAL_INBOX_FILE = path.join(DATA_DIR, "social-inbox.json");
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v22.0";
const META_GRAPH_BASE = "https://graph.facebook.com/" + META_GRAPH_VERSION;
const META_AUTH_BASE = "https://www.facebook.com/" + META_GRAPH_VERSION + "/dialog/oauth";
const META_OAUTH_STATES = new Map();
const TEAM_A_KEY = "team-a";
const TEAM_B_KEY = "team-b";
const TEAM_CONFIG = {
    [TEAM_A_KEY]: {
        key: TEAM_A_KEY,
        label: "TEAM A",
        password: process.env.TEAM_A_PASSWORD || "team-a"
    },
    [TEAM_B_KEY]: {
        key: TEAM_B_KEY,
        label: "TEAM B",
        password: process.env.TEAM_B_PASSWORD || "team-b"
    }
};
const TEAM_STATE_FILES = {
    [TEAM_A_KEY]: path.join(DATA_DIR, "state.json"),
    [TEAM_B_KEY]: path.join(DATA_DIR, "team-b-state.json")
};
const activeSessions = new Map();

function ensureObject(value, fallback) {
    return value && typeof value === "object" ? value : fallback;
}

function normalizeState(rawState) {
    const safeState = ensureObject(rawState, {});
    const days = ensureObject(safeState.days, {});
    return { days };
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeSocialInbox(rawInbox) {
    const safeInbox = ensureObject(rawInbox, {});
    return {
        accounts: Array.isArray(safeInbox.accounts) ? safeInbox.accounts : [],
        conversations: Array.isArray(safeInbox.conversations) ? safeInbox.conversations : [],
        messages: Array.isArray(safeInbox.messages) ? safeInbox.messages : [],
        comments: Array.isArray(safeInbox.comments) ? safeInbox.comments : [],
        webhookEvents: Array.isArray(safeInbox.webhookEvents) ? safeInbox.webhookEvents : [],
        syncCursors: ensureObject(safeInbox.syncCursors, {}),
        updatedAt: typeof safeInbox.updatedAt === "string" ? safeInbox.updatedAt : nowIso()
    };
}

async function ensureStorage() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    for (const stateFile of Object.values(TEAM_STATE_FILES)) {
        try {
            await fs.access(stateFile);
        } catch (error) {
            await fs.writeFile(stateFile, JSON.stringify({ days: {} }, null, 2));
        }
    }
    try {
        await fs.access(SOCIAL_INBOX_FILE);
    } catch (error) {
        await fs.writeFile(SOCIAL_INBOX_FILE, JSON.stringify(normalizeSocialInbox({}), null, 2));
    }
}

function getStateFile(teamKey) {
    return TEAM_STATE_FILES[teamKey] || TEAM_STATE_FILES[TEAM_A_KEY];
}

async function readState(teamKey) {
    try {
        const raw = await fs.readFile(getStateFile(teamKey), "utf8");
        return normalizeState(JSON.parse(raw));
    } catch (error) {
        return { days: {} };
    }
}

async function writeState(teamKey, nextState) {
    const safeState = normalizeState(nextState);
    await fs.writeFile(getStateFile(teamKey), JSON.stringify(safeState, null, 2));
    return safeState;
}

async function readSocialInbox() {
    try {
        const raw = await fs.readFile(SOCIAL_INBOX_FILE, "utf8");
        return normalizeSocialInbox(JSON.parse(raw));
    } catch (error) {
        return normalizeSocialInbox({});
    }
}

async function writeSocialInbox(nextInbox) {
    const safeInbox = normalizeSocialInbox(Object.assign({}, nextInbox, { updatedAt: nowIso() }));
    await fs.writeFile(SOCIAL_INBOX_FILE, JSON.stringify(safeInbox, null, 2));
    return safeInbox;
}

function publicSocialInbox(inbox) {
    const safeInbox = normalizeSocialInbox(inbox);
    return {
        accounts: safeInbox.accounts.map((account) => {
            const safeAccount = Object.assign({}, account);
            delete safeAccount.accessToken;
            delete safeAccount.refreshToken;
            delete safeAccount.appSecret;
            delete safeAccount.encryptedAccessToken;
            return safeAccount;
        }),
        conversations: safeInbox.conversations,
        messages: safeInbox.messages,
        comments: safeInbox.comments,
        syncCursors: safeInbox.syncCursors,
        updatedAt: safeInbox.updatedAt
    };
}

function getPublicBaseUrl(req) {
    if (process.env.PUBLIC_BASE_URL) {
        return process.env.PUBLIC_BASE_URL.replace(/\/+$/, "");
    }
    const proto = req.get("x-forwarded-proto") || req.protocol || "http";
    const host = req.get("x-forwarded-host") || req.get("host");
    return proto + "://" + host;
}

function getMetaRedirectUri(req) {
    return process.env.META_REDIRECT_URI || (getPublicBaseUrl(req) + "/api/social-auth/meta/callback");
}

function metaConfigMissing() {
    return !process.env.META_APP_ID || !process.env.META_APP_SECRET;
}

function getTokenEncryptionKey() {
    const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET || "";
    if (!raw) return null;
    return crypto.createHash("sha256").update(raw).digest();
}

function encryptSecret(value) {
    const key = getTokenEncryptionKey();
    if (!key || !value) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        "v1",
        iv.toString("base64"),
        tag.toString("base64"),
        encrypted.toString("base64")
    ].join(":");
}

function decryptSecret(value) {
    const key = getTokenEncryptionKey();
    if (!key || !value) return "";
    const parts = String(value).split(":");
    if (parts.length !== 4 || parts[0] !== "v1") return "";
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const encrypted = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function metaScopes() {
    return [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
        "pages_manage_engagement",
        "pages_messaging",
        "instagram_basic",
        "instagram_manage_comments",
        "instagram_manage_messages"
    ];
}

async function metaFetch(pathname, params) {
    const url = new URL(META_GRAPH_BASE + pathname);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = payload && payload.error && payload.error.message ? payload.error.message : ("Meta request failed: " + response.status);
        throw new Error(detail);
    }
    return payload;
}

async function exchangeMetaCode(code, redirectUri) {
    const shortToken = await metaFetch("/oauth/access_token", {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code
    });
    const longToken = await metaFetch("/oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortToken.access_token
    });
    return longToken.access_token || shortToken.access_token;
}

async function fetchMetaAccounts(userAccessToken) {
    const payload = await metaFetch("/me/accounts", {
        fields: "id,name,access_token,instagram_business_account{id,username,name}",
        access_token: userAccessToken,
        limit: 100
    });
    return Array.isArray(payload.data) ? payload.data : [];
}

function upsertMetaConnectedAccounts(inbox, pages, teamKey) {
    const connectedAt = nowIso();
    pages.forEach((page) => {
        const encryptedPageToken = encryptSecret(page.access_token);
        upsertById(inbox.accounts, {
            id: "facebook:" + page.id,
            platform: "facebook",
            pageId: String(page.id),
            name: String(page.name || "Facebook Page"),
            status: encryptedPageToken ? "connected" : "missing-token-key",
            connectedByTeam: teamKey,
            scopes: metaScopes(),
            tokenType: "page",
            encryptedAccessToken: encryptedPageToken,
            createdAt: connectedAt,
            updatedAt: connectedAt
        });

        const ig = page.instagram_business_account;
        if (ig && ig.id) {
            upsertById(inbox.accounts, {
                id: "instagram:" + ig.id,
                platform: "instagram",
                pageId: String(ig.id),
                parentPageId: String(page.id),
                name: String(ig.username || ig.name || "Instagram Business"),
                status: encryptedPageToken ? "connected" : "missing-token-key",
                connectedByTeam: teamKey,
                scopes: metaScopes(),
                tokenType: "page",
                encryptedAccessToken: encryptedPageToken,
                createdAt: connectedAt,
                updatedAt: connectedAt
            });
        }
    });
}

function normalizePlatform(platform) {
    const value = String(platform || "").trim().toLowerCase();
    if (value === "instagram" || value === "ig") return "instagram";
    return "facebook";
}

function normalizeInboxType(type) {
    return type === "comment" ? "comment" : "message";
}

function upsertById(items, item) {
    const idx = items.findIndex((existing) => existing && existing.id === item.id);
    if (idx >= 0) {
        items[idx] = Object.assign({}, items[idx], item);
    } else {
        items.unshift(item);
    }
}

function ingestMetaWebhookPayload(inbox, payload) {
    const objectType = String(payload && payload.object || "");
    const platform = objectType.includes("instagram") ? "instagram" : "facebook";
    const entries = Array.isArray(payload && payload.entry) ? payload.entry : [];
    entries.forEach((entry) => {
        const accountId = platform + ":" + String(entry.id || "unknown");
        const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
        messaging.forEach((event) => {
            if (!event || !event.message || !event.message.text) return;
            const senderId = String(event.sender && event.sender.id || "unknown");
            const messageId = String(event.message.mid || crypto.randomBytes(10).toString("hex"));
            const createdAt = event.timestamp ? new Date(Number(event.timestamp)).toISOString() : nowIso();
            const conversationId = platform + ":conversation:" + senderId;
            upsertById(inbox.conversations, {
                id: conversationId,
                platform,
                accountId,
                title: senderId,
                type: "dm",
                status: "open",
                lastMessageAt: createdAt,
                updatedAt: nowIso()
            });
            upsertById(inbox.messages, {
                id: platform + ":message:" + messageId,
                platform,
                accountId,
                conversationId,
                externalId: messageId,
                direction: "inbound",
                authorName: senderId,
                text: String(event.message.text),
                source: "meta-webhook",
                createdAt
            });
        });

        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        changes.forEach((change) => {
            const value = ensureObject(change && change.value, {});
            const text = value.message || value.text || value.comment || "";
            const commentId = value.comment_id || value.id || value.item_id || "";
            if (!text || !commentId) return;
            upsertById(inbox.comments, {
                id: platform + ":comment:" + String(commentId),
                platform,
                accountId,
                postId: String(value.post_id || value.media_id || value.parent_id || ""),
                externalId: String(commentId),
                authorName: String(value.from && value.from.name || value.username || value.sender_name || "Unknown"),
                text: String(text),
                status: "open",
                source: "meta-webhook",
                createdAt: value.created_time ? new Date(Number(value.created_time) * 1000).toISOString() : nowIso(),
                updatedAt: nowIso()
            });
        });
    });
}

function issueSession(teamKey) {
    const token = crypto.randomBytes(24).toString("hex");
    activeSessions.set(token, {
        teamKey,
        createdAt: Date.now()
    });
    return token;
}

function getSessionFromRequest(req) {
    const token = req.get("x-auth-token");
    if (!token) return null;
    return activeSessions.get(token) || null;
}

function requireTeamAuth(req, res, next) {
    const session = getSessionFromRequest(req);
    if (!session || !TEAM_CONFIG[session.teamKey]) {
        res.status(401).json({
            ok: false,
            error: "Unauthorized"
        });
        return;
    }
    req.teamKey = session.teamKey;
    req.team = TEAM_CONFIG[session.teamKey];
    next();
}

function requireTeamA(req, res, next) {
    if (req.teamKey !== TEAM_A_KEY) {
        res.status(403).json({
            ok: false,
            error: "Social Inbox is available for TEAM A only"
        });
        return;
    }
    next();
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeExt = ext || ".bin";
        const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
        const teamPrefix = req.teamKey || "public";
        cb(null, teamPrefix + "-resource-" + unique + safeExt);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 12
    },
    fileFilter(req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("Only image uploads are allowed"));
    }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", function(req, res) {
    res.json({ ok: true });
});

app.post("/api/login", function(req, res) {
    const teamKey = String(req.body && req.body.team || "").trim().toLowerCase();
    const password = String(req.body && req.body.password || "");
    const team = TEAM_CONFIG[teamKey];

    if (!team) {
        res.status(400).json({
            ok: false,
            error: "Invalid team"
        });
        return;
    }

    if (password !== team.password) {
        res.status(401).json({
            ok: false,
            error: "Wrong password"
        });
        return;
    }

    const token = issueSession(teamKey);
    res.json({
        ok: true,
        token,
        team: {
            key: team.key,
            label: team.label
        }
    });
});

app.get("/api/state", requireTeamAuth, async function(req, res) {
    const state = await readState(req.teamKey);
    res.json({
        team: {
            key: req.team.key,
            label: req.team.label
        },
        state
    });
});

app.post("/api/state", requireTeamAuth, async function(req, res) {
    try {
        const saved = await writeState(req.teamKey, req.body);
        res.json({
            ok: true,
            team: {
                key: req.team.key,
                label: req.team.label
            },
            state: saved
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: "Failed to save state",
            detail: error && error.message ? error.message : String(error)
        });
    }
});

app.post("/api/upload-images", requireTeamAuth, function(req, res) {
    upload.array("images", 12)(req, res, function(error) {
        if (error) {
            res.status(400).json({
                ok: false,
                error: error.message || "Upload failed"
            });
            return;
        }
        const files = Array.isArray(req.files) ? req.files : [];
        res.json({
            ok: true,
            images: files.map((file) => ({
                name: file.filename,
                url: "/uploads/" + file.filename
            }))
        });
    });
});

app.post("/api/telegram-notify", requireTeamAuth, telegramHandler);

app.get("/api/social-inbox", requireTeamAuth, requireTeamA, async function(req, res) {
    const inbox = await readSocialInbox();
    res.json({
        ok: true,
        inbox: publicSocialInbox(inbox)
    });
});

app.get("/api/social-auth/meta/start", requireTeamAuth, requireTeamA, function(req, res) {
    if (metaConfigMissing()) {
        res.status(400).json({
            ok: false,
            error: "META_APP_ID and META_APP_SECRET are required"
        });
        return;
    }
    const state = crypto.randomBytes(18).toString("hex");
    const redirectUri = getMetaRedirectUri(req);
    META_OAUTH_STATES.set(state, {
        teamKey: req.teamKey,
        createdAt: Date.now(),
        redirectUri
    });
    const url = new URL(META_AUTH_BASE);
    url.searchParams.set("client_id", process.env.META_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", metaScopes().join(","));
    res.json({
        ok: true,
        authUrl: url.toString(),
        redirectUri,
        scopes: metaScopes()
    });
});

app.get("/api/social-auth/meta/callback", async function(req, res) {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const stateRecord = META_OAUTH_STATES.get(state);
    META_OAUTH_STATES.delete(state);

    if (!code || !stateRecord) {
        res.status(400).send("Meta connect failed: invalid state or missing code.");
        return;
    }

    try {
        const userAccessToken = await exchangeMetaCode(code, stateRecord.redirectUri);
        const pages = await fetchMetaAccounts(userAccessToken);
        const inbox = await readSocialInbox();
        upsertMetaConnectedAccounts(inbox, pages, stateRecord.teamKey);
        await writeSocialInbox(inbox);
        res.send([
            "<!doctype html>",
            "<meta charset=\"utf-8\">",
            "<title>Meta connected</title>",
            "<body style=\"font-family:sans-serif;padding:24px\">",
            "<h1>Meta connected</h1>",
            "<p>Connected " + pages.length + " Facebook Page record(s). You can return to Social Inbox and refresh.</p>",
            "<a href=\"/\">Back to Content Calendar</a>",
            "</body>"
        ].join(""));
    } catch (error) {
        res.status(500).send("Meta connect failed: " + (error && error.message ? error.message : String(error)));
    }
});

app.post("/api/social-accounts", requireTeamAuth, requireTeamA, async function(req, res) {
    try {
        const body = ensureObject(req.body, {});
        const platform = normalizePlatform(body.platform);
        const pageId = String(body.pageId || body.accountId || "").trim();
        const name = String(body.name || "").trim();
        if (!pageId || !name) {
            res.status(400).json({
                ok: false,
                error: "name and pageId are required"
            });
            return;
        }

        const inbox = await readSocialInbox();
        const account = {
            id: platform + ":" + pageId,
            platform,
            pageId,
            name,
            status: "pending-oauth",
            connectedByTeam: req.teamKey,
            scopes: Array.isArray(body.scopes) ? body.scopes : [],
            createdAt: nowIso(),
            updatedAt: nowIso()
        };
        upsertById(inbox.accounts, account);
        const saved = await writeSocialInbox(inbox);
        res.json({
            ok: true,
            account,
            inbox: publicSocialInbox(saved)
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: "Failed to save social account",
            detail: error && error.message ? error.message : String(error)
        });
    }
});

app.post("/api/social-accounts/:accountId/subscribe", requireTeamAuth, requireTeamA, async function(req, res) {
    try {
        const inbox = await readSocialInbox();
        const accountId = String(req.params.accountId || "");
        const account = inbox.accounts.find((item) => item && item.id === accountId);
        if (!account) {
            res.status(404).json({
                ok: false,
                error: "Account not found"
            });
            return;
        }
        if (account.platform !== "facebook") {
            res.status(400).json({
                ok: false,
                error: "Subscribe the parent Facebook Page for Instagram webhook delivery"
            });
            return;
        }
        const pageToken = decryptSecret(account.encryptedAccessToken);
        if (!pageToken) {
            res.status(400).json({
                ok: false,
                error: "Account has no readable encrypted token"
            });
            return;
        }
        const response = await fetch(META_GRAPH_BASE + "/" + encodeURIComponent(account.pageId) + "/subscribed_apps", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                subscribed_fields: "messages,messaging_postbacks,feed,mention,comments",
                access_token: pageToken
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = payload && payload.error && payload.error.message ? payload.error.message : ("Meta subscribe failed: " + response.status);
            throw new Error(detail);
        }
        account.status = "subscribed";
        account.subscribedAt = nowIso();
        account.updatedAt = nowIso();
        const saved = await writeSocialInbox(inbox);
        res.json({
            ok: true,
            result: payload,
            inbox: publicSocialInbox(saved)
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: "Failed to subscribe account",
            detail: error && error.message ? error.message : String(error)
        });
    }
});

app.post("/api/social-inbox/items", requireTeamAuth, requireTeamA, async function(req, res) {
    try {
        const body = ensureObject(req.body, {});
        const type = normalizeInboxType(body.type);
        const platform = normalizePlatform(body.platform);
        const accountId = String(body.accountId || platform + ":manual").trim();
        const authorName = String(body.authorName || "Unknown").trim();
        const text = String(body.text || "").trim();
        if (!text) {
            res.status(400).json({
                ok: false,
                error: "text is required"
            });
            return;
        }

        const inbox = await readSocialInbox();
        const createdAt = nowIso();
        const externalId = String(body.externalId || crypto.randomBytes(10).toString("hex"));
        if (type === "comment") {
            upsertById(inbox.comments, {
                id: platform + ":comment:" + externalId,
                platform,
                accountId,
                postId: String(body.postId || ""),
                externalId,
                authorName,
                text,
                status: "open",
                source: "manual",
                createdAt,
                updatedAt: createdAt
            });
        } else {
            const conversationId = String(body.conversationId || platform + ":conversation:" + externalId);
            upsertById(inbox.conversations, {
                id: conversationId,
                platform,
                accountId,
                title: String(body.title || authorName),
                type: "dm",
                status: "open",
                lastMessageAt: createdAt,
                updatedAt: createdAt
            });
            upsertById(inbox.messages, {
                id: platform + ":message:" + externalId,
                platform,
                accountId,
                conversationId,
                externalId,
                direction: body.direction === "outbound" ? "outbound" : "inbound",
                authorName,
                text,
                source: "manual",
                createdAt
            });
        }

        const saved = await writeSocialInbox(inbox);
        res.json({
            ok: true,
            inbox: publicSocialInbox(saved)
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: "Failed to save social inbox item",
            detail: error && error.message ? error.message : String(error)
        });
    }
});

app.get("/api/webhooks/meta", function(req, res) {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "";
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token && token === verifyToken) {
        res.status(200).send(challenge);
        return;
    }
    res.sendStatus(403);
});

app.post("/api/webhooks/meta", async function(req, res) {
    try {
        const inbox = await readSocialInbox();
        const event = {
            id: "meta:" + Date.now() + ":" + crypto.randomBytes(6).toString("hex"),
            provider: "meta",
            receivedAt: nowIso(),
            payload: req.body
        };
        inbox.webhookEvents.unshift(event);
        inbox.webhookEvents = inbox.webhookEvents.slice(0, 500);
        ingestMetaWebhookPayload(inbox, req.body);
        await writeSocialInbox(inbox);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: "Failed to store webhook event"
        });
    }
});

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

ensureStorage().then(function() {
    app.listen(PORT, HOST, function() {
        console.log("Content Calendar server listening on http://" + HOST + ":" + PORT);
    });
}).catch(function(error) {
    console.error("Failed to prepare storage:", error);
    process.exit(1);
});
