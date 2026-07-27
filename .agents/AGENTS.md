# VATA Project - Custom Agent Rules & Guidelines

Chào mừng bạn (AI Agent) đến với dự án **Vietnam Airport Tourist Assistant (VATA)**. Hãy tuân thủ nghiêm ngặt các quy tắc dưới đây khi làm việc trên codebase này:

## 1. Nguyên Tắc Cốt Lõi (Core Principles)
*   **Không dùng dữ liệu giả vô nghĩa (No dummy/placeholder text):** Tất cả các nhãn (labels), tên địa điểm, hoặc thông tin đều phải có nghĩa và sử dụng nội dung thực tế liên quan đến Sân bay Việt Nam (vd: Sân bay Tân Sơn Nhất - SGN).
*   **Bảo mật & Quyền riêng tư (Privacy-first):** Geolocation API phải được yêu cầu một cách an toàn. Phải xử lý triệt để trường hợp người dùng từ chối cấp quyền định vị (hướng dẫn họ chọn sân bay thủ công).
*   **Tiếp cận Không rào cản (Zero Friction):** MVP không sử dụng cơ chế đăng nhập. Mọi cấu hình ngôn ngữ, lịch trình hoặc vị trí ưa thích của khách phải được lưu trữ trực tiếp trên thiết bị (LocalStorage).

## 2. Tiêu chuẩn Đa ngôn ngữ (i18n Rules)
*   Không Hardcode chuỗi tiếng Anh hoặc tiếng Việt vào component. Tất cả chuỗi hiển thị phải được đặt trong các file dịch `locales/*.json` và gọi thông qua thư viện `next-intl` (hoặc react-intl tương đương).
*   Các ngôn ngữ bắt buộc hỗ trợ: **en** (Tiếng Anh - mặc định), **vi** (Tiếng Việt), **zh** (Tiếng Trung), **ko** (Tiếng Hàn).

## 3. Tiêu chuẩn UI & Frontend
*   Sử dụng **Tailwind CSS** cho giao diện. Áp dụng phong cách thiết kế hiện đại (Glassmorphism, Card bóng đổ nhẹ, màu sắc tương phản cao hỗ trợ người dùng dưới ánh nắng ngoài trời).
*   Đảm bảo giao diện tương thích 100% trên thiết bị di động (Mobile-first).

## 4. Quản lý Trạng thái & API
*   API route tại `/api/locations` phải lọc và sắp xếp địa điểm theo khoảng cách tăng dần tính từ tọa độ GPS của người dùng.
*   Cung cấp cơ chế dự phòng (fallback) nếu API hoặc bản đồ tải chậm.
