/**
 * Cloudflare Worker — Công cụ chuyển hướng 301 (Permanent Redirect)
 * ------------------------------------------------------------------
 * Mọi request tới Worker này sẽ được trả về mã HTTP 301 (chuyển hướng
 * vĩnh viễn) tới địa chỉ bạn chỉ định ở TARGET_URL bên dưới.
 *
 * CÁCH DÙNG NHANH:
 *   1. Điền link đích vào CONFIG.TARGET_URL.
 *   2. Chạy:  npx wrangler deploy   (xem README.md để biết chi tiết).
 */

// ===================== CẤU HÌNH — CHỈNH TẠI ĐÂY =====================
const CONFIG = {
  // 👉 Link bạn muốn chuyển TỚI. BẮT BUỘC điền (thay cho giá trị mẫu).
  //    Ví dụ: "https://trang-dich-cua-ban.com/landing"
  TARGET_URL: "https://www.facebook.com/messages/t/1468377063431052",

  // Mã trạng thái chuyển hướng:
  //   301 = chuyển hướng vĩnh viễn (mặc định, được trình duyệt/Google cache)
  //   308 = vĩnh viễn nhưng giữ nguyên HTTP method (POST vẫn là POST)
  STATUS: 301,

  // true  → giữ nguyên đường dẫn + query khi chuyển hướng
  //         (vd: /bai-viet?id=9  →  https://dich.com/bai-viet?id=9)
  //         Hợp khi CHUYỂN DOMAIN (đổi tên miền, giữ cấu trúc link).
  // false → luôn chuyển thẳng tới đúng TARGET_URL, bỏ path/query gốc.
  //         Hợp khi gom mọi link về 1 trang đích duy nhất.
  PRESERVE_PATH: false,
};
// ===================================================================

/** Kiểm tra TARGET_URL đã được cấu hình hợp lệ chưa. */
function getValidTarget() {
  const raw = (CONFIG.TARGET_URL || "").trim();
  if (!raw || raw === "https://example.com") return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export default {
  /**
   * @param {Request} request
   * @returns {Response}
   */
  async fetch(request) {
    const target = getValidTarget();

    // Chưa cấu hình link đích → trả về hướng dẫn thay vì chuyển hướng sai.
    if (!target) {
      return new Response(
        "⚠️ Chưa cấu hình link đích.\n" +
          "Mở src/index.js và điền CONFIG.TARGET_URL, rồi deploy lại.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    if (CONFIG.PRESERVE_PATH) {
      const incoming = new URL(request.url);
      // Ghép đường dẫn của request vào sau path gốc (nếu TARGET_URL có path).
      const base = target.pathname.replace(/\/$/, "");
      const extra = incoming.pathname === "/" ? "" : incoming.pathname;
      target.pathname = (base + extra) || "/";
      target.search = incoming.search;
    }

    return Response.redirect(target.toString(), CONFIG.STATUS);
  },
};
