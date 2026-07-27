# LogiRoute VN - Custom Agent Rules & Guidelines

Dự án **LogiRoute VN** - Nền tảng tối ưu lộ trình và quản lý logistics cho Việt Nam.

## 1. Nguyên Tắc Cốt Lõi (Core Principles)
*   **Dữ liệu thực tế (Real-world data):** Tất cả tọa độ, địa chỉ, biển số xe phải sử dụng dữ liệu hợp lệ tại Việt Nam (vd: TP.HCM, Hà Nội). Không dùng dữ liệu giả vô nghĩa.
*   **Tách biệt Engine & UI (Separation of Concerns):** Core optimization engine (`core_engine/`) phải hoàn toàn độc lập với HTTP layer (`apps/api/`) và UI (`apps/web/`). Engine chỉ nhận input và trả output qua Pydantic models.
*   **Deterministic & Explainable:** Kết quả tối ưu phải tái lập được (deterministic) và giải thích được (tại sao đơn hàng X được gán cho xe Y).

## 2. Tiêu chuẩn Code Python
*   Tuân thủ **PEP 8**. Sử dụng **type hints** cho mọi hàm và biến.
*   Sử dụng **Pydantic v2** cho validation và serialization của input/output contracts.
*   Mọi module phải có khối `if __name__ == "__main__":` để test độc lập.
*   Xử lý exception kỹ lưỡng: khi solver không tìm được lời giải khả thi, trả về `status: "INFEASIBLE"` kèm danh sách `unassigned_orders`.

## 3. Tiêu chuẩn UI & Frontend
*   Sử dụng **Tailwind CSS** cho giao diện. Áp dụng phong cách thiết kế hiện đại (Glassmorphism, Card bóng đổ nhẹ, màu sắc tương phản cao hỗ trợ người dùng dưới ánh nắng ngoài trời).
*   Đảm bảo giao diện tương thích 100% trên thiết bị di động (Mobile-first).

## 4. Quản lý Trạng thái & API
*   API route tại `/api/locations` phải lọc và sắp xếp địa điểm theo khoảng cách tăng dần tính từ tọa độ GPS của người dùng.
*   Cung cấp cơ chế dự phòng (fallback) nếu API hoặc bản đồ tải chậm.
