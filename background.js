
/**
 * ARIA PRO BACKGROUND - SERVICE WORKER (ULTIMATE)
 */

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'ariaAlarm') {
        // Tạo Offscreen trước khi phát nhạc
        await setupOffscreen();
        
        // Hiện thông báo Desktop
        chrome.notifications.create('aria-alert', {
            type: 'basic',
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png',
            title: 'HẾT GIỜ!',
            message: 'Đã đến giờ kiểm tra tài khoản quảng cáo.',
            priority: 2,
            requireInteraction: true
        });
    }
});

async function setupOffscreen() {
    const existing = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existing.length === 0) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Cần phát âm thanh báo động cho tính năng hẹn giờ.'
        });
    }
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'OFFSCREEN_READY') {
        chrome.runtime.sendMessage({ action: 'AUDIO_PLAY' }).catch(() => {});
    } else if (msg.action === 'STOP_ALARM') {
        chrome.runtime.sendMessage({ action: 'AUDIO_STOP' }).catch(() => {});
        // Đóng offscreen sau khi tắt nhạc để tiết kiệm tài nguyên
        setTimeout(() => {
            chrome.offscreen.closeDocument().catch(() => {});
        }, 500);
    }
    return true;
});
