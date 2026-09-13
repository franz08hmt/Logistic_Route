# Phase 16 — Bàn giao: Landing Portal (Dark Cinema / ONEPRO)

> **Mục đích:** file này ghi lại những gì KHÔNG nằm trong code — quyết định, lý do, lỗi đã sửa và cạm bẫy đã gặp.
> Code thì đọc được từ đĩa; *vì sao* code như vậy thì chỉ có ở đây.
>
> - **Ngày:** 2026-09-12
> - **Nhánh:** `feature/route-optimization` (HEAD `8bb840d`)
> - **Trạng thái:** đã build xong, **chưa commit**
> - **Thực hiện:** Claude Opus 5 (Claude Code), phiên làm việc mở ở `D:\New-Tech` rồi chuyển sang đây

---

## 1. Đọc mục này trước khi sửa bất cứ thứ gì

1. Chạy `git status` — trong cây làm việc có **rất nhiều thay đổi chưa commit KHÔNG thuộc Phase 16** (COD settlement, VietQR, `ShiftSettlementModal`, `apps/api/**`). **Không đụng vào.**
2. Phase 16 chỉ gồm các file liệt kê ở mục 6.
3. Trước khi kết luận "chỗ này hỏng", đọc mục 5 — đã có 3 lần phép đo cho kết quả sai lệch ở project này.

---

## 2. Đã làm gì

Thay trang `/` (vốn là bản sao DashboardOverview **không có `RoleGuard`**) bằng một landing portal công khai theo mẫu ONEPRO:

| Thành phần | File |
| --- | --- |
| Header glassmorphism, nav uppercase, social, search, badge, drawer mobile | `apps/web/components/landing/LandingHeader.tsx` |
| Hero ảnh cinematic + vignette + `<h1>` hai dòng | `apps/web/components/landing/LandingHero.tsx` |
| 4 thẻ dịch vụ viền mảnh, Heroicons outline | `apps/web/components/landing/LandingServicesTicker.tsx` |
| Khu "DISCOVER OUR STORY", watermark ABOUT, 3 số liệu, nút ghost | `apps/web/components/landing/LandingStorySection.tsx` |
| Lắp ghép + skip link + footer | `apps/web/app/page.tsx` |
| Poppins + metadata OG/Twitter + JSON-LD | `apps/web/app/layout.tsx` |
| Token Dark Cinema + `.landing-portal` + vignette + watermark | `apps/web/app/globals.css` |

**Không mất chức năng nào:** `/dashboard` vẫn là bản DashboardOverview đầy đủ, có `RoleGuard`. Trang `/` cũ chỉ là bản trùng lặp thiếu bảo vệ quyền.

---

## 3. Ba quyết định do người dùng chốt

Đừng tự ý đảo ngược — đây là lựa chọn có chủ đích, không phải mặc định:

| Vấn đề | Quyết định | Hệ quả |
| --- | --- | --- |
| Nguồn ảnh Hero (prompt nhắc "Image 4" nhưng không có ảnh đính kèm) | Tải ảnh license-free về **local** | 2 file WebP trong `public/landing/`, tổng 424 KB. Demo offline và Docker build đều chạy. Không hotlink CDN. |
| Phạm vi font Poppins | **Toàn bộ app**, không riêng landing | `--font-sans` trong `globals.css` đổi từ `Inter` sang `var(--font-poppins)`. Mọi trang nghiệp vụ (dispatch, fleet, driver…) đều đổi diện mạo. |
| Test cho landing | **Cài bộ test component** | Thêm `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` + `vitest.config.ts`. |

Ghi chú về `--font-sans`: trước Phase 16 file khai `Inter` nhưng **không nạp font nào cả**, nên thực tế trình duyệt rơi về Segoe UI. Giờ Poppins được nạp thật qua `next/font/google`.

---

## 4. Hai lỗi thật đã sửa

**a. Footer không đạt WCAG AA.** `text-slate-500` trên nền `#08090d` đo được **4.18:1**, dưới ngưỡng 4.5. Đổi sang `text-slate-400` → **7.57:1**. Comment lý do đã để trong `page.tsx`.

**b. Hai phần tử cùng mang role `banner`.** Cột trái của Story dùng `<header>`, gây nhập nhằng với header trang cho công nghệ trợ giúp (test `getByRole('banner')` bắt được). Cột đó chỉ là một cột layout → đổi sang `<div>`, có comment trong `LandingStorySection.tsx`.

---

## 5. Ba cạm bẫy đo đạc — đọc kỹ để khỏi lặp lại

Đây là phần dễ làm phiên sau mất thời gian nhất. **Cả ba lần, công cụ đo sai chứ code không hỏng.**

### 5.1 Tailwind v4 xuất màu ở `lab()` / `oklab()`

Đo tương phản bằng cách regex lấy số từ `getComputedStyle(el).color` sẽ **bốc nhầm toạ độ LAB thành RGB**, cho ra tỉ lệ vô lý kiểu `1.05:1` (nghĩa là chữ tàng hình) trong khi mắt thường đọc được bình thường.

**Cách đúng** — để trình duyệt tự quy đổi qua canvas:

```js
const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function toRgb(cssColor) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = cssColor; ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}
```

### 5.2 CSSOM trong Next.js dev đọc thiếu rule

