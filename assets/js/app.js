    const STORAGE_KEY = "content_calendar_v1";
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

    let appState = loadState();
    let currentDateKey = null;
    let actionDateKey = null;
    let viewedMonth = new Date(CONTENT_START_DATE.getFullYear(), CONTENT_START_DATE.getMonth(), 1);
    let saveTimer = null;

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

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return { days: {} };
            }
            const parsed = JSON.parse(raw);
            if (!parsed.days || typeof parsed.days !== "object") {
                return { days: {} };
            }
            const migratedDays = {};
            Object.entries(parsed.days).forEach(([key, value]) => {
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
        } catch (e) {
            return { days: {} };
        }
    }

    function persistState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        flashSaveState("บันทึกแล้ว");
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

    function queueSaveLabel() {
        const el = document.getElementById("save-state");
        if (!el) return;
        el.textContent = "มีการแก้ไข ยังไม่ Save";
        el.classList.remove("ok");
        if (saveTimer) {
            window.clearTimeout(saveTimer);
        }
        saveTimer = window.setTimeout(() => {
            persistState();
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
        content.coverImage = typeof content.coverImage === "string" ? content.coverImage : "";

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
                contents.push(defaultContent(dateKey, 1));
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

    function dayStatusLabel(dayData) {
        if (!dayData || !Array.isArray(dayData.contents) || dayData.contents.length === 0) return "";
        const statuses = dayData.contents.map((content) => content.status || "Draft");
        if (statuses.every((status) => status === "Done")) return "Done";
        if (statuses.some((status) => status === "Ready" || status === "Done")) return "In Progress";
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
            const contentItem = contentByDate.get(dateKey);
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
                : (contentItem ? ("Day " + contentItem.dayNum) : "");
            const tagHtml = tagText ? `<div class="content-day-tag">${escapeHtml(tagText)}</div>` : "";

            let titleText = "Add content...";
            if (contentCount > 0) {
                titleText = dayData.contents[0].headline || titleText;
            } else if (contentItem) {
                titleText = contentItem.title;
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

    function applyContentTypeUI(content) {
        const safeType = normalizeContentType(content && content.type);
        const meta = getTypeMeta(safeType);
        const descriptionLabel = document.getElementById("current-day-desc-label");
        const coverSection = document.getElementById("cover-section");
        const videoSection = document.getElementById("video-section");

        if (descriptionLabel) {
            descriptionLabel.innerText = meta.label;
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
        queueSaveLabel();
    }

    function addContentItem() {
        const day = getCurrentDayState();
        if (!day) return;
        const newContent = defaultContent(currentDateKey, day.contents.length + 1);
        day.contents.push(newContent);
        day.selectedContentId = newContent.id;
        renderEditorContent();
        renderCalendar();
        queueSaveLabel();
    }

    function removeCurrentContent() {
        const day = getCurrentDayState();
        if (!day || day.contents.length <= 1) return;
        const idx = day.contents.findIndex((content) => content.id === day.selectedContentId);
        const removeIdx = idx >= 0 ? idx : 0;
        day.contents.splice(removeIdx, 1);
        day.selectedContentId = day.contents[Math.max(0, removeIdx - 1)].id;
        renderEditorContent();
        renderCalendar();
        queueSaveLabel();
    }

    function renderPlatformControls() {
        const content = getCurrentContent();
        const platformGrid = document.getElementById("platform-grid");
        if (!platformGrid || !content) return;

        platformGrid.innerHTML = "";
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
        const content = getCurrentContent();
        if (!content) return;
        if (checked) {
            if (!content.platforms.includes(platform)) {
                content.platforms.push(platform);
            }
        } else {
            content.platforms = content.platforms.filter((item) => item !== platform);
        }
        queueSaveLabel();
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

    function renderCover() {
        const content = getCurrentContent();
        const preview = document.getElementById("cover-preview");
        const uploadText = document.getElementById("cover-upload-text");
        const removeBtn = document.getElementById("cover-remove-btn");
        if (!content) return;

        if (content.coverImage) {
            preview.src = content.coverImage;
            preview.classList.add("has-image");
            uploadText.classList.add("hidden");
            removeBtn.classList.remove("hidden");
        } else {
            preview.src = "";
            preview.classList.remove("has-image");
            uploadText.classList.remove("hidden");
            removeBtn.classList.add("hidden");
        }
    }

    function renderDayMetaControls() {
        const content = getCurrentContent();
        const statusSelect = document.getElementById("day-status-select");
        const prioritySelect = document.getElementById("day-priority-select");
        if (!statusSelect || !prioritySelect || !content) return;
        statusSelect.value = content.status || "Draft";
        prioritySelect.value = content.priority || "Priority";
    }

    function renderEditorContent() {
        const day = getCurrentDayState();
        const content = getCurrentContent(day);
        if (!content) return;
        document.getElementById("current-day-title").innerText = content.headline;
        document.getElementById("current-day-desc").innerText = content.description;
        renderContentSelector();
        renderContentTypeControl();
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
        const coverHtml = content.coverImage
            ? `<img class="content-cover-preview" src="${escapeHtml(content.coverImage)}" alt="Content cover">`
            : "";
        const shotsHtml = (Array.isArray(content.shots) ? content.shots : []).map((shot) => {
            const speech = escapeHtml(shot.speech || "").replaceAll("\n", "<br>");
            const onScreen = escapeHtml(shot.onScreen || "").replaceAll("\n", "<br>");
            return `
                <div class="read-shot-card">
                    <div class="read-shot-head">
                        <h3 class="read-shot-title">${escapeHtml(shot.title || "Shot")}</h3>
                    </div>
                    <div class="read-row">
                        <strong>🎬 บทพูด</strong>
                        <p>${speech || "-"}</p>
                    </div>
                    <div class="read-row">
                        <strong>📝 Text บนจอ</strong>
                        <p>${onScreen || "-"}</p>
                    </div>
                </div>
            `;
        }).join("");
        const descriptionText = escapeHtml(content.description || "-").replaceAll("\n", "<br>");
        const detailLabel = safeType === "Post Text" ? "Post Content" : "Description";
        const emptyCoverHtml = typeMeta.showCover ? `<p class="read-empty-note">No cover image</p>` : "";
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
        const item = contentByDate.get(actionDateKey);
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
        document.getElementById("calendar-view").classList.remove("hidden");
        renderCalendar();
        window.scrollTo(0, 0);
    }

    function updateDayField(field, value) {
        const content = getCurrentContent();
        if (!content) return;
        content[field] = value;
        renderContentSelector();
        queueSaveLabel();
    }

    function updateDayMeta(field, value) {
        const content = getCurrentContent();
        if (!content) return;
        content[field] = value;
        renderCalendar();
        queueSaveLabel();
    }

    function updateContentType(value) {
        const content = getCurrentContent();
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
        queueSaveLabel();
    }

    function updateShotField(index, field, value) {
        const content = getCurrentContent();
        if (!content || normalizeContentType(content.type) !== "Video" || !content.shots[index]) return;
        content.shots[index][field] = value;
        queueSaveLabel();
    }

    function addShot() {
        const content = getCurrentContent();
        if (!content || normalizeContentType(content.type) !== "Video") return;
        content.shots.push(defaultShot(content.shots.length + 1));
        renderShots();
        queueSaveLabel();
    }

    function removeShot(index) {
        const content = getCurrentContent();
        if (!content || normalizeContentType(content.type) !== "Video" || content.shots.length <= 1) {
            return;
        }
        content.shots.splice(index, 1);
        renderShots();
        queueSaveLabel();
    }

    function handleCoverUpload(input) {
        if (!input.files || !input.files[0]) {
            return;
        }
        const content = getCurrentContent();
        if (!content || !getTypeMeta(content.type).showCover) {
            input.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = getCurrentContent();
            if (!content || !getTypeMeta(content.type).showCover) return;
            content.coverImage = e.target.result;
            renderCover();
            queueSaveLabel();
        };
        reader.readAsDataURL(input.files[0]);
    }

    function clearCoverImage() {
        const content = getCurrentContent();
        if (!content) return;
        content.coverImage = "";
        renderCover();
        queueSaveLabel();
    }

    function saveCurrentDay() {
        persistState();
        renderCalendar();
    }

    function resetCurrentDay() {
        if (!currentDateKey) return;
        const key = String(currentDateKey);
        appState.days[key] = defaultDay(key);
        renderEditorContent();
        renderCalendar();
        queueSaveLabel();
    }

    window.onload = function() {
        renderCalendar();
    };
