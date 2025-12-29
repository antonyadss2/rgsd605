
/**
 * ARIA AUDIO HANDLER
 */
const alarmAudio = document.getElementById('alarm');

chrome.runtime.onMessage.addListener((msg) => {
    if (!alarmAudio) return;

    if (msg.action === 'AUDIO_PLAY') {
        alarmAudio.currentTime = 0;
        alarmAudio.play().catch(e => console.error("Audio error:", e));
    } else if (msg.action === 'AUDIO_STOP') {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    }
});

// Gửi tín hiệu đã sẵn sàng
function pingBackground() {
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_READY' }).catch(() => {
        setTimeout(pingBackground, 200);
    });
}

pingBackground();
