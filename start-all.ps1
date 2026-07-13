$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null

Start-Process -FilePath powershell -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd '$root\ai-service'; `$env:OLLAMA_MODEL='llama3'; python -m uvicorn app:app --host 127.0.0.1 --port 8000 *> '$logs\ai-service.log'"
) -WindowStyle Hidden

Start-Process -FilePath powershell -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd '$root\springboot-backend\code-review-ai'; .\mvnw.cmd spring-boot:run *> '$logs\springboot.log'"
) -WindowStyle Hidden

Write-Host "Starting AI Code Review project..."
Write-Host "Open: http://localhost:8080"
Write-Host "Logs: $logs"
