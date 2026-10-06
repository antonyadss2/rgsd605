<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Aria Productivity Pro

Tiện ích Chrome (Manifest V3) gồm 3 tính năng:

1. **ID TKQC** — ô ghi chú lưu tự động (chrome.storage).
2. **Hẹn Giờ** — đếm ngược chạy ngầm + báo động âm thanh/thông báo.
3. **Chat AI Kép** — trò chuyện trong đó **Claude (Anthropic)** và **ChatGPT (OpenAI)**
   cùng tham gia một cuộc hội thoại, chia sẻ ngữ cảnh và hỗ trợ nhau. Đây là cách
   "dùng 2 API trên 1 đoạn chat".

## Chat AI Kép hoạt động thế nào

- **Chế độ Song song:** mỗi tin nhắn được gửi tới cả Claude và ChatGPT cùng lúc;
  cả hai cùng trả lời. Lượt sau, mỗi AI đều "nhìn thấy" câu trả lời trước của AI kia.
- **Chế độ Hợp tác:** Claude trả lời trước, sau đó ChatGPT nhận câu trả lời của Claude
  để kiểm tra / bổ sung / chỉnh sửa → ra câu trả lời chung tốt hơn.

> 🔒 **Về API key:** App dùng **API key của chính bạn** cho mỗi bên (một key Anthropic,
> một key OpenAI). Key chỉ được lưu cục bộ trên máy bạn (`chrome.storage.local`) và chỉ
> gửi trực tiếp tới `api.anthropic.com` / `api.openai.com`. Không có chuyện "mượn token"
> giữa hai dịch vụ — mỗi bên tự tính phí theo key của bạn.

### Lấy API key ở đâu

- Anthropic (Claude): https://console.anthropic.com → API Keys (dạng `sk-ant-...`)
- OpenAI (ChatGPT): https://platform.openai.com/api-keys (dạng `sk-...`)

Model mặc định: `claude-opus-5-5` và `gpt-4o-mini` — bạn có thể đổi trong ô cấu hình sang
bất kỳ model nào mà key của bạn có quyền truy cập.

## Cài đặt (nạp extension vào Chrome)

Không cần build. Chạy trực tiếp từ thư mục mã nguồn:

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Bấm **Load unpacked** → chọn thư mục dự án này
4. Ghim tiện ích rồi mở popup → vào tab **Chat AI Kép**
5. Mở ⚙️ **Cấu hình**, dán 2 API key, **Lưu cấu hình**, và bắt đầu chat

## Cấu trúc file

| File | Vai trò |
|------|---------|
| `index.html` | Giao diện popup (3 tab) |
| `app.js` | **Toàn bộ logic đang chạy** của popup: tab, ghi chú, hẹn giờ, Chat AI Kép |
| `background.js` | Service worker: xử lý báo thức (chrome.alarms) + mở offscreen phát âm thanh |
| `offscreen.html` / `offscreen.js` | Phát âm thanh báo động khi hết giờ |
| `manifest.json` | Khai báo extension + `host_permissions` cho 2 host API |

> Ghi chú: các file `index.tsx`, `App.tsx`, `index.js`, `script.js`, `types.ts` là mã cũ
> (bản TypeScript/Vite) không còn được popup nạp — logic hiện tại nằm ở `app.js`.
