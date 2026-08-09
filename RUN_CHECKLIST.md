# Run checklist

## Start

From `D:\AI-CodeReview`:

```powershell
docker compose up --build -d
```

The first AI-service build downloads ML/RAG packages and can take several minutes. Check progress with:

```powershell
Get-Content .\logs\docker-ai-build.log -Tail 50
```

## Verify

```powershell
docker compose ps
docker compose logs --tail 80 ai-service
Invoke-WebRequest http://localhost:8000/ | Select-Object StatusCode, Content
Invoke-WebRequest http://localhost:8080/ | Select-Object StatusCode
```

Expected services are `mysql`, `ai-service`, `backend`, and `frontend`. Open http://localhost:5173 once all are running.

## Demonstration test

1. Register or sign in at the portal.
2. Paste either a Java or Python sample. The language label should update automatically from the syntax.
3. Select **Validate Code**, then **Run AI Review**.
4. Confirm that findings, remediation snippets, severity cards, and the Security Radar appear.
5. Ask the assistant about a finding, e.g. `Explain F-001 and give me a safe Java fix`.
6. Download HTML or PDF report.

## Stop

```powershell
docker compose down
```

This preserves MySQL, uploads, and the RAG index. To remove all persistent project data intentionally, run `docker compose down -v`.

