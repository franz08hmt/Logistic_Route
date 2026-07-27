# LogiRoute VN API

FastAPI service for orders, fleet, and route optimization.

## Run locally

```powershell
cd D:\Individual_Project\apps\api
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m scripts.init_db
uvicorn app.main:app --reload --port 8000
```

The database URL is read from `DATABASE_URL`. The default matches the local
PostGIS service in the root compose file:

```text
postgresql+psycopg://logiroute:logiroute_dev_password_change_me@localhost:5433/logiroute
```

## API smoke checks

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/seed
Invoke-RestMethod -Uri http://localhost:8000/api/v1/overview
Invoke-RestMethod -Uri http://localhost:8000/api/v1/orders
Invoke-RestMethod -Uri http://localhost:8000/api/v1/vehicles
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/routes/optimize
```

OpenAPI docs: <http://localhost:8000/docs>
