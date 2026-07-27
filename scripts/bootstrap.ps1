param(
    [string]$ProjectPath = (Join-Path (Get-Location) "logi-route-vn"),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$directories = @(
    "apps/web/app",
    "apps/web/components",
    "apps/api/app/api",
    "apps/api/app/core",
    "core_engine",
    "tasks"
)

foreach ($directory in $directories) {
    New-Item -ItemType Directory -Force -Path (Join-Path $ProjectPath $directory) | Out-Null
}

function Write-Template([string]$RelativePath, [string]$Content) {
    $target = Join-Path $ProjectPath $RelativePath
    if ($Force -or -not (Test-Path $target)) {
        Set-Content -Path $target -Value $Content -Encoding utf8
        Write-Host "Created $target"
    } else {
        Write-Host "Skipped $target (already exists; use -Force to overwrite)"
    }
}

Write-Template "README.md" @'
# LogiRoute VN

Monorepo starter for a Next.js frontend, FastAPI backend, route engine, and PostGIS.

Run `docker compose up -d postgis`, then run the web and API apps from their directories.
'@

Write-Template "apps/web/package.json" @'
{
  "name": "@logiroute/web",
  "version": "0.1.0",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": { "next": "16.2.11", "react": "19.2.8", "react-dom": "19.2.8" },
  "devDependencies": { "@types/node": "20.17.0", "@types/react": "19.0.0", "@types/react-dom": "19.0.0", "typescript": "5.7.2" },
  "overrides": { "postcss": "8.5.18", "sharp": "0.35.3" }
}
'@

Write-Template "apps/api/app/main.py" @'
from fastapi import FastAPI

app = FastAPI(title="LogiRoute VN API", version="0.1.0")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "logiroute-api"}
'@

Write-Template "docker-compose.yml" @'
services:
  postgis:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_DB: logiroute
      POSTGRES_USER: logiroute
      POSTGRES_PASSWORD: logiroute_dev_password_change_me
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
volumes:
  postgres_data:
'@

Write-Host "Bootstrap complete: $ProjectPath"

