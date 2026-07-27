# LogiRoute VN

Route optimization and logistics management platform for Vietnam.

## Stack

- `apps/web`: Next.js App Router dashboard.
- `apps/api`: FastAPI + SQLAlchemy 2.0 + psycopg.
- `core_engine`: Python route optimization workspace.
- `docker-compose.yml`: PostgreSQL 17 + PostGIS 3.5.

## Run locally

### 1. Start PostGIS

Host port `5433` is intentional: another PostgreSQL instance already uses
`5432` on this machine.

```powershell
cd D:\Individual_Project
docker compose up -d postgis
docker compose ps
```

### 2. Initialize the database and run FastAPI

```powershell
cd D:\Individual_Project\apps\api
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m scripts.init_db
uvicorn app.main:app --reload --port 8000
```

In another terminal, seed the demo dataset:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/seed
Invoke-RestMethod -Uri http://localhost:8000/api/v1/overview
```

API docs: <http://localhost:8000/docs>

### 3. Run Next.js

```powershell
cd D:\Individual_Project\apps\web
npm.cmd install
npm.cmd run dev
```

Open <http://localhost:3000> (or the port printed by Next.js if `3000` is in use).
The Dashboard fetches live KPI values from `/api/v1/overview`.

## Verification

```powershell
cd D:\Individual_Project\apps\api
.\.venv\Scripts\python.exe -m pytest -q

cd D:\Individual_Project\apps\web
npm.cmd run typecheck
npm.cmd run build
```

## API routes

- `GET /api/health`
- `GET /api/v1/overview`
- `GET|POST /api/v1/orders`
- `DELETE /api/v1/orders/{order_id}`
- `GET|POST /api/v1/vehicles`
- `DELETE /api/v1/vehicles/{vehicle_id}`
- `POST /api/v1/seed`
