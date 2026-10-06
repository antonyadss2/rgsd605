/**
 * ARIA PRODUCTIVITY PRO — CORE ENGINE (Vanilla JS, buildless)
 * Tab 1: Ghi chú ID  |  Tab 2: Hẹn giờ  |  Tab 3: Chat AI Kép (Claude + ChatGPT)
 *
 * Tab 3 gọi thẳng API Anthropic và OpenAI bằng chính API key của người dùng.
 * Trong extension MV3 (có host_permissions) các request không bị chặn CORS.
 */

/* ============================================================
 * 1) ĐIỀU HƯỚNG TAB
 * ========================================================== */
function initTabs() {
    const tabManager = document.getElementById('tabManager');
    if (!tabManager) return;

    tabManager.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.tab-item');
        if (!tabBtn) return;

        const paneId = tabBtn.getAttribute('data-pane');
        if (!paneId) return;

        document.querySelectorAll('.tab-item').forEach((t) => t.classList.remove('active'));
        tabBtn.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
        const activePane = document.getElementById(paneId);
        if (activePane) activePane.classList.add('active');
    });
}

/* ============================================================
 * 2) GHI CHÚ ID (lưu tự động vào chrome.storage)
 * ========================================================== */
function initStorage() {
    const idStorage = document.getElementById('idStorage');
    const notesStatus = document.getElementById('notesStatus');
    if (!idStorage) return;

    chrome.storage.local.get(['saved_ids'], (res) => {
        if (res.saved_ids) idStorage.value = res.saved_ids;
    });

    idStorage.addEventListener('input', () => {
        chrome.storage.local.set({ saved_ids: idStorage.value }, () => {
            if (notesStatus) notesStatus.innerText = 'Đã lưu tự động: ' + new Date().toLocaleTimeString();
        });
    });
}

/* ============================================================
 * 3) HẸN GIỜ (chrome.alarms + offscreen audio)
 * ========================================================== */
