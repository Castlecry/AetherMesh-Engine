# ============================================================
# AetherMesh Engine — Docker Dev Helper (PowerShell)
#
# Usage:
#   .\docker-dev.ps1 build       Build Wasm only
#   .\docker-dev.ps1 up          Start backend + frontend
#   .\docker-dev.ps1 all         Build Wasm + start all services
#   .\docker-dev.ps1 down        Stop everything
#   .\docker-dev.ps1 rebuild     Rebuild Wasm + restart all
#   .\docker-dev.ps1 logs        Tail all logs
#   .\docker-dev.ps1 status      Show running containers
# ============================================================
param (
    [Parameter(Position = 0)]
    [ValidateSet("build", "up", "all", "down", "rebuild", "logs", "status")]
    [string]$Command = "up"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

switch ($Command) {
    "build" {
        Write-Host "[docker-dev] Building Wasm module..." -ForegroundColor Cyan
        docker compose --profile build run --rm wasm-builder
        Write-Host "[docker-dev] Wasm build complete." -ForegroundColor Green
    }
    "up" {
        Write-Host "[docker-dev] Starting backend + frontend..." -ForegroundColor Cyan
        docker compose up -d backend frontend
        Write-Host "[docker-dev] Backend  → http://localhost:3001" -ForegroundColor Green
        Write-Host "[docker-dev] Frontend → http://localhost:3000" -ForegroundColor Green
    }
    "all" {
        Write-Host "[docker-dev] Building Wasm module..." -ForegroundColor Cyan
        docker compose --profile build run --rm wasm-builder
        Write-Host "[docker-dev] Starting all services..." -ForegroundColor Cyan
        docker compose up -d backend frontend
        Write-Host "[docker-dev] Backend  → http://localhost:3001" -ForegroundColor Green
        Write-Host "[docker-dev] Frontend → http://localhost:3000" -ForegroundColor Green
    }
    "down" {
        Write-Host "[docker-dev] Stopping all services..." -ForegroundColor Cyan
        docker compose down
        Write-Host "[docker-dev] All stopped." -ForegroundColor Green
    }
    "rebuild" {
        Write-Host "[docker-dev] Rebuilding Wasm..." -ForegroundColor Cyan
        docker compose --profile build run --rm wasm-builder
        Write-Host "[docker-dev] Rebuilding backend + frontend images..." -ForegroundColor Cyan
        docker compose build backend frontend
        Write-Host "[docker-dev] Restarting services..." -ForegroundColor Cyan
        docker compose up -d backend frontend
        Write-Host "[docker-dev] Rebuild complete." -ForegroundColor Green
    }
    "logs" {
        docker compose logs -f backend frontend
    }
    "status" {
        docker compose ps
    }
}
