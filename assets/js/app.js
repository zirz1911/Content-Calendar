    const STORAGE_KEY = "content_calendar_v1";
    const THEME_STORAGE_KEY = "content_calendar_theme";
    const AUTH_STORAGE_KEY = "content_calendar_auth_v1";
    const TEAM_A_KEY = "team-a";
    const plan30Days = [
        "ท่าแปลกแก้บัญชีบิน", "เลิกใช้ Chrome/Safari ฟาร์ม", "Proxy คืออะไร?",
        "วิธีเช็ค IP และลายนิ้วมือ", "จำลองคอม 100 เครื่อง", "mbasic ล็อกอินครั้งแรก",
        "วอร์มบัญชีให้แข็งปั๋ง", "3 ข้อห้ามซื้อบัญชีใหม่", "Gemlogin ต่างจากปกติยังไง?",
        "โดนแบน แก้ยื่นอุธรณ์ยังไง", "วิธีแบคอัพก่อนบัญชีปลิว", "Proxy ฟรี vs เสียตังค์",
        "เลี้ยงเพจยังไงไม่ให้ปลิว", "ท่าแปลก: แยก Profile แอดมิน", "จัดการ 50 บัญชีไม่มึน",
        "เปิดปิด เน็ตมือถือ โดนแบนไหม?", "User-Agent บอทดูอะไร?", "วิธีใช้ Cookie ไม่ต้องกรอกรหัส",
        "ตั้งค่าเบราว์เซอร์ เทา vs ขาว", "อุปกรณ์ฟาร์มบัญชี", "สเกลแอด 10 เท่า",
        "แชร์จอยังไงไม่ให้ IP หลุด", "วิธีเคลียร์ค่า 100%", "ยิงแอด ตปท. ใช้ Proxy ไร",
        "รีวิว 1 วันคนดูแล 100 บัญชี", "สปอยล์ระบบ GemAutomate", "ปั้นบัญชีสำรองรอเสียบ",
        "เช็คบัญชีย้อมแมว", "ศัพท์วงการฟาร์มแอด", "Q&A ตอบคำถามสายฟาร์ม"
    ];
    const PLATFORMS = ["Facebook", "Instagram", "Threads", "TikTok", "Lemon8", "X", "Youtube", "VK"];
    const CONTENT_TYPES = ["Video", "Post Image", "Post Text"];
    const TYPE_META = {
        "Video": {
            label: "Video Brief",
            defaultDescription: "รายละเอียดวิดีโอ: มุมเล่าเรื่อง / key message (คลิกแก้ไขได้)",
            showCover: true,
            showShots: true
        },
        "Post Image": {
            label: "Image Caption",
            defaultDescription: "รายละเอียดโพสต์ภาพ: caption / CTA (คลิกแก้ไขได้)",
            showCover: true,
            showShots: false
        },
        "Post Text": {
            label: "Post Text",
            defaultDescription: "รายละเอียดโพสต์ข้อความ: เนื้อหา / hook / CTA (คลิกแก้ไขได้)",
            showCover: false,
            showShots: false
        }
    };
    const CONTENT_START_DATE = new Date(2026, 3, 27);
    const contentSchedule = buildContentSchedule();
    const contentByDate = new Map(contentSchedule.map((item) => [item.dateKey, item]));

    let appState = { days: {} };
    let authToken = "";
    let currentTeamKey = "";
    let currentTeamLabel = "";
    let currentDateKey = null;
    let actionDateKey = null;
    let viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let saveTimer = null;
    let pendingEditNotification = null;
    let socialInbox = {
        accounts: [],
        conversations: [],
        messages: [],
        comments: [],
        syncCursors: {},
        updatedAt: ""
    };
    let selectedSocialPlatform = "all";
    const SOCIAL_PLATFORMS = [
        { key: "all", label: "All", icon: "A" },
        { key: "facebook", label: "Facebook", icon: "f" },
        { key: "instagram", label: "Instagram", icon: "IG" }
    ];

    function normalizeTeamKey(teamKey) {
        return TEAM_A_KEY;
    }

    function getTeamLabel(teamKey) {
        return "TEAM A";
    }

    function isTeamBContext() {
        return false;
    }

    function shouldImportLocalBackup() {
        return true;
    }

    function updateTeamSelectionUI() {
        const passwordStep = document.getElementById("auth-password-step");
        const selectedLabel = document.getElementById("selected-team-label");
        if (passwordStep) {
            passwordStep.classList.remove("hidden");
        }
        if (selectedLabel) {
            selectedLabel.textContent = getTeamLabel(TEAM_A_KEY);
        }
    }

    function getScopedStorageKey(baseKey) {
        return baseKey + "_" + normalizeTeamKey(currentTeamKey || TEAM_A_KEY);
    }

    function updateTeamBadge() {
        const badge = document.getElementById("team-label-badge");
        if (!badge) return;
        badge.textContent = currentTeamLabel || getTeamLabel(currentTeamKey);
    }

    function isTeamAActive() {
        return true;
    }

    function updateSocialInboxAccessUI() {
        const button = document.getElementById("social-inbox-open-btn");
        if (!button) return;
        button.classList.toggle("hidden", !isTeamAActive());
    }

    function setActiveTeam(teamKey, teamLabel) {
        currentTeamKey = normalizeTeamKey(teamKey);
        currentTeamLabel = teamLabel || getTeamLabel(currentTeamKey);
        updateTeamBadge();
        updateSocialInboxAccessUI();
    }

    function saveAuthSession() {
        try {
            sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
                token: authToken,
                teamKey: currentTeamKey,
                teamLabel: currentTeamLabel
            }));
        } catch (e) {
            // Ignore session storage failures.
        }
    }

    function loadAuthSession() {
        try {
            const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || !parsed.token || !parsed.teamKey) {
                return null;
            }
            return {
                token: String(parsed.token),
                teamKey: normalizeTeamKey(parsed.teamKey),
                teamLabel: parsed.teamLabel ? String(parsed.teamLabel) : getTeamLabel(parsed.teamKey)
            };
        } catch (e) {
            return null;
        }
    }

    function clearAuthSession() {
        authToken = "";
        currentTeamKey = "";
        currentTeamLabel = "";
        try {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
        } catch (e) {
            // Ignore session storage failures.
        }
    }

    function setAuthError(message) {
        const el = document.getElementById("auth-error");
        if (!el) return;
        if (!message) {
            el.textContent = "";
            el.classList.add("hidden");
            return;
        }
        el.textContent = message;
        el.classList.remove("hidden");
    }

    function showAuthGate() {
        const gate = document.getElementById("auth-gate");
        const appShell = document.getElementById("app-shell");
        if (gate) gate.classList.remove("hidden");
        if (appShell) appShell.classList.add("hidden");
        updateTeamSelectionUI();
    }

    function showAppShell() {
        const gate = document.getElementById("auth-gate");
        const appShell = document.getElementById("app-shell");
        if (gate) gate.classList.add("hidden");
        if (appShell) appShell.classList.remove("hidden");
        updateTeamBadge();
    }

    function closeAllModals() {
        closeDayAction();
        closeDeleteContentModal();
        closeContentCardsModal();
        closeContentFlowModal();
    }

    function normalizeTheme(theme) {
        return theme === "dark" ? "dark" : "light";
    }

    function getSavedTheme() {
        try {
            return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
        } catch (e) {
            return "light";
        }
    }

    function updateThemeToggleLabel(theme) {
        const button = document.getElementById("theme-toggle");
        if (!button) return;
        const nextTheme = theme === "dark" ? "light" : "dark";
        button.textContent = nextTheme === "dark" ? "Dark Theme" : "Bright Theme";
        button.setAttribute("aria-pressed", String(theme === "dark"));
        button.setAttribute("aria-label", "Switch to " + nextTheme + " theme");
        button.title = "Switch to " + nextTheme + " theme";
    }

    function applyTheme(theme) {
        const safeTheme = normalizeTheme(theme);
        document.body.setAttribute("data-theme", safeTheme);
        updateThemeToggleLabel(safeTheme);
    }

    function toggleTheme() {
        const currentTheme = normalizeTheme(document.body.getAttribute("data-theme"));
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch (e) {
            // Ignore storage failures and keep the in-session toggle working.
        }
    }

    function initTheme() {
        applyTheme(getSavedTheme());
        const button = document.getElementById("theme-toggle");
        if (!button) return;
        button.onclick = toggleTheme;
    }

    function newId(prefix) {
        return prefix + "_" + Math.random().toString(36).slice(2, 10);
    }

    function defaultShot(idx) {
        return {
            title: "Shot " + idx + ": ...",
            speech: "พิมพ์บทพูดที่นี่...",
            onScreen: "ข้อความบนจอ..."
        };
    }

    function normalizeContentType(type) {
        return CONTENT_TYPES.includes(type) ? type : "Video";
    }

    function getTypeMeta(type) {
        return TYPE_META[normalizeContentType(type)];
    }

    function defaultDescriptionForType(type) {
        return getTypeMeta(type).defaultDescription;
    }

    function defaultContent(dateKey, idx) {
        const suggested = contentByDate.get(dateKey);
        const dateObj = parseDateKey(dateKey);
        const suggestedHeadline = suggested ? ("Day " + suggested.dayNum + ": " + suggested.title) : "";
        const defaultHeadline = idx === 1
            ? (suggestedHeadline || ("Content: " + formatContentDate(dateObj)))
            : ("Content " + idx + ": " + formatContentDate(dateObj));
        return {
            id: newId("content"),
            type: "Video",
            headline: defaultHeadline,
            description: defaultDescriptionForType("Video"),
            status: "Draft",
            priority: "Priority",
            platforms: [],
            coverImages: [],
            coverImage: "",
            shots: [defaultShot(1)]
        };
    }

    function defaultDay(dateKey) {
        const content = defaultContent(dateKey, 1);
        return {
            selectedContentId: content.id,
            contents: [content]
        };
    }

    function localDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
    }

    function parseDateKey(dateKey) {
        const parts = String(dateKey).split("-");
        if (parts.length !== 3) {
            return new Date();
        }
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        if (!y || !m || !d) {
            return new Date();
        }
        return new Date(y, m - 1, d);
    }

    function formatMonthLabel(date) {
        return date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        }).toUpperCase();
    }

    function formatContentDate(date) {
        return date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function buildContentSchedule() {
        const schedule = [];
        for (let i = 0; i < plan30Days.length; i++) {
            const date = new Date(CONTENT_START_DATE);
            date.setDate(CONTENT_START_DATE.getDate() + i);
            schedule.push({
                dayNum: i + 1,
                title: plan30Days[i],
                date: date,
                dateKey: localDateKey(date)
            });
        }
        return schedule;
    }

    function nextMonth() {
        viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1);
        renderCalendar();
    }

    function prevMonth() {
        viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1);
        renderCalendar();
    }

    function goToCurrentDay() {
        const today = new Date();
        viewedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        renderCalendar();
    }

    function normalizeStateShape(rawState) {
        if (!rawState || typeof rawState !== "object" || !rawState.days || typeof rawState.days !== "object") {
            return { days: {} };
        }
        const migratedDays = {};
        Object.entries(rawState.days).forEach(([key, value]) => {
            if (/^\d+$/.test(key)) {
                const dayNum = Number(key);
                const mapped = contentSchedule[dayNum - 1];
                if (mapped) {
                    migratedDays[mapped.dateKey] = value;
                }
                return;
            }
            migratedDays[key] = value;
        });
        return { days: migratedDays };
    }

    function loadLocalState() {
        try {
            const raw = localStorage.getItem(getScopedStorageKey(STORAGE_KEY));
            if (!raw) {
                return { days: {} };
            }
            return normalizeStateShape(JSON.parse(raw));
        } catch (e) {
            return { days: {} };
        }
    }

    function hasSavedDays(state) {
        return !!(state && state.days && Object.keys(state.days).length > 0);
    }

    async function fetchWithTimeout(resource, options, timeoutMs) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs || 5000);
        try {
            const nextOptions = Object.assign({}, options || {}, { signal: controller.signal });
            return await fetch(resource, nextOptions);
        } finally {
            window.clearTimeout(timer);
        }
    }

    async function apiFetch(resource, options, timeoutMs) {
        const nextOptions = Object.assign({}, options || {});
        const nextHeaders = Object.assign({}, nextOptions.headers || {});
        if (authToken) {
            nextHeaders["x-auth-token"] = authToken;
        }
        nextOptions.headers = nextHeaders;
        return fetchWithTimeout(resource, nextOptions, timeoutMs);
    }

    async function loadState() {
        const localState = loadLocalState();
        try {
            const response = await apiFetch("/api/state", null, 5000);
            if (response.status === 401) {
                const unauthorizedError = new Error("Unauthorized");
                unauthorizedError.code = "UNAUTHORIZED";
                throw unauthorizedError;
            }
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            const payload = await response.json();
            if (payload && payload.team) {
                setActiveTeam(payload.team.key, payload.team.label);
            }
            const remoteState = normalizeStateShape(payload && payload.state ? payload.state : payload);
            if (shouldImportLocalBackup() && !hasSavedDays(remoteState) && hasSavedDays(localState)) {
                try {
                    await apiFetch("/api/state", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(localState)
                    }, 5000);
                } catch (syncError) {
                    // Ignore migration sync failures and continue with local data.
                }
                return localState;
            }
            try {
                localStorage.setItem(getScopedStorageKey(STORAGE_KEY), JSON.stringify(remoteState));
            } catch (e) {
                // Ignore local backup failures.
            }
            return remoteState;
        } catch (e) {
            if (e && e.code === "UNAUTHORIZED") {
                throw e;
            }
            return localState;
        }
    }

    function setTelegramState(state) {
        const el = document.getElementById("telegram-state");
        if (!el) return;
        if (!state) {
            el.textContent = "";
            el.classList.add("hidden");
            el.classList.remove("ok", "err");
            return;
        }
        el.classList.remove("hidden");
        el.textContent = state === "success" ? "Send Success" : "Send Fail";
        el.classList.remove("ok", "err");
        if (state === "success") el.classList.add("ok");
        if (state === "fail") el.classList.add("err");
    }

    function formatPlatforms(platforms) {
        if (!Array.isArray(platforms) || platforms.length === 0) return "-";
        return platforms.join(", ");
    }

    function buildContentPayload(dateKey, content, reason) {
        if (!dateKey || !content) return null;
        return {
            reason: reason || "edited",
            dateKey: dateKey,
            dateLabel: formatContentDate(parseDateKey(dateKey)),
            headline: normalizeEditableText(content.headline) || "Untitled Content",
            type: normalizeContentType(content.type),
            status: content.status || "Draft",
            priority: content.priority || "Priority",
            platforms: Array.isArray(content.platforms) ? content.platforms.slice() : []
        };
    }

    function buildMovePayload(fromDateKey, toDateKey, content) {
        const payload = buildContentPayload(toDateKey, content, "moved");
        if (!payload) return null;
        payload.fromDateKey = fromDateKey;
        payload.fromDateLabel = formatContentDate(parseDateKey(fromDateKey));
        return payload;
    }

    function getCurrentContentPayload(reason) {
        const dateKey = resolveDateKey(currentDateKey);
        const content = getCurrentContent();
        return buildContentPayload(dateKey, content, reason);
    }

    function buildTelegramMessage(action, payload) {
        let header = "✏️ Content Edited";
        if (action === "add") {
            header = "➕ Content Added";
        } else if (action === "save") {
            header = "💾 Content Saved";
        } else if (action === "move") {
            header = "↔ Content Moved";
        }
        const lines = [
            header,
            "Date: " + payload.dateLabel + " (" + payload.dateKey + ")",
            "Headline: " + payload.headline,
            "Type: " + payload.type,
            "Status: " + payload.status,
            "Priority: " + payload.priority,
            "Platforms: " + formatPlatforms(payload.platforms)
        ];
        if (payload.fromDateKey) {
            lines.splice(2, 0, "From: " + payload.fromDateLabel + " (" + payload.fromDateKey + ")");
        }
        return lines.join("\n");
    }

    async function sendTelegramNotification(action, payload) {
        if (!payload) return;
        try {
            const response = await apiFetch("/api/telegram-notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: buildTelegramMessage(action, payload)
                })
            }, 8000);
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            setTelegramState("success");
        } catch (e) {
            setTelegramState("fail");
        }
    }

    function markPendingEditNotification(reason) {
        pendingEditNotification = getCurrentContentPayload(reason || "edited");
    }

    async function persistState(sendEditNotification) {
        try {
            const response = await apiFetch("/api/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(appState)
            }, 5000);
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            const saved = await response.json();
            if (saved && saved.team) {
                setActiveTeam(saved.team.key, saved.team.label);
            }
            if (saved && saved.state) {
                appState = normalizeStateShape(saved.state);
            }
            try {
                localStorage.setItem(getScopedStorageKey(STORAGE_KEY), JSON.stringify(appState));
            } catch (e) {
                // Ignore local backup failures.
            }
            flashSaveState("บันทึกแล้ว");
            if (sendEditNotification && pendingEditNotification) {
                const payload = pendingEditNotification;
                pendingEditNotification = null;
                const action = payload.reason === "saved"
                    ? "save"
                    : (payload.reason === "moved" ? "move" : "edit");
                sendTelegramNotification(action, payload);
            }
        } catch (e) {
            const el = document.getElementById("save-state");
            if (el) {
                el.textContent = "Save failed";
                el.classList.remove("ok");
            }
        }
    }

    function flashSaveState(text) {
        const el = document.getElementById("save-state");
        if (!el) return;
        el.textContent = text;
        el.classList.add("ok");
        window.setTimeout(() => {
            el.classList.remove("ok");
        }, 700);
    }

    function queueSaveLabel(markAsEdit) {
        if (markAsEdit) {
            markPendingEditNotification("edited");
        }
        const el = document.getElementById("save-state");
        if (!el) return;
        el.textContent = "มีการแก้ไข ยังไม่ Save";
        el.classList.remove("ok");
        if (saveTimer) {
            window.clearTimeout(saveTimer);
        }
        saveTimer = window.setTimeout(() => {
            persistState(false);
        }, 500);
    }

    function escapeHtml(str) {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#39;");
    }

    function normalizeSocialInbox(rawInbox) {
        const safeInbox = rawInbox && typeof rawInbox === "object" ? rawInbox : {};
        return {
            accounts: Array.isArray(safeInbox.accounts) ? safeInbox.accounts : [],
            conversations: Array.isArray(safeInbox.conversations) ? safeInbox.conversations : [],
            messages: Array.isArray(safeInbox.messages) ? safeInbox.messages : [],
            comments: Array.isArray(safeInbox.comments) ? safeInbox.comments : [],
            syncCursors: safeInbox.syncCursors && typeof safeInbox.syncCursors === "object" ? safeInbox.syncCursors : {},
            updatedAt: typeof safeInbox.updatedAt === "string" ? safeInbox.updatedAt : ""
        };
    }

    function platformLabel(platform) {
        return platform === "instagram" ? "Instagram" : "Facebook";
    }

    function normalizeSocialPlatform(platform) {
        return platform === "instagram" ? "instagram" : "facebook";
    }

    function setSocialInboxState(text, isOk) {
        const el = document.getElementById("social-inbox-state");
        if (!el) return;
        el.textContent = text || "";
        el.classList.toggle("ok", !!isOk);
    }

    function renderEmptySocialList(element, text) {
        if (!element) return;
        element.innerHTML = `<div class="social-empty">${escapeHtml(text)}</div>`;
    }

    function conversationTitle(message) {
        const conversation = socialInbox.conversations.find((item) => item.id === message.conversationId);
        return conversation && conversation.title ? conversation.title : (message.authorName || "Unknown");
    }

    function buildSocialFeedItems() {
        const messages = socialInbox.messages.map((message) => ({
            id: message.id,
            kind: "message",
            platform: normalizeSocialPlatform(message.platform),
            title: conversationTitle(message),
            text: message.text || "-",
            meta: message.direction || "inbound",
            createdAt: message.createdAt || ""
        }));
        const comments = socialInbox.comments.map((comment) => ({
            id: comment.id,
            kind: "comment",
            platform: normalizeSocialPlatform(comment.platform),
            title: comment.authorName || "Unknown",
            text: comment.text || "-",
            meta: comment.status || "open",
            createdAt: comment.createdAt || ""
        }));
        return messages.concat(comments).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    function getSocialFeedItemsForSelectedPlatform() {
        const items = buildSocialFeedItems();
        if (selectedSocialPlatform === "all") return items;
        return items.filter((item) => item.platform === selectedSocialPlatform);
    }

    function countSocialItems(platformKey) {
        if (platformKey === "all") {
            return socialInbox.messages.length + socialInbox.comments.length;
        }
        return buildSocialFeedItems().filter((item) => item.platform === platformKey).length;
    }

    function renderSocialPlatformMenu() {
        const menu = document.getElementById("social-platform-menu");
        if (!menu) return;
        menu.innerHTML = "";
        SOCIAL_PLATFORMS.forEach((platform) => {
            const count = countSocialItems(platform.key);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "social-platform-btn" + (selectedSocialPlatform === platform.key ? " active" : "");
            button.onclick = () => selectSocialPlatform(platform.key);
            button.innerHTML = `
                <span class="social-platform-icon">${escapeHtml(platform.icon)}</span>
                <span class="social-platform-label">${escapeHtml(platform.label)}</span>
                ${count > 0 ? `<span class="social-alert-badge">${count}</span>` : ""}
            `;
            menu.appendChild(button);
        });
    }

    function renderSocialConnectedAccounts() {
        const list = document.getElementById("social-connected-accounts");
        if (!list) return;
        list.innerHTML = "";
        if (!socialInbox.accounts.length) {
            renderEmptySocialList(list, "ยังไม่มี account");
            return;
        }
        socialInbox.accounts.forEach((account) => {
            const card = document.createElement("div");
            card.className = "social-connected-card";
            const canSubscribe = account.platform === "facebook" && (account.status === "connected" || account.status === "missing-token-key");
            const accountArg = JSON.stringify(String(account.id || ""));
            card.innerHTML = `
                <div class="social-title">${escapeHtml(account.name || "Unnamed")}</div>
                <div class="social-sub">${escapeHtml(platformLabel(account.platform))} • ${escapeHtml(account.status || "pending")}</div>
                ${canSubscribe ? `<button type="button" onclick='subscribeSocialAccount(${escapeHtml(accountArg)})'>Subscribe</button>` : ""}
            `;
            list.appendChild(card);
        });
    }

    function renderSocialFeed() {
        const list = document.getElementById("social-feed-list");
        const title = document.getElementById("social-feed-title");
        const sub = document.getElementById("social-feed-sub");
        if (!list) return;

        const selected = SOCIAL_PLATFORMS.find((platform) => platform.key === selectedSocialPlatform) || SOCIAL_PLATFORMS[0];
        const items = getSocialFeedItemsForSelectedPlatform();
        if (title) {
            title.textContent = selected.key === "all" ? "All Platforms" : selected.label;
        }
        if (sub) {
            sub.textContent = items.length + " รายการ รวม DM และคอมเมนต์";
        }

        list.innerHTML = "";
        if (!items.length) {
            renderEmptySocialList(list, "ยังไม่มีข้อความหรือคอมเมนต์ในแพลตฟอร์มนี้");
            return;
        }
        items.forEach((item) => {
            const card = document.createElement("div");
            card.className = "social-feed-card";
            card.innerHTML = `
                <div class="social-feed-top">
                    <span class="mini-badge">${escapeHtml(platformLabel(item.platform))}</span>
                    <span class="mini-badge">${item.kind === "message" ? "DM" : "Comment"}</span>
                    <span class="mini-badge">${escapeHtml(item.meta)}</span>
                </div>
                <div class="social-title">${escapeHtml(item.title)}</div>
                <p>${escapeHtml(item.text)}</p>
                <div class="social-sub">${escapeHtml(item.createdAt)}</div>
            `;
            list.appendChild(card);
        });
    }

    function renderSocialInbox() {
        renderSocialPlatformMenu();
        renderSocialConnectedAccounts();
        renderSocialFeed();
        const total = socialInbox.messages.length + socialInbox.comments.length;
        const suffix = socialInbox.updatedAt ? " • " + socialInbox.updatedAt : "";
        setSocialInboxState(total + " inbox items" + suffix, true);
    }

    function selectSocialPlatform(platformKey) {
        selectedSocialPlatform = SOCIAL_PLATFORMS.some((platform) => platform.key === platformKey) ? platformKey : "all";
        renderSocialInbox();
    }

    async function loadSocialInbox() {
        setSocialInboxState("Loading social inbox...", false);
        try {
            const response = await apiFetch("/api/social-inbox", null, 5000);
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            const payload = await response.json();
            socialInbox = normalizeSocialInbox(payload && payload.inbox);
            renderSocialInbox();
        } catch (error) {
            setSocialInboxState("Load social inbox failed", false);
        }
    }

    async function seedSocialAccount() {
        const platform = socialInbox.accounts.some((account) => account.platform === "facebook") ? "instagram" : "facebook";
        const name = platform === "instagram" ? "Instagram Business Placeholder" : "Facebook Page Placeholder";
        const pageId = platform === "instagram" ? "ig-account-id" : "fb-page-id";
        setSocialInboxState("Saving account placeholder...", false);
        try {
            const response = await apiFetch("/api/social-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platform,
                    name,
                    pageId,
                    scopes: platform === "instagram"
                        ? ["instagram_business_manage_messages", "instagram_manage_comments"]
                        : ["pages_messaging", "pages_read_engagement", "pages_manage_engagement"]
                })
            }, 5000);
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            const payload = await response.json();
            socialInbox = normalizeSocialInbox(payload && payload.inbox);
            renderSocialInbox();
        } catch (error) {
            setSocialInboxState("Save account failed", false);
        }
    }

    async function connectMetaAccount() {
        setSocialInboxState("Preparing Meta connect...", false);
        try {
            const response = await apiFetch("/api/social-auth/meta/start", null, 5000);
            const payload = await response.json();
            if (!response.ok || !payload || !payload.authUrl) {
                throw new Error(payload && payload.error ? payload.error : "Meta connect is not configured");
            }
            window.location.href = payload.authUrl;
        } catch (error) {
            setSocialInboxState(error && error.message ? error.message : "Meta connect failed", false);
        }
    }

    async function subscribeSocialAccount(accountId) {
        setSocialInboxState("Subscribing webhook...", false);
        try {
            const response = await apiFetch("/api/social-accounts/" + encodeURIComponent(accountId) + "/subscribe", {
                method: "POST"
            }, 10000);
            const payload = await response.json();
            if (!response.ok || !payload || !payload.ok) {
                throw new Error(payload && (payload.detail || payload.error) ? (payload.detail || payload.error) : "Subscribe failed");
            }
            socialInbox = normalizeSocialInbox(payload && payload.inbox);
            renderSocialInbox();
        } catch (error) {
            setSocialInboxState(error && error.message ? error.message : "Subscribe failed", false);
        }
    }

    async function seedSocialItem(type) {
        const isComment = type === "comment";
        const targetPlatform = selectedSocialPlatform === "instagram" ? "instagram" : "facebook";
        const account = socialInbox.accounts.find((item) => normalizeSocialPlatform(item.platform) === targetPlatform)
            || { id: targetPlatform + ":manual", platform: targetPlatform };
        setSocialInboxState("Saving sample item...", false);
        try {
            const response = await apiFetch("/api/social-inbox/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: isComment ? "comment" : "message",
                    platform: account.platform || "facebook",
                    accountId: account.id || "facebook:manual",
                    authorName: isComment ? "Comment User" : "Inbox User",
                    title: "Customer Thread",
                    text: isComment ? "สนใจบริการนี้ ขอรายละเอียดเพิ่มค่ะ" : "ทักมาสอบถามแพ็กเกจครับ",
                    postId: "sample-post"
                })
            }, 5000);
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            const payload = await response.json();
            socialInbox = normalizeSocialInbox(payload && payload.inbox);
            renderSocialInbox();
        } catch (error) {
            setSocialInboxState("Save sample failed", false);
        }
    }

    function normalizeEditableText(text) {
        return String(text || "")
            .replaceAll("\u00a0", " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isTemplateEditableText(text) {
        const defaultDescriptions = CONTENT_TYPES.map((type) => defaultDescriptionForType(type));
        return text === "พิมพ์บทพูดที่นี่..."
            || text === "ข้อความบนจอ..."
            || text === "Day X: หัวข้อคลิป"
            || text === "รายละเอียด: แผนคลิป TikTok / Shorts"
            || text === "Type headline here"
            || text === "Type detail here"
            || defaultDescriptions.includes(text)
            || /^Shot \d+: \.\.\.$/.test(text);
    }

    function placeCaretAtEnd(element) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function beginQuickEdit(element) {
        const text = normalizeEditableText(element.innerText);
        if (isTemplateEditableText(text)) {
            element.innerText = "";
            placeCaretAtEnd(element);
        }
    }

    function normalizeContentItem(rawContent, dateKey, idx) {
        const base = defaultContent(dateKey, idx + 1);
        const content = Object.assign({}, base, rawContent || {});
        content.id = (rawContent && typeof rawContent.id === "string" && rawContent.id)
            ? rawContent.id
            : newId("content");
        content.type = normalizeContentType(content.type);
        content.headline = content.headline || base.headline;
        content.description = content.description || defaultDescriptionForType(content.type);
        const normalizedCoverImages = Array.isArray(content.coverImages)
            ? content.coverImages.filter((item) => typeof item === "string" && item)
            : [];
        if (normalizedCoverImages.length > 0) {
            content.coverImages = normalizedCoverImages;
            content.coverImage = normalizedCoverImages[0];
        } else if (typeof content.coverImage === "string" && content.coverImage) {
            content.coverImages = [content.coverImage];
        } else {
            content.coverImages = [];
            content.coverImage = "";
        }

        if (!content.status) {
            const sourceShots = Array.isArray(rawContent && rawContent.shots) ? rawContent.shots : [];
            const hasDone = sourceShots.some((s) => s && s.status === "Done");
            const hasReady = sourceShots.some((s) => s && s.status === "Ready");
            content.status = hasDone ? "Done" : (hasReady ? "Ready" : "Draft");
        }
        if (!content.priority) {
            const sourceShots = Array.isArray(rawContent && rawContent.shots) ? rawContent.shots : [];
            const hasHigh = sourceShots.some((s) => s && s.priority === "High");
            content.priority = hasHigh ? "High" : "Priority";
        }

        if (Array.isArray(content.platforms)) {
            content.platforms = content.platforms
                .map((p) => (p === "YouTube" ? "Youtube" : p))
                .filter((p) => PLATFORMS.includes(p));
        } else {
            content.platforms = [];
        }

        if (!Array.isArray(content.shots) || content.shots.length === 0) {
            content.shots = [defaultShot(1)];
        } else {
            content.shots = content.shots.map((shot, shotIdx) => {
                const normalizedShot = Object.assign({}, defaultShot(shotIdx + 1), shot || {});
                return {
                    title: normalizedShot.title,
                    speech: normalizedShot.speech,
                    onScreen: normalizedShot.onScreen
                };
            });
        }

        return content;
    }

    function normalizeDayState(rawDay, dateKey) {
        if (!rawDay || typeof rawDay !== "object") {
            return defaultDay(dateKey);
        }

        if (Array.isArray(rawDay.contents)) {
            const contents = rawDay.contents.map((content, idx) => normalizeContentItem(content, dateKey, idx));
            if (contents.length === 0) {
                return {
                    selectedContentId: "",
                    contents: []
                };
            }
            const selectedId = contents.some((c) => c.id === rawDay.selectedContentId)
                ? rawDay.selectedContentId
                : contents[0].id;
            return {
                selectedContentId: selectedId,
                contents: contents
            };
        }

        // Legacy day shape with single content fields at day level
        const legacyContent = normalizeContentItem({
            headline: rawDay.headline,
            description: rawDay.description,
            status: rawDay.status,
            priority: rawDay.priority,
            coverImages: rawDay.coverImages,
            coverImage: rawDay.coverImage,
            platforms: rawDay.platforms,
            shots: rawDay.shots
        }, dateKey, 0);

        return {
            selectedContentId: legacyContent.id,
            contents: [legacyContent]
        };
    }

    function getCurrentDayState() {
        if (!currentDateKey) return null;
        const key = String(currentDateKey);
        if (!appState.days[key]) {
            appState.days[key] = defaultDay(key);
        }
        appState.days[key] = normalizeDayState(appState.days[key], key);
        return appState.days[key];
    }

    function getCurrentContent(day) {
        const currentDay = day || getCurrentDayState();
        if (!currentDay || !Array.isArray(currentDay.contents) || currentDay.contents.length === 0) {
            return null;
        }
        const selected = currentDay.contents.find((content) => content.id === currentDay.selectedContentId);
        if (selected) {
            return selected;
        }
        currentDay.selectedContentId = currentDay.contents[0].id;
        return currentDay.contents[0];
    }

    function ensureCurrentContent(createIfMissing) {
        const day = getCurrentDayState();
        if (!day) return null;
        let content = getCurrentContent(day);
        if (!content && createIfMissing) {
            const newContent = defaultContent(currentDateKey, day.contents.length + 1);
            day.contents.push(newContent);
            day.selectedContentId = newContent.id;
            content = newContent;
        }
        return content;
    }

    function dayStatusLabel(dayData) {
        if (!dayData || !Array.isArray(dayData.contents) || dayData.contents.length === 0) return "";
        const statuses = dayData.contents.map((content) => content.status || "Draft");
        if (statuses.every((status) => status === "Done")) return "Done";
        if (statuses.some((status) => status === "Schedule" || status === "Ready" || status === "Done")) return "In Progress";
        return "Draft";
    }

    function badgeClass(label) {
        if (label === "Done") return "";
        if (label === "In Progress") return "warn";
        if (label === "Draft") return "muted";
        return "muted";
    }

    function resolveDateKey(dateKey) {
        const raw = dateKey || currentDateKey;
        if (!raw) return null;
        const parsed = parseDateKey(raw);
        return localDateKey(parsed);
    }

    function renderCalendar() {
        const grid = document.getElementById("days-grid");
        grid.innerHTML = "";
        const year = viewedMonth.getFullYear();
        const month = viewedMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const firstWeekday = firstDayOfMonth.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

        const monthLabel = document.getElementById("month-label");
        monthLabel.textContent = formatMonthLabel(viewedMonth);

        const todayKey = localDateKey(new Date());
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const card = document.createElement("div");
            const dayOfMonth = cellIndex - firstWeekday + 1;

            if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
                card.className = "day-cell ghost";
                card.innerHTML = "";
                grid.appendChild(card);
                continue;
            }

            const cellDate = new Date(year, month, dayOfMonth);
            const dateKey = localDateKey(cellDate);
            let dayData = null;
            if (appState.days[dateKey]) {
                dayData = normalizeDayState(appState.days[dateKey], dateKey);
                appState.days[dateKey] = dayData;
            }
            const todayClass = dateKey === todayKey ? "today" : "";
            const status = dayStatusLabel(dayData);
            const statusBadge = status ? `<div class="post-badge ${badgeClass(status)}">${escapeHtml(status)}</div>` : "";
            const contentCount = dayData && Array.isArray(dayData.contents) ? dayData.contents.length : 0;
            const tagText = contentCount > 0
                ? (contentCount + (contentCount > 1 ? " contents" : " content"))
                : "";
            const tagHtml = tagText ? `<div class="content-day-tag">${escapeHtml(tagText)}</div>` : "";

            let titleText = "";
            if (contentCount > 0) {
                titleText = dayData.contents[0].headline || titleText;
            }

            card.className = "day-cell";
            card.onclick = () => openDayAction(dateKey);
            card.innerHTML = `
                <div class="day-number ${todayClass}">${dayOfMonth}</div>
                ${tagHtml}
                ${statusBadge}
                <div class="day-title">${escapeHtml(titleText)}</div>
                <div class="add-post-overlay"><span class="add-post-btn">Open Day</span></div>
            `;

            grid.appendChild(card);
        }
    }

    function renderContentSelector() {
        const day = getCurrentDayState();
        const currentContent = getCurrentContent(day);
        const select = document.getElementById("content-select");
        if (!select || !day) return;

        select.innerHTML = "";
        if (!Array.isArray(day.contents) || day.contents.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No content yet";
            select.appendChild(option);
            select.value = "";
            return;
        }
        day.contents.forEach((content, idx) => {
            const option = document.createElement("option");
            const label = normalizeEditableText(content.headline || ("Content " + (idx + 1)));
            option.value = content.id;
            option.textContent = (idx + 1) + ". [" + normalizeContentType(content.type) + "] " + (label || ("Content " + (idx + 1)));
            select.appendChild(option);
        });
        select.value = currentContent ? currentContent.id : "";
    }

    function renderContentTypeControl() {
        const content = getCurrentContent();
        const typeSelect = document.getElementById("content-type-select");
        if (!typeSelect || !content) return;
        typeSelect.value = normalizeContentType(content.type);
    }

    function renderMoveDateControl() {
        const input = document.getElementById("move-content-date");
        if (!input) return;
        input.value = resolveDateKey(currentDateKey) || "";
    }

    function updateMoveDateLabel() {
        const input = document.getElementById("move-content-date");
        if (!input || !input.value) return;
        input.value = resolveDateKey(input.value) || "";
    }

    function applyContentTypeUI(content) {
        const safeType = normalizeContentType(content && content.type);
        const meta = getTypeMeta(safeType);
        const isVideo = safeType === "Video";
        const descriptionLabel = document.getElementById("current-day-desc-label");
        const topDetailSection = document.getElementById("top-detail-section");
        const bottomDetailSection = document.getElementById("non-video-detail-section");
        const bottomDetailLabel = document.getElementById("non-video-detail-label");
        const coverSection = document.getElementById("cover-section");
        const videoSection = document.getElementById("video-section");

        if (descriptionLabel) {
            descriptionLabel.innerText = meta.label;
        }
        if (topDetailSection) {
            topDetailSection.classList.toggle("hidden", !isVideo);
        }
        if (bottomDetailSection) {
            bottomDetailSection.classList.toggle("hidden", isVideo);
        }
        if (bottomDetailLabel) {
            bottomDetailLabel.innerText = meta.label;
        }
        if (coverSection) {
            coverSection.classList.toggle("hidden", !meta.showCover);
        }
        if (videoSection) {
            videoSection.classList.toggle("hidden", !meta.showShots);
        }
    }

    function switchContent(contentId) {
        const day = getCurrentDayState();
        if (!day) return;
        if (!day.contents.some((content) => content.id === contentId)) return;
        day.selectedContentId = contentId;
        renderEditorContent();
        queueSaveLabel(false);
    }

    function addContentItem() {
        const day = getCurrentDayState();
        if (!day) return;
        const newContent = defaultContent(currentDateKey, day.contents.length + 1);
        day.contents.push(newContent);
        day.selectedContentId = newContent.id;
        renderEditorContent();
        renderCalendar();
        const payload = buildContentPayload(resolveDateKey(currentDateKey), newContent, "added");
        sendTelegramNotification("add", payload);
        queueSaveLabel(false);
    }

    function requestDeleteCurrentContent() {
        const day = getCurrentDayState();
        if (!day || !Array.isArray(day.contents) || day.contents.length === 0) return;
        const content = getCurrentContent(day);
        const message = document.getElementById("delete-content-message");
        if (message) {
            const label = content && normalizeEditableText(content.headline)
                ? normalizeEditableText(content.headline)
                : "this content";
            message.innerText = "Delete " + label + "?";
        }
        document.getElementById("delete-content-modal").classList.remove("hidden");
    }

    function closeDeleteContentModal() {
        const modal = document.getElementById("delete-content-modal");
        if (modal) modal.classList.add("hidden");
    }

    function handleDeleteContentModalClick(event) {
        if (event.target && event.target.id === "delete-content-modal") {
            closeDeleteContentModal();
        }
    }

    function confirmDeleteCurrentContent() {
        closeDeleteContentModal();
        removeCurrentContent();
    }

    function removeCurrentContent() {
        const day = getCurrentDayState();
        if (!day || !Array.isArray(day.contents) || day.contents.length === 0) return;
        const idx = day.contents.findIndex((content) => content.id === day.selectedContentId);
        const removeIdx = idx >= 0 ? idx : 0;
        day.contents.splice(removeIdx, 1);
        day.selectedContentId = day.contents.length > 0
            ? day.contents[Math.max(0, removeIdx - 1)].id
            : "";
        renderEditorContent();
        renderCalendar();
        queueSaveLabel(true);
    }

    function getDayStateForMove(dateKey) {
        const key = resolveDateKey(dateKey);
        if (!key) return null;
        if (!appState.days[key]) {
            appState.days[key] = {
                selectedContentId: "",
                contents: []
            };
        } else {
            appState.days[key] = normalizeDayState(appState.days[key], key);
        }
        return appState.days[key];
    }

    function moveCurrentContentToDate() {
        const sourceKey = resolveDateKey(currentDateKey);
        const input = document.getElementById("move-content-date");
        const targetKey = resolveDateKey(input && input.value);
        if (!sourceKey || !targetKey) return;
        if (sourceKey === targetKey) {
            flashSaveState("Already on this day");
            return;
        }

        const sourceDay = getCurrentDayState();
        const content = getCurrentContent(sourceDay);
        if (!sourceDay || !content) return;

        const sourceIdx = sourceDay.contents.findIndex((item) => item.id === content.id);
        if (sourceIdx < 0) return;

        const movedContent = sourceDay.contents.splice(sourceIdx, 1)[0];
        if (sourceDay.contents.length > 0) {
            sourceDay.selectedContentId = sourceDay.contents[Math.max(0, sourceIdx - 1)].id;
        } else {
            sourceDay.selectedContentId = "";
        }

        const targetDay = getDayStateForMove(targetKey);
        targetDay.contents.push(movedContent);
        targetDay.selectedContentId = movedContent.id;
        currentDateKey = targetKey;
        viewedMonth = new Date(parseDateKey(targetKey).getFullYear(), parseDateKey(targetKey).getMonth(), 1);
        pendingEditNotification = buildMovePayload(sourceKey, targetKey, movedContent);

        renderEditorContent();
        renderCalendar();
        persistState(true);
    }

    function renderPlatformControls() {
        const content = getCurrentContent();
        const platformGrid = document.getElementById("platform-grid");
        if (!platformGrid) return;

        platformGrid.innerHTML = "";
        if (!content) return;

        PLATFORMS.forEach((platform) => {
            const label = document.createElement("label");
            label.className = "platform-item";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = content.platforms.includes(platform);
            input.onchange = () => togglePlatform(platform, input.checked);

            const span = document.createElement("span");
            span.className = "platform-name";
            span.textContent = platform;

            label.appendChild(input);
            label.appendChild(span);
            platformGrid.appendChild(label);
        });
    }

    function togglePlatform(platform, checked) {
        const content = ensureCurrentContent(true);
        if (!content) return;
        if (checked) {
            if (!content.platforms.includes(platform)) {
                content.platforms.push(platform);
            }
        } else {
            content.platforms = content.platforms.filter((item) => item !== platform);
        }
        queueSaveLabel(true);
    }

    function renderShots() {
        const container = document.getElementById("storyboard-container");
        const content = getCurrentContent();
        container.innerHTML = "";
        if (!content) return;
        if (normalizeContentType(content.type) !== "Video") return;

        content.shots.forEach((shot, index) => {
            const html = `
                <div class="shot-card">
                    <button type="button" class="delete-btn" onclick="removeShot(${index})">ลบ</button>
                    <div class="content-box">
                        <p class="shot-title" contenteditable="true" onfocus="beginQuickEdit(this)" oninput="updateShotField(${index}, 'title', this.innerText)">${escapeHtml(shot.title)}</p>
                        <div>
                            <strong>🎬 บทพูด:</strong>
                            <div class="script-area" contenteditable="true" onfocus="beginQuickEdit(this)" oninput="updateShotField(${index}, 'speech', this.innerText)">${escapeHtml(shot.speech)}</div>
                        </div>
                        <div>
                            <strong>📝 Text บนจอ:</strong>
                            <div class="script-area" contenteditable="true" onfocus="beginQuickEdit(this)" oninput="updateShotField(${index}, 'onScreen', this.innerText)">${escapeHtml(shot.onScreen)}</div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", html);
        });
    }

    function setBulkShotState(message, isError) {
        const el = document.getElementById("bulk-shot-state");
        if (!el) return;
        if (!message) {
            el.textContent = "";
            el.classList.add("hidden");
            el.classList.remove("err");
            return;
        }
        el.textContent = message;
        el.classList.remove("hidden");
        el.classList.toggle("err", !!isError);
    }

    function toggleBulkShotImport() {
        const input = document.getElementById("bulk-shot-input");
        if (!input) return;
        input.classList.toggle("hidden");
        if (!input.classList.contains("hidden")) {
            input.focus();
        }
    }

    function stripWrappedQuotes(text) {
        return String(text || "").trim().replace(/^["“”']+|["“”']+$/g, "").trim();
    }

    function cleanShotValue(text) {
        return stripWrappedQuotes(String(text || "").replace(/\s+/g, " "));
    }

    function appendShotField(shot, field, value) {
        const clean = cleanShotValue(value);
        if (!clean) return;
        shot[field] = shot[field] && !isTemplateEditableText(shot[field])
            ? shot[field] + " " + clean
            : clean;
    }

    function parseBulkShots(rawText) {
        const lines = String(rawText || "").replace(/\r\n/g, "\n").split("\n");
        const result = {
            headline: "",
            shots: []
        };
        let current = null;
        let activeField = "";

        function pushCurrent() {
            if (!current) return;
            current.title = cleanShotValue(current.title) || "Shot " + (result.shots.length + 1) + ": ...";
            current.speech = cleanShotValue(current.speech) || "พิมพ์บทพูดที่นี่...";
            current.onScreen = cleanShotValue(current.onScreen) || "ข้อความบนจอ...";
            result.shots.push(current);
        }

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            const shotMatch = trimmed.match(/^Shot\s*(\d+)\s*(.*)$/i);
            if (shotMatch) {
                pushCurrent();
                const shotNumber = Number(shotMatch[1]) || (result.shots.length + 1);
                const shotDetail = cleanShotValue(shotMatch[2].replace(/^\(|\)$/g, ""));
                current = {
                    title: "Shot " + shotNumber + (shotDetail ? ": " + shotDetail : ": ..."),
                    speech: "",
                    onScreen: ""
                };
                activeField = "";
                return;
            }

            if (!current && !result.headline) {
                result.headline = cleanShotValue(trimmed.replace(/^บทพูด\s*/i, ""));
                return;
            }

            if (!current) return;

            const imageMatch = trimmed.match(/^ภาพ\s*:\s*(.*)$/i);
            if (imageMatch) {
                const imageText = cleanShotValue(imageMatch[1]);
                if (imageText) {
                    current.title = current.title && !/:\s*\.\.\.$/.test(current.title)
                        ? current.title + " | ภาพ: " + imageText
                        : "Shot " + (result.shots.length + 1) + ": " + imageText;
                }
                activeField = "title";
                return;
            }

            const speechMatch = trimmed.match(/^บทพูด\s*:\s*(.*)$/i);
            if (speechMatch) {
                appendShotField(current, "speech", speechMatch[1]);
                activeField = "speech";
                return;
            }

            const screenMatch = trimmed.match(/^Text\s*บนจอ\s*:\s*(.*)$/i);
            if (screenMatch) {
                appendShotField(current, "onScreen", screenMatch[1]);
                activeField = "onScreen";
                return;
            }

            if (activeField === "speech" || activeField === "onScreen") {
                appendShotField(current, activeField, trimmed);
            }
        });

        pushCurrent();
        return result;
    }

    function importBulkShots() {
        const input = document.getElementById("bulk-shot-input");
        if (!input) return;
        const content = ensureCurrentContent(true);
        if (!content || normalizeContentType(content.type) !== "Video") {
            setBulkShotState("Import ใช้ได้เฉพาะ Video เท่านั้น", true);
            return;
        }
        const parsed = parseBulkShots(input.value);
        if (!parsed.shots.length) {
            setBulkShotState("ไม่เจอรูปแบบ Shot ในข้อความที่วาง", true);
            return;
        }
        content.shots = parsed.shots;
        if (parsed.headline && (!normalizeEditableText(content.headline) || isTemplateEditableText(normalizeEditableText(content.headline)))) {
            content.headline = parsed.headline;
        }
        renderEditorContent();
        renderCalendar();
        input.value = "";
        input.classList.add("hidden");
        setBulkShotState("Import แล้ว " + parsed.shots.length + " shots", false);
        queueSaveLabel(true);
    }

    function renderCover() {
        const content = getCurrentContent();
        const uploadText = document.getElementById("cover-upload-text");
        const removeBtn = document.getElementById("cover-remove-btn");
        const gallery = document.getElementById("cover-gallery");
        if (!content) {
            if (uploadText) uploadText.classList.remove("hidden");
            if (removeBtn) removeBtn.classList.add("hidden");
            if (gallery) {
                gallery.innerHTML = `<p class="cover-empty-note">No image resources uploaded yet.</p>`;
            }
            return;
        }

        const images = Array.isArray(content.coverImages) ? content.coverImages : [];
        if (images.length > 0) {
            uploadText.classList.add("hidden");
            removeBtn.classList.remove("hidden");
        } else {
            uploadText.classList.remove("hidden");
            removeBtn.classList.add("hidden");
        }

        if (!gallery) return;
        gallery.innerHTML = "";
        if (images.length === 0) {
            gallery.innerHTML = `<p class="cover-empty-note">No image resources uploaded yet.</p>`;
            return;
        }

        images.forEach((imageSrc, index) => {
            const card = document.createElement("div");
            card.className = "cover-thumb";
            card.innerHTML = `
                <img src="${escapeHtml(imageSrc)}" alt="Resource image ${index + 1}" onclick="openImagePreviewFromElement(this)">
                <button type="button" onclick="removeCoverImage(${index})">Remove Image ${index + 1}</button>
            `;
            gallery.appendChild(card);
        });
    }

    function renderDayMetaControls() {
        const content = getCurrentContent();
        const statusSelect = document.getElementById("day-status-select");
        const prioritySelect = document.getElementById("day-priority-select");
        if (!statusSelect || !prioritySelect) return;
        if (!content) {
            statusSelect.value = "Draft";
            prioritySelect.value = "Priority";
            return;
        }
        statusSelect.value = content.status || "Draft";
        prioritySelect.value = content.priority || "Priority";
    }

    function renderEditorContent() {
        const day = getCurrentDayState();
        const content = getCurrentContent(day);
        if (!content) {
            renderContentSelector();
            const titleField = document.getElementById("current-day-title");
            const descField = document.getElementById("current-day-desc");
            const bottomDetailField = document.getElementById("non-video-detail-field");
            if (titleField) titleField.innerText = "No content yet";
            if (descField) descField.innerText = "Click Add Content to start";
            if (bottomDetailField) bottomDetailField.innerText = "Click Add Content to start";
            renderContentTypeControl();
            renderDayMetaControls();
            renderPlatformControls();
            renderCover();
            renderShots();
            return;
        }
        document.getElementById("current-day-title").innerText = content.headline;
        document.getElementById("current-day-title").innerText = content.headline || "Type headline here";
        document.getElementById("current-day-desc").innerText = content.description || "Type detail here";
        const bottomDetailField = document.getElementById("non-video-detail-field");
        if (bottomDetailField) {
            bottomDetailField.innerText = content.description || "Type detail here";
        }
        renderContentSelector();
        renderContentTypeControl();
        renderMoveDateControl();
        applyContentTypeUI(content);
        renderDayMetaControls();
        renderPlatformControls();
        renderCover();
        renderShots();
    }

    function renderContentCardsModal() {
        const day = getCurrentDayState();
        if (!day) return;
        const list = document.getElementById("content-cards-list");
        const title = document.getElementById("content-cards-title");
        const sub = document.getElementById("content-cards-sub");
        const dateLabel = formatContentDate(parseDateKey(currentDateKey));

        title.innerText = dateLabel + " Contents";
        sub.innerText = day.contents.length + (day.contents.length > 1 ? " cards" : " card");
        list.innerHTML = "";

        day.contents.forEach((content, idx) => {
            const safeType = normalizeContentType(content.type);
            const card = document.createElement("button");
            card.type = "button";
            card.className = "content-card-btn";
            card.onclick = () => openContentFlow(content.id);
            card.innerHTML = `
                <h4 class="content-card-title">${idx + 1}. ${escapeHtml(content.headline || "Untitled Content")}</h4>
                <div class="read-shot-badges" style="margin-bottom: 0.4rem;">
                    <span class="mini-badge">${escapeHtml(safeType)}</span>
                    <span class="mini-badge">${escapeHtml(content.status || "Draft")}</span>
                    <span class="mini-badge">${escapeHtml(content.priority || "Priority")}</span>
                </div>
                <p class="content-card-desc">${escapeHtml(content.description || "-")}</p>
            `;
            list.appendChild(card);
        });
    }

    function openContentCardsModal(dateKey) {
        const resolved = resolveDateKey(dateKey);
        if (!resolved) return;
        currentDateKey = resolved;
        getCurrentDayState();
        renderContentCardsModal();
        document.getElementById("content-cards-modal").classList.remove("hidden");
    }

    function closeContentCardsModal() {
        document.getElementById("content-cards-modal").classList.add("hidden");
    }

    function handleContentCardsModalClick(event) {
        if (event.target && event.target.id === "content-cards-modal") {
            closeContentCardsModal();
        }
    }

    function openImagePreviewFromElement(element) {
        if (!element || !element.src) return;
        openImagePreviewModal(element.src);
    }

    function openImagePreviewModal(src) {
        const modal = document.getElementById("image-preview-modal");
        const image = document.getElementById("image-preview-full");
        if (!modal || !image || !src) return;
        image.src = src;
        modal.classList.remove("hidden");
    }

    function closeImagePreviewModal() {
        const modal = document.getElementById("image-preview-modal");
        const image = document.getElementById("image-preview-full");
        if (!modal || !image) return;
        modal.classList.add("hidden");
        image.src = "";
    }

    function handleImagePreviewModalClick(event) {
        if (event.target && event.target.id === "image-preview-modal") {
            closeImagePreviewModal();
        }
    }

    function copyTextFallback(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(textarea);
        }
    }

    async function copyReadText(button) {
        if (!button) return;
        const text = button.dataset.copy || "";
        const originalText = button.innerHTML;
        const originalLabel = button.getAttribute("aria-label") || "Copy";
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                copyTextFallback(text);
            }
            button.innerHTML = "✓";
            button.setAttribute("aria-label", "Copied");
            button.classList.add("copied");
            window.setTimeout(() => {
                button.innerHTML = originalText || "⧉";
                button.setAttribute("aria-label", originalLabel);
                button.classList.remove("copied");
            }, 900);
        } catch (error) {
            button.innerHTML = "!";
            button.setAttribute("aria-label", "Copy failed");
            window.setTimeout(() => {
                button.innerHTML = originalText || "⧉";
                button.setAttribute("aria-label", originalLabel);
            }, 900);
        }
    }

    function openContentFlow(contentId) {
        const day = getCurrentDayState();
        if (!day) return;
        const content = day.contents.find((item) => item.id === contentId);
        if (!content) return;
        const safeType = normalizeContentType(content.type);
        const typeMeta = getTypeMeta(safeType);

        const flowTitle = document.getElementById("content-flow-title");
        const flowSub = document.getElementById("content-flow-sub");
        const flowBody = document.getElementById("content-flow-body");
        flowTitle.innerText = content.headline || "Content Detail";
        flowSub.innerText = formatContentDate(parseDateKey(currentDateKey));

        const platformBadges = (content.platforms || [])
            .map((platform) => `<span class="mini-badge">${escapeHtml(platform)}</span>`)
            .join("");
        const coverImages = Array.isArray(content.coverImages) ? content.coverImages : [];
        const coverHtml = coverImages.length > 0
            ? `<div class="content-cover-grid">${coverImages.map((imageSrc, index) => (
                `<img class="content-cover-preview clickable" src="${escapeHtml(imageSrc)}" alt="Content resource ${index + 1}" onclick="openImagePreviewFromElement(this)">`
            )).join("")}</div>`
            : "";
        const shotsHtml = (Array.isArray(content.shots) ? content.shots : []).map((shot) => {
            const speech = escapeHtml(shot.speech || "").replaceAll("\n", "<br>");
            const onScreen = escapeHtml(shot.onScreen || "").replaceAll("\n", "<br>");
            const speechCopy = escapeHtml(shot.speech || "");
            const onScreenCopy = escapeHtml(shot.onScreen || "");
            return `
                <div class="read-shot-card">
                    <div class="read-shot-head">
                        <h3 class="read-shot-title">${escapeHtml(shot.title || "Shot")}</h3>
                    </div>
                    <div class="read-row">
                        <div class="read-row-head">
                            <strong>🎬 บทพูด</strong>
                        </div>
                        <div class="read-copy-field">
                            <p>${speech || "-"}</p>
                            <button type="button" class="copy-read-btn" data-copy="${speechCopy}" onclick="copyReadText(this)" aria-label="Copy บทพูด" title="Copy บทพูด">⧉</button>
                        </div>
                    </div>
                    <div class="read-row">
                        <div class="read-row-head">
                            <strong>📝 Text บนจอ</strong>
                        </div>
                        <div class="read-copy-field">
                            <p>${onScreen || "-"}</p>
                            <button type="button" class="copy-read-btn" data-copy="${onScreenCopy}" onclick="copyReadText(this)" aria-label="Copy Text บนจอ" title="Copy Text บนจอ">⧉</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
        const descriptionText = escapeHtml(content.description || "-").replaceAll("\n", "<br>");
        const detailLabel = safeType === "Post Text" ? "Post Content" : "Description";
        const emptyCoverHtml = typeMeta.showCover ? `<p class="read-empty-note">No image resources</p>` : "";
        const detailByType = safeType === "Video"
            ? (coverHtml || emptyCoverHtml) + shotsHtml
            : (safeType === "Post Image"
                ? (coverHtml || emptyCoverHtml)
                : "");

        flowBody.innerHTML = `
            <div class="read-content-card">
                <div class="read-row">
                    <strong>${detailLabel}</strong>
                    <p>${descriptionText}</p>
                </div>
                <div class="read-shot-head">
                    <div class="read-shot-badges">
                        <span class="mini-badge">${escapeHtml(safeType)}</span>
                        <span class="mini-badge">${escapeHtml(content.status || "Draft")}</span>
                        <span class="mini-badge">${escapeHtml(content.priority || "Priority")}</span>
                        ${platformBadges}
                    </div>
                </div>
                ${detailByType}
            </div>
        `;

        closeContentCardsModal();
        document.getElementById("content-flow-modal").classList.remove("hidden");
    }

    function closeContentFlowModal() {
        document.getElementById("content-flow-modal").classList.add("hidden");
        closeImagePreviewModal();
    }

    function backToContentCards() {
        closeContentFlowModal();
        document.getElementById("content-cards-modal").classList.remove("hidden");
    }

    function handleContentFlowModalClick(event) {
        if (event.target && event.target.id === "content-flow-modal") {
            closeContentFlowModal();
        }
    }

    function openDayAction(dateKey) {
        actionDateKey = resolveDateKey(dateKey);
        if (!actionDateKey) return;
        const item = isTeamBContext() ? null : contentByDate.get(actionDateKey);
        const dateText = formatContentDate(parseDateKey(actionDateKey));
        const dayData = appState.days[actionDateKey] ? normalizeDayState(appState.days[actionDateKey], actionDateKey) : null;
        const existingHeadline = dayData && dayData.contents && dayData.contents[0]
            ? dayData.contents[0].headline
            : "";
        const title = item ? item.title : (existingHeadline || "Open this date");
        const prefix = item ? ("Day " + item.dayNum + " • ") : "";
        document.getElementById("action-day-title").innerText = prefix + dateText + ": " + title;
        document.getElementById("day-action-modal").classList.remove("hidden");
    }

    function closeDayAction() {
        actionDateKey = null;
        document.getElementById("day-action-modal").classList.add("hidden");
    }

    function handleActionModalClick(event) {
        if (event.target && event.target.id === "day-action-modal") {
            closeDayAction();
        }
    }

    function openEditFromAction() {
        const dateKey = resolveDateKey(actionDateKey);
        closeDayAction();
        if (!dateKey) return;
        showStoryboard(dateKey);
    }

    function openViewFromAction() {
        const dateKey = resolveDateKey(actionDateKey);
        closeDayAction();
        if (!dateKey) return;
        showContent(dateKey);
    }

    function showStoryboard(dateKey) {
        const resolved = resolveDateKey(dateKey);
        if (!resolved) return;
        currentDateKey = resolved;
        getCurrentDayState();
        document.getElementById("calendar-view").classList.add("hidden");
        document.getElementById("social-inbox-view").classList.add("hidden");
        document.getElementById("storyboard-view").classList.remove("hidden");
        document.getElementById("save-state").textContent = "พร้อมแก้ไข";
        closeContentCardsModal();
        closeContentFlowModal();
        renderEditorContent();
        window.scrollTo(0, 0);
    }

    function showContent(dateKey) {
        openContentCardsModal(dateKey);
    }

    function showCalendar() {
        currentDateKey = null;
        closeDayAction();
        closeContentCardsModal();
        closeContentFlowModal();
        document.getElementById("storyboard-view").classList.add("hidden");
        document.getElementById("social-inbox-view").classList.add("hidden");
        document.getElementById("calendar-view").classList.remove("hidden");
        renderCalendar();
        window.scrollTo(0, 0);
    }

    function showSocialInbox() {
        if (!isTeamAActive()) {
            showCalendar();
            return;
        }
        currentDateKey = null;
        closeDayAction();
        closeContentCardsModal();
        closeContentFlowModal();
        document.getElementById("calendar-view").classList.add("hidden");
        document.getElementById("storyboard-view").classList.add("hidden");
        document.getElementById("social-inbox-view").classList.remove("hidden");
        renderSocialInbox();
        loadSocialInbox();
        window.scrollTo(0, 0);
    }

    function updateDayField(field, value) {
        const content = ensureCurrentContent(true);
        if (!content) return;
        content[field] = value;
        renderContentSelector();
        queueSaveLabel(true);
    }

    function updateDayMeta(field, value) {
        const content = ensureCurrentContent(true);
        if (!content) return;
        content[field] = value;
        renderCalendar();
        queueSaveLabel(true);
    }

    function updateContentType(value) {
        const content = ensureCurrentContent(true);
        if (!content) return;
        const nextType = normalizeContentType(value);
        const prevType = normalizeContentType(content.type);
        if (nextType === prevType) return;

        content.type = nextType;
        const normalizedDescription = normalizeEditableText(content.description);
        if (!normalizedDescription || isTemplateEditableText(normalizedDescription)) {
            content.description = defaultDescriptionForType(nextType);
        }

        renderEditorContent();
        renderCalendar();
        queueSaveLabel(true);
    }

    function updateShotField(index, field, value) {
        const content = ensureCurrentContent(true);
        if (!content || normalizeContentType(content.type) !== "Video" || !content.shots[index]) return;
        content.shots[index][field] = value;
        queueSaveLabel(true);
    }

    function addShot() {
        const content = ensureCurrentContent(true);
        if (!content || normalizeContentType(content.type) !== "Video") return;
        content.shots.push(defaultShot(content.shots.length + 1));
        renderEditorContent();
        renderShots();
        queueSaveLabel(true);
    }

    function removeShot(index) {
        const content = getCurrentContent();
        if (!content || normalizeContentType(content.type) !== "Video" || content.shots.length <= 1) {
            return;
        }
        content.shots.splice(index, 1);
        renderShots();
        queueSaveLabel(true);
    }

    function handleCoverUpload(input) {
        if (!input.files || !input.files[0]) {
            return;
        }
        const content = ensureCurrentContent(true);
        if (!content || !getTypeMeta(content.type).showCover) {
            input.value = "";
            return;
        }
        const el = document.getElementById("save-state");
        if (el) {
            el.textContent = "Uploading images...";
            el.classList.remove("ok");
        }
        const formData = new FormData();
        Array.from(input.files).forEach((file) => {
            formData.append("images", file);
        });
        apiFetch("/api/upload-images", {
            method: "POST",
            body: formData
        }, 15000).then(async (response) => {
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            return response.json();
        }).then((payload) => {
            const current = getCurrentContent();
            if (!current || !getTypeMeta(current.type).showCover) return;
            const urls = Array.isArray(payload && payload.images)
                ? payload.images.map((item) => item && item.url).filter(Boolean)
                : [];
            current.coverImages = (Array.isArray(current.coverImages) ? current.coverImages : []).concat(urls);
            current.coverImage = current.coverImages[0] || "";
            renderCover();
            queueSaveLabel(true);
        }).catch(() => {
            if (el) {
                el.textContent = "Upload failed";
                el.classList.remove("ok");
            }
        }).finally(() => {
            input.value = "";
        });
    }

    function removeCoverImage(index) {
        const content = getCurrentContent();
        if (!content || !Array.isArray(content.coverImages) || !content.coverImages[index]) return;
        content.coverImages.splice(index, 1);
        content.coverImage = content.coverImages[0] || "";
        renderCover();
        queueSaveLabel(true);
    }

    function clearCoverImage() {
        const content = getCurrentContent();
        if (!content) return;
        content.coverImages = [];
        content.coverImage = "";
        renderCover();
        queueSaveLabel(true);
    }

    async function saveCurrentDay() {
        markPendingEditNotification("saved");
        await persistState(true);
        renderCalendar();
    }

    function resetCurrentDay() {
        if (!currentDateKey) return;
        const key = String(currentDateKey);
        appState.days[key] = defaultDay(key);
        renderEditorContent();
        renderCalendar();
        queueSaveLabel(true);
    }

    async function bootstrapAuthorizedTeam() {
        appState = shouldImportLocalBackup() ? loadLocalState() : { days: {} };
        renderCalendar();
        showAppShell();
        try {
            appState = await loadState();
            renderCalendar();
        } catch (error) {
            if (error && error.code === "UNAUTHORIZED") {
                logoutTeam("Your session expired. Enter the team password again.");
                return;
            }
            renderCalendar();
        }
    }

    async function submitTeamAccess() {
        const passwordInput = document.getElementById("team-password");
        const submitButton = document.getElementById("auth-submit");
        const teamKey = TEAM_A_KEY;
        const password = passwordInput ? passwordInput.value : "";

        setAuthError("");
        if (!password.trim()) {
            setAuthError("Enter the TEAM A password.");
            if (passwordInput) passwordInput.focus();
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Checking...";
        }

        try {
            const response = await fetchWithTimeout("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    team: teamKey,
                    password
                })
            }, 8000);
            const payload = await response.json();
            if (!response.ok || !payload || !payload.ok || !payload.token || !payload.team) {
                throw new Error(payload && payload.error ? payload.error : "Login failed");
            }
            authToken = payload.token;
            setActiveTeam(payload.team.key, payload.team.label);
            saveAuthSession();
            if (passwordInput) {
                passwordInput.value = "";
            }
            await bootstrapAuthorizedTeam();
        } catch (error) {
            setAuthError(error && error.message ? error.message : "Login failed");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Enter Calendar";
            }
        }
    }

    function logoutTeam(message) {
        clearAuthSession();
        appState = { days: {} };
        currentDateKey = null;
        actionDateKey = null;
        pendingEditNotification = null;
        closeAllModals();
        document.getElementById("storyboard-view").classList.add("hidden");
        document.getElementById("social-inbox-view").classList.add("hidden");
        document.getElementById("calendar-view").classList.remove("hidden");
        showAuthGate();
        const passwordInput = document.getElementById("team-password");
        if (passwordInput) {
            passwordInput.value = "";
        }
        updateTeamSelectionUI();
        setAuthError(message || "");
    }

    window.onload = function() {
        initTheme();
        setTelegramState("");
        const passwordInput = document.getElementById("team-password");
        if (passwordInput) {
            passwordInput.addEventListener("keydown", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submitTeamAccess();
                }
            });
        }
        const savedAuth = loadAuthSession();
        if (!savedAuth) {
            showAuthGate();
            return;
        }
        authToken = savedAuth.token;
        setActiveTeam(savedAuth.teamKey, savedAuth.teamLabel);
        bootstrapAuthorizedTeam();
    };