`document.styleSheets` chỉ trả về ~93 rule cho cả app — quá ít. Kết luận "không có rule `:focus-visible`" là **sai**.

**Cách đúng:** lấy thẳng file CSS server trả về rồi grep.

```bash
# lấy URL stylesheet từ trình duyệt:
#   [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href)
curl -s 'http://localhost:3001/_next/static/chunks/<hash>.css' -o out.css
grep -o 'focus-visible[^,{]*' out.css | sort -u
```

Kết quả thật: 4 rule `focus-visible\:outline`, `outline-2`, `outline-offset-4`, `outline-amber-400` đều tồn tại và set thuộc tính outline thật.

### 5.3 `.focus()` từ JS không kích hoạt `:focus-visible`

Gọi `el.focus()` rồi kiểm tra `outlineStyle` sẽ báo "0/12 control có focus ring" — sai. `:focus-visible` chỉ bật khi điều hướng **bằng bàn phím thật**.

Thêm nữa: ở chế độ dev, phím Tab hay rơi vào `<nextjs-portal>` (overlay của Next.js dev), không phải phần tử của trang. Đây **không** phải lỗi production.

### 5.4 (Bonus) Poppins vẫn vẽ được tiếng Việt

Poppins **không có** subset `vietnamese` — khai `subsets: ['latin','latin-ext','vietnamese']` sẽ lỗi TypeScript, chỉ nhận `devanagari | latin | latin-ext`.

Nhưng đo pixel từng ký tự `Ề Ữ Ộ Ả Đ Ơ Ă` cho thấy bề rộng và pixel **khác hoàn toàn** Segoe UI ⇒ `latin-ext` của Poppins đã phủ khối Vietnamese. **Không cần đổi font.** Đừng "sửa" chỗ này.

### 5.5 `next build` giết `next dev`

Hai lệnh dùng chung thư mục `.next/`. Chạy `npm run build` khi dev server đang chạy sẽ làm dev server chết. Chạy build xong thì khởi động lại dev.

---

## 6. File thuộc Phase 16

```
M  apps/web/app/globals.css          font-sans → Poppins, token cinema, .landing-portal
M  apps/web/app/layout.tsx           Poppins, metadata, JSON-LD
M  apps/web/app/page.tsx             lắp ghép landing
M  apps/web/messages/vi.json         +41 key  (landing.*)
M  apps/web/messages/en.json         +41 key  (landing.*)
M  apps/web/package.json             +4 dependency
M  apps/web/package-lock.json
?? apps/web/components/landing/      4 component
?? apps/web/tests/                   landing-page.test.tsx (6 test)
?? apps/web/vitest.config.ts         alias @/ + include *.test.tsx
?? apps/web/public/landing/          hero-freight.webp, story-interchange.webp
?? apps/web/.claude/                 launch.json cho dev server (CHƯA gitignore)
```

`TranslationKey = keyof typeof viMessages`, nên **thiếu key bên `en.json` sẽ lỗi typecheck** — parity được ép buộc tự động, không cần kiểm tay.

`vitest.config.ts` cố ý **không** đặt `environment: 'jsdom'` toàn cục: 37 file test cũ là contract test chạy trong Node. Chỉ `landing-page.test.tsx` opt-in bằng docblock `// @vitest-environment jsdom`.

---

## 7. Kết quả nghiệm thu

| Tiêu chí | Kết quả |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test` | **167/167 pass, 38 file** (6 test landing mới; 161 test cũ không vỡ) |
| `npm run build` | pass — `/` là **static prerender (○)** |
| Tương phản WCAG AA | 7.57 – 19.9 : 1 trên mọi mẫu chữ đã đo |
| Responsive 375 px | 0 phần tử tràn; `<h1>` 36 px; nav desktop ẩn, hamburger hiện |
| JSON-LD | `SoftwareApplication` + `Service` |
| Heading | đúng 1 `<h1>`, `<h2>` cho section, 4 `<h3>` cho thẻ dịch vụ |

Về JSON-LD: prompt yêu cầu type `LogisticsService`, **nhưng Schema.org không có type đó**. Đã dùng `SoftwareApplication` (mô tả sản phẩm) + `Service` với `serviceType` (mô tả dịch vụ) — hợp lệ và vẫn đạt mục tiêu AEO.

---

## 8. Việc còn treo

1. **Chưa commit.** Nhớ tách riêng Phase 16 khỏi khối COD/VietQR đang dở.
2. **`apps/web/.claude/` chưa được `.gitignore`.** Cân nhắc thêm dòng `.claude/` hoặc commit có chủ đích.
3. **Backend FastAPI `:8000` đang tắt** → `/api/backend/api/v1/auth/me` trả `502`. Không phải do Phase 16 (`apps/api` không bị đụng); bật lại backend là hết.
4. **Poppins áp cho toàn app** — nên xem lại các trang dày dữ liệu (dispatch, fleet, analytics) xem typography còn ổn không.
5. **Ảnh là ảnh stock Unsplash.** Nếu muốn bản sắc riêng, thay 2 file trong `public/landing/` — giữ nguyên tên file là không phải sửa code.

---

## 9. Chạy lại

```bash
cd apps/web
npm run dev          # http://localhost:3001
npm run typecheck
npm run test
npm run build        # nhớ: sẽ giết dev server đang chạy
```
