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
| Test | Pytest, Vitest |
| Local infrastructure | Docker Compose |

## Cấu trúc monorepo

```text
logi-route-vn/
├── apps/
│   ├── api/                  # FastAPI, models, schemas, REST routers
│   └── web/                  # Next.js dashboard, Orders, Fleet, Map
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

Mở URL do Next.js in ra, sau đó kiểm tra:

- `/dashboard` — KPI tổng quan.
- `/orders` — tạo, xem và xóa đơn hàng.
- `/fleet` — tạo, xem và xóa xe.
- `/map` — tối ưu và hiển thị tuyến giao hàng thực tế.

## API endpoints

Base URL local: `http://localhost:8000`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/health` | Kiểm tra trạng thái API |
| `POST` | `/api/v1/auth/login` | Đăng nhập và nhận JWT access token |
| `GET` | `/api/v1/auth/me` | Lấy thông tin user hiện tại |
| `GET` | `/api/v1/overview` | KPI thực tế từ database |
| `GET` | `/api/v1/orders` | Danh sách đơn hàng |
| `POST` | `/api/v1/orders` | Tạo đơn hàng mới |
| `DELETE` | `/api/v1/orders/{order_id}` | Xóa đơn hàng |
| `GET` | `/api/v1/vehicles` | Danh sách đội xe |
| `POST` | `/api/v1/vehicles` | Tạo xe mới |
| `DELETE` | `/api/v1/vehicles/{vehicle_id}` | Xóa xe |
| `POST` | `/api/v1/seed` | Tạo dữ liệu demo TP.HCM |
| `POST` | `/api/v1/seed/users` | Tạo tài khoản demo local |
| `POST` | `/api/v1/routes/optimize` | Phân tuyến các đơn `PENDING` |

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
- [ ] OSRM Table Service cho ma trận chi phí theo đường thực tế.
- [ ] Lưu lịch sử phiên tối ưu và theo dõi xe thời gian thực.
