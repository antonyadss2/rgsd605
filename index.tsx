
/**
 * ARIA PRO V5.5 - STABLE CORE ENGINE
 */
declare const chrome: any;

const AriaEngine = () => {
    // 1. CHỨC NĂNG CHUYỂN TAB (EVENT DELEGATION GỐC)
    const initTabs = () => {
        const tabManager = document.getElementById('tabManager');
        if (!tabManager) return;

        tabManager.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            const tabBtn = target.closest('.tab-item') as HTMLElement;
            
            if (tabBtn) {
                const paneId = tabBtn.getAttribute('data-pane');
                if (!paneId) return;

                // 1. Cập nhật class cho Tab
                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                tabBtn.classList.add('active');

                // 2. Cập nhật class cho Pane
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                const activePane = document.getElementById(paneId);
                if (activePane) {
                    activePane.classList.add('active');
                }
            }
        });
    };

    // 2. CHỨC NĂNG BỘ NHỚ (STORAGE)
    const idStorage = document.getElementById('idStorage') as HTMLTextAreaElement;
    const notesStatus = document.getElementById('notesStatus');

    const initStorage = () => {
        if (!idStorage) return;

        // Load dữ liệu cũ
        chrome.storage.local.get(['saved_ids'], (res: any) => {
            if (res.saved_ids) {
                idStorage.value = res.saved_ids;
            }
        });

        // Lưu dữ liệu khi nhập
        idStorage.addEventListener('input', () => {
            const val = idStorage.value;
            chrome.storage.local.set({ 'saved_ids': val }, () => {
                if (notesStatus) {
                    notesStatus.innerText = "Đã lưu tự động: " + new Date().toLocaleTimeString();
                }
            });
        });
    };

    // 3. CHỨC NĂNG HẸN GIỜ
    const timerBigDisplay = document.getElementById('timerBigDisplay');
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    const mInput = document.getElementById('mInput') as HTMLInputElement;
    const sInput = document.getElementById('sInput') as HTMLInputElement;
    const timerStatus = document.getElementById('timerStatus');

    let mainTicker: any = null;

    const runTimerUI = (targetTime: number) => {
        if (mainTicker) clearInterval(mainTicker);
        if (startBtn) startBtn.disabled = true;

        const tick = () => {
            const now = Date.now();
            const remain = targetTime - now;

            if (remain <= 0) {
                clearInterval(mainTicker);
                if (timerBigDisplay) {
                    timerBigDisplay.innerText = "HẾT GIỜ!";
                    timerBigDisplay.classList.add('pulse');
                }
                if (timerStatus) timerStatus.innerText = "🔔 Đang phát báo động âm thanh...";
                if (startBtn) startBtn.disabled = false;
                return;
            }

            const totalSec = Math.ceil(remain / 1000);
            const mm = Math.floor(totalSec / 60);
            const ss = totalSec % 60;
            
            if (timerBigDisplay) {
                timerBigDisplay.innerText = `00:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
            }
            if (timerStatus) timerStatus.innerText = "Đang chạy ngầm ổn định...";
        };

        mainTicker = setInterval(tick, 1000);
        tick();
    };

    const initTimer = () => {
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const mins = parseInt(mInput.value) || 0;
                const secs = parseInt(sInput.value) || 0;
                const totalMs = (mins * 60 + secs) * 1000;

                if (totalMs <= 0) return;

                const target = Date.now() + totalMs;
                chrome.storage.local.set({ 'aria_active': true, 'aria_target': target }, () => {
                    chrome.alarms.create('ariaAlarm', { when: target });
                    runTimerUI(target);
                });
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                chrome.storage.local.set({ 'aria_active': false });
                chrome.storage.local.remove('aria_target');
                chrome.alarms.clear('ariaAlarm');
                chrome.runtime.sendMessage({ action: 'STOP_ALARM' }).catch(() => {});
                
                if (mainTicker) clearInterval(mainTicker);
                if (startBtn) startBtn.disabled = false;
                if (timerBigDisplay) {
                    timerBigDisplay.innerText = "00:00:00";
                    timerBigDisplay.classList.remove('pulse');
                }
                if (timerStatus) timerStatus.innerText = "Báo động đã được tắt.";
            });
        }

        // Khôi phục trạng thái timer khi mở lại App
        chrome.storage.local.get(['aria_active', 'aria_target'], (data: any) => {
            if (data.aria_active && data.aria_target) {
                if (data.aria_target > Date.now()) {
                    runTimerUI(data.aria_target);
                } else {
                    if (timerBigDisplay) timerBigDisplay.innerText = "HẾT GIỜ!";
                }
            }
        });
    };

    // KHỞI CHẠY TOÀN BỘ
    initTabs();
    initStorage();
    initTimer();
};

// Đảm bảo DOM đã sẵn sàng trước khi chạy Engine
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AriaEngine);
} else {
    AriaEngine();
}