function initTimer() {
    const timerBigDisplay = document.getElementById('timerBigDisplay');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const mInput = document.getElementById('mInput');
    const sInput = document.getElementById('sInput');
    const timerStatus = document.getElementById('timerStatus');

    let mainTicker = null;

    const runTimerUI = (targetTime) => {
        if (mainTicker) clearInterval(mainTicker);
        if (startBtn) startBtn.disabled = true;

        const tick = () => {
            const remain = targetTime - Date.now();
            if (remain <= 0) {
                clearInterval(mainTicker);
                if (timerBigDisplay) {
                    timerBigDisplay.innerText = 'HẾT GIỜ!';
                    timerBigDisplay.classList.add('pulse');
                }
                if (timerStatus) timerStatus.innerText = '🔔 Đang phát báo động âm thanh...';
                if (startBtn) startBtn.disabled = false;
                return;
            }
            const totalSec = Math.ceil(remain / 1000);
            const mm = Math.floor(totalSec / 60);
            const ss = totalSec % 60;
            if (timerBigDisplay) {
                timerBigDisplay.innerText = `00:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
            }
            if (timerStatus) timerStatus.innerText = 'Đang chạy ngầm ổn định...';
        };

        mainTicker = setInterval(tick, 1000);
        tick();
    };

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const mins = parseInt(mInput && mInput.value, 10) || 0;
            const secs = parseInt(sInput && sInput.value, 10) || 0;
            const totalMs = (mins * 60 + secs) * 1000;
            if (totalMs <= 0) return;

            const target = Date.now() + totalMs;
            chrome.storage.local.set({ aria_active: true, aria_target: target }, () => {
                chrome.alarms.create('ariaAlarm', { when: target });
                runTimerUI(target);
            });
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            chrome.storage.local.set({ aria_active: false });
            chrome.storage.local.remove('aria_target');
            chrome.alarms.clear('ariaAlarm');
            chrome.runtime.sendMessage({ action: 'STOP_ALARM' }).catch(() => {});

            if (mainTicker) clearInterval(mainTicker);
            if (startBtn) startBtn.disabled = false;
            if (timerBigDisplay) {
                timerBigDisplay.innerText = '00:00:00';
                timerBigDisplay.classList.remove('pulse');
            }
            if (timerStatus) timerStatus.innerText = 'Báo động đã được tắt.';
        });
    }

    chrome.storage.local.get(['aria_active', 'aria_target'], (data) => {
        if (data.aria_active && data.aria_target) {
            if (data.aria_target > Date.now()) runTimerUI(data.aria_target);
            else if (timerBigDisplay) timerBigDisplay.innerText = 'HẾT GIỜ!';
        }
    });
}

/* ============================================================
 * 4) CHAT AI KÉP — Claude (Anthropic) + ChatGPT (OpenAI)
 * ========================================================== */
const CHAT = {
    maxTokens: 2048,
    defaults: { claudeModel: 'claude-opus-5-5', gptModel: 'gpt-4o-mini', mode: 'parallel' },
    systemPrompt:
        'Bạn đang tham gia một cuộc trò chuyện chung giữa người dùng và HAI trợ lý AI: ' +
        'Claude (Anthropic) và ChatGPT (OpenAI). Hai AI cùng chia sẻ ngữ cảnh và hỗ trợ nhau ' +
        'để đưa ra câu trả lời tốt nhất cho người dùng. Hãy trả lời bằng tiếng Việt, rõ ràng và ' +
        'ngắn gọn. Nếu AI kia đã trả lời, hãy bổ sung phần còn thiếu hoặc góp ý thay vì lặp lại.',
};

const chatState = {
    cfg: { anthropicKey: '', openaiKey: '', claudeModel: '', gptModel: '', mode: 'parallel' },
    history: [], // [{ speaker: 'user'|'claude'|'gpt'|'error', text }]
    busy: false,
};

function $(id) { return document.getElementById(id); }

function loadChatConfig(done) {
    chrome.storage.local.get(
        ['cfg_anthropicKey', 'cfg_openaiKey', 'cfg_claudeModel', 'cfg_gptModel', 'cfg_mode', 'chat_history'],
        (r) => {
            chatState.cfg.anthropicKey = r.cfg_anthropicKey || '';
            chatState.cfg.openaiKey = r.cfg_openaiKey || '';
            chatState.cfg.claudeModel = r.cfg_claudeModel || CHAT.defaults.claudeModel;
            chatState.cfg.gptModel = r.cfg_gptModel || CHAT.defaults.gptModel;
            chatState.cfg.mode = r.cfg_mode || CHAT.defaults.mode;
            chatState.history = Array.isArray(r.chat_history) ? r.chat_history : [];
            if (done) done();
        }
    );
}

function saveChatHistory() {
    chrome.storage.local.set({ chat_history: chatState.history });
}

function updateModeLabel() {
    const label = $('modeLabel');
    if (!label) return;
    label.textContent = chatState.cfg.mode === 'collaborate'
        ? 'Chế độ: Hợp tác'
        : 'Chế độ: Song song';
}

function renderEmptyHint() {
    const box = $('chatMessages');
    if (!box) return;
    box.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'chat-empty';
    div.textContent = chatState.cfg.anthropicKey && chatState.cfg.openaiKey
        ? 'Hãy nhập tin nhắn — Claude và ChatGPT sẽ cùng trả lời trong một cuộc trò chuyện.'
        : 'Mở ⚙️ Cấu hình để nhập API key của bạn (Anthropic + OpenAI), rồi bắt đầu chat.';
    box.appendChild(div);
}

const WHO_LABEL = { user: 'Bạn', claude: 'Claude', gpt: 'ChatGPT', error: 'Lỗi' };

// Trả về phần tử .bubble để có thể cập nhật nội dung (dùng cho trạng thái "đang nghĩ").
function appendBubble(speaker, text, opts) {
    const box = $('chatMessages');
    if (!box) return null;
    const empty = box.querySelector('.chat-empty');
    if (empty) empty.remove();

    const wrap = document.createElement('div');
    wrap.className = 'msg ' + speaker;

    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = WHO_LABEL[speaker] || speaker;

    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (opts && opts.thinking ? ' thinking' : '');
    if (opts && opts.thinking) {
        bubble.innerHTML = '';
        const span = document.createElement('span');
        span.textContent = text + ' ';
        bubble.appendChild(span);
        const dots = document.createElement('span');
        dots.className = 'dots';
        bubble.appendChild(dots);
    } else {
        bubble.textContent = text;
    }

    wrap.appendChild(who);
    wrap.appendChild(bubble);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    return bubble;
}

function setBubble(bubble, speaker, text) {
    if (!bubble) return;
    bubble.className = 'bubble';
    bubble.textContent = text;
    const parent = bubble.closest('.msg');
    if (parent && speaker) {
        parent.className = 'msg ' + speaker;
        const who = parent.querySelector('.who');
        if (who) who.textContent = WHO_LABEL[speaker] || speaker;
    }
    const box = $('chatMessages');
    if (box) box.scrollTop = box.scrollHeight;
}

function renderHistory() {
    const box = $('chatMessages');
    if (!box) return;
    box.innerHTML = '';
    if (!chatState.history.length) { renderEmptyHint(); return; }
    for (const m of chatState.history) appendBubble(m.speaker, m.text);
}

/* ---------- Gọi API ---------- */

// Ngữ cảnh dùng chung được dựng lại cho từng model (cả hai "nhìn thấy" lời của nhau).
function buildAnthropicMessages(history, userText, collabContext) {
    const msgs = [];
    for (const m of history) {
        if (m.speaker === 'user') msgs.push({ role: 'user', content: m.text });
        else if (m.speaker === 'claude') msgs.push({ role: 'assistant', content: m.text });
        else if (m.speaker === 'gpt') msgs.push({ role: 'user', content: '[ChatGPT đã trả lời ở lượt trước]: ' + m.text });
    }
    msgs.push({ role: 'user', content: userText });
    if (collabContext) msgs.push({ role: 'user', content: collabContext });
    return msgs;
}

function buildOpenAIMessages(history, userText, collabContext) {
    const msgs = [{ role: 'system', content: CHAT.systemPrompt }];
    for (const m of history) {
        if (m.speaker === 'user') msgs.push({ role: 'user', content: m.text });
        else if (m.speaker === 'gpt') msgs.push({ role: 'assistant', content: m.text });
        else if (m.speaker === 'claude') msgs.push({ role: 'user', content: '[Claude đã trả lời ở lượt trước]: ' + m.text });
    }
    msgs.push({ role: 'user', content: userText });
    if (collabContext) msgs.push({ role: 'user', content: collabContext });
    return msgs;
}

async function callClaude(history, userText, collabContext) {
    const key = chatState.cfg.anthropicKey;
    if (!key) throw new Error('Chưa nhập API key Anthropic (mở ⚙️ Cấu hình).');
    const model = chatState.cfg.claudeModel || CHAT.defaults.claudeModel;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: model,
            max_tokens: CHAT.maxTokens,
            system: CHAT.systemPrompt,
            messages: buildAnthropicMessages(history, userText, collabContext),
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = (data && data.error && data.error.message) || res.status + ' ' + res.statusText;
        throw new Error('Claude API: ' + msg);
    }
    if (data.stop_reason === 'refusal') {
        return '(Claude đã từ chối trả lời yêu cầu này.)';
    }
    const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    return text || '(Claude không trả về nội dung.)';
}

async function callGPT(history, userText, collabContext) {
    const key = chatState.cfg.openaiKey;
    if (!key) throw new Error('Chưa nhập API key OpenAI (mở ⚙️ Cấu hình).');
    const model = chatState.cfg.gptModel || CHAT.defaults.gptModel;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: 'Bearer ' + key,
        },
        body: JSON.stringify({
            model: model,
            max_tokens: CHAT.maxTokens,
            messages: buildOpenAIMessages(history, userText, collabContext),
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = (data && data.error && data.error.message) || res.status + ' ' + res.statusText;
        throw new Error('OpenAI API: ' + msg);
    }
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return (text && text.trim()) || '(ChatGPT không trả về nội dung.)';
}

/* ---------- Luồng gửi tin nhắn ---------- */
async function handleSend() {
    if (chatState.busy) return;
    const input = $('chatInput');
    const sendBtn = $('chatSendBtn');
    if (!input) return;

    const userText = input.value.trim();
    if (!userText) return;

    if (!chatState.cfg.anthropicKey || !chatState.cfg.openaiKey) {
        const s = $('chatSettings');
        if (s) s.classList.add('open');
        appendBubble('error', 'Bạn cần nhập cả API key Anthropic và OpenAI trong ⚙️ Cấu hình trước khi chat.');
        return;
    }

    chatState.busy = true;
    if (sendBtn) sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    // Lịch sử TRƯỚC lượt này (dùng làm ngữ cảnh chung cho cả hai AI).
    const priorHistory = chatState.history.slice();

    appendBubble('user', userText);

    const turn = { user: userText, claude: null, gpt: null };

    if (chatState.cfg.mode === 'collaborate') {
        // Claude trả lời trước → ChatGPT xem và bổ sung.
        const cBubble = appendBubble('claude', 'Claude đang trả lời', { thinking: true });
        try {
            turn.claude = await callClaude(priorHistory, userText, null);
            setBubble(cBubble, 'claude', turn.claude);
        } catch (err) {
            setBubble(cBubble, 'error', 'Claude: ' + err.message);
        }

        const gBubble = appendBubble('gpt', 'ChatGPT đang bổ sung', { thinking: true });
        try {
            const collab = turn.claude
                ? 'Claude (một AI khác) vừa trả lời câu hỏi trên như sau:\n"""\n' + turn.claude +
                  '\n"""\nVới vai trò ChatGPT, hãy kiểm tra, bổ sung hoặc chỉnh sửa để câu trả lời chung ' +
                  'tốt hơn. Nêu rõ bạn đồng ý điểm nào và bổ sung/khác biệt điểm nào. Trả lời bằng tiếng Việt.'
                : null;
            turn.gpt = await callGPT(priorHistory, userText, collab);
            setBubble(gBubble, 'gpt', turn.gpt);
        } catch (err) {
            setBubble(gBubble, 'error', 'ChatGPT: ' + err.message);
        }
    } else {
        // Song song: cả hai cùng trả lời (chạy đồng thời).
        const cBubble = appendBubble('claude', 'Claude đang trả lời', { thinking: true });
        const gBubble = appendBubble('gpt', 'ChatGPT đang trả lời', { thinking: true });

        const [cRes, gRes] = await Promise.allSettled([
            callClaude(priorHistory, userText, null),
            callGPT(priorHistory, userText, null),
        ]);

        if (cRes.status === 'fulfilled') { turn.claude = cRes.value; setBubble(cBubble, 'claude', cRes.value); }
        else setBubble(cBubble, 'error', 'Claude: ' + cRes.reason.message);

        if (gRes.status === 'fulfilled') { turn.gpt = gRes.value; setBubble(gBubble, 'gpt', gRes.value); }
        else setBubble(gBubble, 'error', 'ChatGPT: ' + gRes.reason.message);
    }

    // Chỉ lưu vào lịch sử dùng chung những câu trả lời thành công.
    chatState.history.push({ speaker: 'user', text: userText });
    if (turn.claude) chatState.history.push({ speaker: 'claude', text: turn.claude });
    if (turn.gpt) chatState.history.push({ speaker: 'gpt', text: turn.gpt });
    saveChatHistory();

    chatState.busy = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
}

function initChat() {
    const pane = $('pane3');
    if (!pane) return;

    loadChatConfig(() => {
        // Đổ cấu hình vào form.
        const map = {
            anthropicKey: 'anthropicKey',
            openaiKey: 'openaiKey',
            claudeModel: 'claudeModel',
            gptModel: 'gptModel',
        };
        for (const k in map) { const el = $(map[k]); if (el) el.value = chatState.cfg[k]; }
        const modeSel = $('chatMode');
        if (modeSel) modeSel.value = chatState.cfg.mode;

        updateModeLabel();
        renderHistory();

        // Mở sẵn phần cấu hình nếu chưa có key.
        if (!chatState.cfg.anthropicKey || !chatState.cfg.openaiKey) {
            const s = $('chatSettings');
            if (s) s.classList.add('open');
        }
    });

    const toggleBtn = $('toggleCfgBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => {
        const s = $('chatSettings');
        if (s) s.classList.toggle('open');
    });

    const saveBtn = $('saveCfgBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        chatState.cfg.anthropicKey = ($('anthropicKey').value || '').trim();
        chatState.cfg.openaiKey = ($('openaiKey').value || '').trim();
        chatState.cfg.claudeModel = ($('claudeModel').value || '').trim() || CHAT.defaults.claudeModel;
        chatState.cfg.gptModel = ($('gptModel').value || '').trim() || CHAT.defaults.gptModel;
        chatState.cfg.mode = $('chatMode').value || CHAT.defaults.mode;

        chrome.storage.local.set({
            cfg_anthropicKey: chatState.cfg.anthropicKey,
            cfg_openaiKey: chatState.cfg.openaiKey,
            cfg_claudeModel: chatState.cfg.claudeModel,
            cfg_gptModel: chatState.cfg.gptModel,
            cfg_mode: chatState.cfg.mode,
        }, () => {
            updateModeLabel();
            saveBtn.textContent = '✓ Đã lưu';
            setTimeout(() => { saveBtn.textContent = 'Lưu cấu hình'; }, 1500);
            const s = $('chatSettings');
            if (s && chatState.cfg.anthropicKey && chatState.cfg.openaiKey) s.classList.remove('open');
            if (!chatState.history.length) renderEmptyHint();
        });
    });

    const modeSel = $('chatMode');
    if (modeSel) modeSel.addEventListener('change', () => {
        chatState.cfg.mode = modeSel.value;
        chrome.storage.local.set({ cfg_mode: chatState.cfg.mode });
        updateModeLabel();
    });

    const clearBtn = $('clearChatBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        chatState.history = [];
        saveChatHistory();
        renderEmptyHint();
    });

    const sendBtn = $('chatSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', handleSend);

    const input = $('chatInput');
    if (input) {
        // Enter để gửi, Shift+Enter để xuống dòng.
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        });
        // Tự giãn chiều cao ô nhập.
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
    }
}

/* ============================================================
 * KHỞI CHẠY
 * ========================================================== */
function boot() {
    initTabs();
    initStorage();
    initTimer();
    initChat();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
