# Công cụ chuyển hướng 301 (Cloudflare Worker)

Một Cloudflare Worker nhỏ: mọi truy cập đều được trả về **HTTP 301** (chuyển
hướng vĩnh viễn) tới link bạn chỉ định. Dùng cho đổi tên miền, gom link về
landing page, rút gọn link, v.v.

## 1. Cấu hình link đích

Mở [`src/index.js`](src/index.js), sửa khối `CONFIG`:

```js
const CONFIG = {
  TARGET_URL: "https://trang-dich-cua-ban.com/landing", // ← link bạn muốn chuyển TỚI
  STATUS: 301,            // 301 (vĩnh viễn) hoặc 308 (giữ HTTP method)
  PRESERVE_PATH: false,   // true = giữ path+query khi chuyển (hợp cho đổi domain)
};
```

## 2. Deploy lên Cloudflare

Cần một tài khoản Cloudflare (miễn phí) và [Node.js](https://nodejs.org).

```bash
cd cloudflare-301-redirect

# Đăng nhập Cloudflare (mở trình duyệt để xác thực) — chỉ cần làm 1 lần
npx wrangler login

# Deploy
npx wrangler deploy
```

Sau khi deploy xong, Worker chạy tại:

```
https://redirect-301.<tên-tài-khoản>.workers.dev
```

Mở link đó → bạn sẽ bị chuyển hướng 301 tới `TARGET_URL`.

## 3. (Tuỳ chọn) Dùng tên miền riêng

Nếu muốn redirect chạy trên domain của bạn (vd `link.domaincuaban.com`),
domain phải được quản lý qua Cloudflare. Mở [`wrangler.toml`](wrangler.toml),
bỏ ghi chú khối `routes` và điền domain, rồi `npx wrangler deploy` lại.

## 4. Kiểm tra là 301 thật

```bash
curl -I https://redirect-301.<tên-tài-khoản>.workers.dev
# Kết quả có:  HTTP/2 301   và   location: https://trang-dich-cua-ban.com/...
```

## Ghi chú

- `PRESERVE_PATH: true` giúp giữ nguyên cấu trúc link khi đổi domain:
  `/bai-viet?id=9` → `https://dich.com/bai-viet?id=9`.
- Đây là chuyển hướng **phía máy chủ** (server-side) nên là 301 thật, khác với
  trang HTML tự chuyển hướng (meta refresh / JS) vốn không phải 301.
