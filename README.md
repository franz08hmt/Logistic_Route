# LogiRoute VN — Smart Logistics & Route Optimization Platform

LogiRoute VN là nền tảng quản lý vận hành giao nhận tại Việt Nam, tập trung vào
quản lý đơn hàng, đội xe và tối ưu tuyến giao hàng có ràng buộc tải trọng. Dự án
được xây dựng theo kiến trúc monorepo với Next.js, FastAPI, PostgreSQL/PostGIS,
Google OR-Tools, Leaflet/OpenStreetMap và OSRM.

## Tính năng chính

- Dashboard KPI lấy dữ liệu trực tiếp từ PostgreSQL.
- CRUD đơn hàng và đội xe với kiểm tra dữ liệu ở cả frontend lẫn backend.
- Tạo dữ liệu mẫu TP.HCM để trình diễn nhanh.
- Phân công các đơn `PENDING` cho đội xe bằng CVRP/OR-Tools.
- Hiển thị Depot, thứ tự điểm giao và tuyến riêng cho từng xe trên Leaflet.
- Khớp đường vẽ theo mạng lưới giao thông thực tế bằng OSRM Route Service.
- Đồng bộ lại trạng thái Orders và hiển thị toast sau mỗi lần tối ưu.
- Đối soát COD: tài xế thu tiền, nộp phiếu bàn giao quỹ cuối ca, thủ quỹ duyệt
  và toàn bộ đơn trong ca chuyển sang đã nộp quỹ trong một transaction.
- Mã VietQR động chuẩn NAPAS 24/7 dựng cục bộ (EMVCo + CRC-16/CCITT), hiển thị
  cho tài xế và in kèm phiếu giao hàng nên không phụ thuộc mạng.
- Xuất bảng kê COD ra CSV UTF-8 có BOM, mở đúng dấu tiếng Việt trong Excel.
- Cổng thông tin công khai tại `/` theo phong cách Dark Cinema, tối ưu SEO và
  AI Search với Schema.org JSON-LD.
- Console vận hành dùng chung ngôn ngữ thiết kế với cổng thông tin: thanh điều
  hướng ngang, dải ảnh mở đầu mỗi trang, nền charcoal và accent amber.

## Kiến trúc hệ thống

```mermaid
flowchart LR
    U["Điều phối viên"] --> W["Next.js App Router"]
    W -->|"REST/JSON"| A["FastAPI"]
    A -->|"SQLAlchemy"| DB[("PostgreSQL + PostGIS")]
    A --> S["Core Engine · OR-Tools CVRP"]
    S --> A
    W --> L["Leaflet + OpenStreetMap"]
    W -->|"Route geometry"| O["OSRM Route Service"]
```

Luồng tối ưu:

1. FastAPI đọc Depot, Vehicles và Orders `PENDING` từ database.
2. `core_engine` xác định thứ tự giao và xe được phân công.
3. Backend cập nhật đơn đã phân công sang `ASSIGNED`.
4. Frontend lấy lại danh sách Orders và yêu cầu OSRM trả về GeoJSON bám theo
   đường giao thông để vẽ lên Leaflet.

> OSRM hiện chỉ dùng để vẽ đường giao thông. Ma trận chi phí của solver vẫn dựa
> trên khoảng cách Haversine; tích hợp OSRM Table Service vào core engine là một
> bước nâng cấp độc lập.

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Bản đồ | Leaflet, React-Leaflet, OpenStreetMap |
| Road routing | OSRM Route Service (GeoJSON) |
| Backend | FastAPI, Pydantic |
| ORM / Database | SQLAlchemy 2, PostgreSQL 17, PostGIS 3.5 |
| Optimization | Python, Google OR-Tools |
| UI system | Tailwind CSS 4, Heroicons, font Poppins |
| Mã QR | qrcode.react (dựng payload EMVCo cục bộ) |
| Test | Pytest, Vitest, Testing Library |
| Local infrastructure | Docker Compose |

## Cấu trúc monorepo

```text
logi-route-vn/
├── apps/
│   ├── api/                  # FastAPI, models, schemas, REST routers
│   └── web/                  # Next.js: cổng thông tin, console vận hành
│       ├── components/landing/   # Cổng thông tin công khai
│       ├── components/console/   # Thanh điều hướng và dải ảnh mở đầu
│       ├── components/ui/        # Ngôn ngữ bố cục dùng chung
│       └── public/landing/       # Ảnh nền cổng thông tin và banner
├── core_engine/              # CVRP solver dùng OR-Tools
├── tasks/                    # Kế hoạch và tiến độ
├── docker-compose.yml        # PostgreSQL + PostGIS local
└── README.md
```

## Chạy local

### Yêu cầu

