# RUN_CHECKLIST

## What this file contains
Copy-paste checklist to verify the app actually started and key services are reachable.


---

## 1) Run all services
From `e:/AI-CodeReview`:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-all.ps1
```

---

## 2) Verify logs were created/updated
Check that these files exist and have new timestamps:

- `e:/AI-CodeReview/logs\ai-service.log`
- `e:/AI-CodeReview/logs\springboot.log`

Commands:

```powershell
Get-ChildItem .\logs -Force | Sort-Object LastWriteTime -Descending | Select-Object Name,LastWriteTime,Length

# Quick tail (PowerShell 5+):
Get-Content .\logs\ai-service.log -Tail 80
Get-Content .\logs\springboot.log -Tail 80
```

---

## 3) Verify backend is reachable
```powershell
powershell -Command "(Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8080' -Method GET).StatusCode"
```


If the UI is served by Spring Boot, you should get HTML (status 200) or a redirect.

---

## 4) Verify ai-service is reachable
Check the knowledge search endpoint shape (example query):

```powershell
curl "http://127.0.0.1:8000/knowledge/search?q=sql%20injection"
```

If the endpoint returns JSON, the service is up.

---

## 5) If uploads are used: verify upload directory and file creation
Spring config shows upload-dir:

- `app.upload-dir=D:/code-review/uploads`

Check:

```powershell
Get-ChildItem "D:/code-review/uploads" -Force | Sort-Object LastWriteTime -Descending | Select-Object -First 20
```

Then upload a file in the UI and re-check for a newly created file.

---

## 6) Run-time review call smoke test (optional)
If your UI uses a `/review` call, verify ai-service endpoint is responding:

```powershell
curl -X POST http://127.0.0.1:8000/review -H "Content-Type: application/json" -d "{}"
```


If `{}` isn’t valid for your schema, the response should be a 4xx with an error message—still proof the server is reachable.


---

## Done condition
All of the following are true:
- both log files exist and show recent writes
- `http://localhost:8080` responds
- `http://127.0.0.1:8000` responds to the search endpoint
- (if you tested upload) a file appears under `D:/code-review/uploads`