- Docker Desktop đang chạy với Linux containers.
- Node.js 20+ và npm.
- Python 3.11+.
- Git.

Các cổng mặc định:

| Dịch vụ | Địa chỉ |
|---|---|
| Next.js | `http://localhost:3001` hoặc cổng Next.js in ra |
| FastAPI | `http://localhost:8000` |
| Swagger UI | `http://localhost:8000/docs` |
| PostgreSQL/PostGIS | `localhost:5433` |

### 1. Tạo file môi trường

Tại thư mục gốc:

```cmd
copy .env.example .env
```

PowerShell tương đương:

```powershell
Copy-Item .env.example .env
```

Các biến có thể cấu hình:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_OSRM_BASE_URL=https://router.project-osrm.org
DATABASE_URL=postgresql+psycopg://logiroute:logiroute_dev_password_change_me@localhost:5433/logiroute
JWT_SECRET_KEY=change-this-development-secret-before-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 2. Khởi động PostgreSQL/PostGIS

```cmd
cd D:\Individual_Project
docker compose up -d postgis
docker compose ps
```

Container sẵn sàng khi trạng thái `logiroute-postgis` là `healthy`.

### 3. Khởi tạo và chạy FastAPI

Lần đầu:

```cmd
cd D:\Individual_Project\apps\api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m scripts.init_db
```

Mỗi lần mở máy/chạy lại:

```cmd
cd D:\Individual_Project\apps\api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 4. Nạp dữ liệu mẫu

Mở terminal thứ hai sau khi API đã chạy:

```cmd
curl.exe -X POST http://localhost:8000/api/v1/seed
curl.exe http://localhost:8000/api/v1/overview
```

Seed là idempotent: gọi lại sẽ không tạo trùng Depot, Vehicles hoặc Orders.

### 4b. Khởi tạo tài khoản demo

Sau khi API đã chạy, tạo ba tài khoản dùng cho local testing:

```cmd
curl.exe -X POST http://localhost:8000/api/v1/seed/users
```

Tài khoản demo:

| Email | Mật khẩu | Role |
|---|---|---|
| `admin@logiroute.vn` | `123456` | `ADMIN` |
| `dispatcher@logiroute.vn` | `123456` | `DISPATCHER` |
| `driver1@logiroute.vn` | `123456` | `DRIVER` |

Đây là credentials dành riêng cho môi trường local. Không sử dụng chúng trong
production và phải thay `JWT_SECRET_KEY` bằng secret ngẫu nhiên, lưu ngoài Git.

### 5. Chạy Next.js

Mở terminal thứ ba:

```cmd
cd D:\Individual_Project\apps\web
npm install
npm run dev
```

Dev server chạy ở cổng `3001` (`next dev -p 3001`). Mở
[http://localhost:3001](http://localhost:3001), sau đó kiểm tra:

- `/` — cổng thông tin công khai, không cần đăng nhập.
- `/dashboard` — KPI tổng quan.
- `/orders` — tạo, xem và xóa đơn hàng.
- `/dispatch` — tối ưu, kéo thả chặng và bản đồ tuyến thực tế.
- `/fleet` — tạo, xem và xóa xe.
- `/analytics` — KPI, biểu đồ và lịch sử tối ưu tuyến theo thời gian.
- `/admin/cod` — đối soát COD và duyệt phiếu bàn giao quỹ.
- `/driver` — ứng dụng tài xế: POD, chữ ký, thu COD, bàn giao quỹ ca.

Console mở mặc định ở chế độ tối. Nút mặt trăng trên thanh điều hướng chuyển
sang chế độ sáng cho tài xế làm việc ngoài trời. Trình duyệt ghi nhớ lựa chọn,
nên nếu bạn từng chọn chế độ sáng trước đây thì xóa khóa `theme` trong
localStorage để quay lại mặc định.

> `npm run build` và `npm run dev` dùng chung thư mục `.next/`. Ở Next.js 16 các
> artifact dev nằm riêng trong `.next/dev/`, nhưng nếu gặp lỗi lạ sau khi build
> thì khởi động lại dev server.

## API endpoints

Base URL local: `http://localhost:8000`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/health` | Kiểm tra trạng thái API |
| `POST` | `/api/v1/auth/register` | Đăng ký tài khoản Dispatcher/Driver chờ duyệt |
| `POST` | `/api/v1/auth/login` | Đăng nhập và nhận JWT access token |
| `GET` | `/api/v1/auth/me` | Lấy thông tin user hiện tại |
| `GET` | `/api/v1/admin/users` | Admin lấy danh sách tài khoản |
| `PATCH` | `/api/v1/admin/users/{user_id}/status` | Admin duyệt hoặc khóa tài khoản |
| `GET` | `/api/v1/overview` | KPI thực tế từ database |
| `GET` | `/api/v1/analytics/history?days=30&group_by=day` | Lịch sử chi phí và hiệu quả tối ưu theo ngày/tuần |
| `GET` | `/api/v1/orders` | Danh sách đơn hàng |
| `POST` | `/api/v1/orders` | Tạo đơn mới ở trạng thái `PENDING` |
| `POST` | `/api/v1/orders/{order_id}/dispatch` | Chủ động phân công đơn cho tài xế sẵn sàng |
| `DELETE` | `/api/v1/orders/{order_id}` | Xóa đơn hàng |
| `GET` | `/api/v1/vehicles` | Danh sách đội xe |
| `POST` | `/api/v1/vehicles` | Tạo xe mới |
| `DELETE` | `/api/v1/vehicles/{vehicle_id}` | Xóa xe |
| `POST` | `/api/v1/seed` | Tạo dữ liệu demo TP.HCM |
| `POST` | `/api/v1/seed/users` | Tạo tài khoản demo local |
| `POST` | `/api/v1/routes/optimize` | Phân tuyến các đơn `PENDING` |
| `POST` | `/api/v1/routes/dispatch` | Tối ưu và gán một nhóm đơn `PENDING` đã chọn |
| `GET` | `/api/v1/cod/summary` | Vị thế tiền COD theo hub hoặc toàn quốc |
| `GET` | `/api/v1/driver/orders/{order_id}/vietqr` | Mã VietQR động cho một đơn COD |
| `POST` | `/api/v1/driver/orders/{order_id}/collect-cod` | Tài xế ghi nhận phương thức khách thanh toán |
| `GET` | `/api/v1/driver/shift-settlement/preview` | Tổng hợp ca hiện tại của tài xế |
| `POST` | `/api/v1/driver/shift-settlement/submit` | Tài xế nộp phiếu bàn giao quỹ |
| `GET` | `/api/v1/admin/cod/settlements` | Danh sách phiếu bàn giao quỹ |
| `POST` | `/api/v1/admin/cod/settlements/{id}/approve` | Thủ quỹ xác nhận đã nhận tiền mặt |
| `POST` | `/api/v1/admin/cod/settlements/{id}/reject` | Trả phiếu để tài xế nộp lại |
| `GET` | `/api/v1/admin/cod/ledger` | Bảng kê chi tiết đơn hàng COD |
| `GET` | `/api/v1/admin/cod/export` | Xuất bảng kê COD ra CSV UTF-8 BOM |

OpenAPI tương tác có tại [http://localhost:8000/docs](http://localhost:8000/docs).

Các endpoint Orders, Vehicles và Route Optimization yêu cầu header:

```text
Authorization: Bearer <access_token>
```

Quyền hiện tại:

| Role | Đọc Orders/Vehicles | Tạo/Xóa Orders/Vehicles | Optimize routes |
|---|---:|---:|---:|
| `ADMIN` | Có | Có | Có |
| `DISPATCHER` | Có | Có | Có |
| `DRIVER` | Có | Không | Không |

### Test login và endpoint được bảo vệ

```cmd
curl.exe -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"dispatcher@logiroute.vn\",\"password\":\"123456\"}"
```

Copy giá trị `access_token` trong response rồi dùng:

```cmd
curl.exe http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer <access_token>"
curl.exe http://localhost:8000/api/v1/orders -H "Authorization: Bearer <access_token>"
curl.exe -X POST http://localhost:8000/api/v1/routes/optimize -H "Authorization: Bearer <access_token>"
```

Không có token hoặc token không hợp lệ sẽ nhận `401`; user hợp lệ nhưng không đủ
role sẽ nhận `403`.

## Kiểm thử và quality gates

Backend:

```cmd
cd D:\Individual_Project\apps\api
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend:

```cmd
cd D:\Individual_Project\apps\web
npm test
npm run typecheck
npm run build
```

## Lưu ý OSRM

Frontend mặc định dùng `https://router.project-osrm.org`, là demo server công
cộng phù hợp cho phát triển và trình diễn. Nếu OSRM không phản hồi, giao diện tự
động dùng đường nối thẳng làm fallback và thông báo rõ trạng thái. Với production
hoặc lưu lượng lớn, nên tự host OSRM hoặc chọn nhà cung cấp routing có SLA, rate
limit và điều khoản sử dụng phù hợp.

## Trạng thái phát triển

- [x] Database models, seed data và CRUD API.
- [x] Dashboard, Orders và Fleet UI.
- [x] CVRP route optimization integration.
- [x] Leaflet/OpenStreetMap với OSRM road geometry.
- [x] Authentication và phân quyền RBAC cho API.
- [x] Đa depot, hiệu suất tài xế và trung tâm chẩn đoán hệ thống.
- [x] Thông báo khách hàng, chữ ký số và phiếu giao hàng in được.
- [x] Đối soát COD, VietQR động và bàn giao quỹ ca giao hàng.
- [x] Cổng thông tin công khai và đồng bộ giao diện toàn hệ thống.
- [ ] OSRM Table Service cho ma trận chi phí theo đường thực tế.
- [ ] Lưu lịch sử phiên tối ưu và theo dõi xe thời gian thực.
### Đối soát COD và VietQR

Tiền thu hộ lưu ở `NUMERIC(12, 0)` vì VNĐ không có đơn vị lẻ và việc đối soát
tiền mặt không được mang sai số dấu phẩy động. Mỗi đơn gắn với phiếu bàn giao
quỹ qua `orders.shift_settlement_id`, nên khi thủ quỹ duyệt thì hệ thống cập
nhật đúng tập đơn đó thay vì suy ra theo khoảng thời gian — cách suy diễn sẽ
cuốn nhầm đơn giao xen kẽ giữa lúc nộp và lúc duyệt.

Server tự tính số tiền phải thu; tài xế chỉ khai số thực nộp. Chênh lệch được
lưu lại để thủ quỹ nhìn thấy trước khi duyệt, vì đó mới là mục đích của việc
đối soát.

Mã VietQR dựng cục bộ theo chuẩn EMVCo của NAPAS kèm CRC-16/CCITT, thay vì nhúng
ảnh từ `img.vietqr.io`. Nhờ vậy phiếu giao hàng in ra vẫn có mã khi kho không có
mạng, và không gửi mã đơn hay số tiền ra bên thứ ba. Tài khoản thụ hưởng cấu
hình qua `VIETQR_BANK_CODE`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`.

### Hệ thống giao diện

Cổng thông tin `/` và console dùng chung một ngôn ngữ thiết kế: nền charcoal,
accent amber `#e8a838`, chữ IN HOA giãn rộng cho tiêu đề mục, đường kẻ mảnh thay
cho viền hộp, Heroicons và font Poppins.

`components/ui/Section.tsx` chứa các khối dùng lại (`SectionHeading`,
`HairlineGrid`, `DataFrame`, `PrimaryAction`). Thêm trang mới thì lắp các khối
này thay vì dựng lại.

Dải ảnh mở đầu mỗi trang lấy từ bảng `BANNERS` trong
`components/console/PageBanner.tsx`. Mỗi ảnh khai báo hệ số phơi sáng riêng vì
ảnh tối và ảnh sáng không thể dùng chung một lớp phủ. Muốn mỗi trang một ảnh
riêng thì bỏ file vào `public/landing/` rồi thêm một dòng vào bảng đó.

### Driver vehicle assignment

The admin console exposes `PATCH /api/v1/admin/users/{user_id}/vehicle` for
`ADMIN` and `DISPATCHER` users. It assigns an available `IDLE` vehicle to an
active driver and persists the optional operating area and dispatcher note.

### Dispatch geocoding and proof of delivery

Create `apps/web/.env.local` and set `GEOAPIFY_API_KEY` to enable
Vietnam-focused address suggestions. The key is used only by the authenticated
Next.js server-side proxy; it is never sent to the browser. Geoapify returns the
formatted address, latitude, and longitude in one autocomplete response, and
the UI binds those values atomically to the order payload. The visible
"Powered by Geoapify" attribution is required when using its free plan.
Dispatchers can still select coordinates by dropping the Leaflet marker when
the provider is unavailable.

POD images are validated as JPEG, PNG, or WebP (maximum 5 MB), saved under
`apps/api/uploads/pod`, and exposed through `/uploads/pod/{filename}`. The
database stores both the public URL and upload timestamp for audit display in
the Orders console. Configure `POD_UPLOAD_DIR` and `POD_PUBLIC_BASE_URL` for
each environment.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/drivers/available` | Admin, Dispatcher | List active drivers with an idle assigned vehicle |
| `GET` | `/api/v1/analytics/history` | Admin, Dispatcher | Aggregate route cost and sustainability history by day or week |
| `POST` | `/api/v1/orders` | Admin, Dispatcher | Create an unassigned `PENDING` order |
| `POST` | `/api/v1/orders/{order_id}/dispatch` | Admin, Dispatcher | Explicitly assign a pending/failed order to a ready driver |
| `POST` | `/api/v1/routes/dispatch` | Admin, Dispatcher | Optimize selected pending stops and atomically assign one route batch |
| `GET` | `/api/v1/driver/route` | Driver | Get the authenticated driver's sequenced route |
| `POST` | `/api/v1/driver/orders/{order_id}/pod` | Driver | Upload a validated POD image |
| `PATCH` | `/api/v1/driver/orders/{order_id}/status` | Driver | Mark a stop delivering, delivered, or failed |
