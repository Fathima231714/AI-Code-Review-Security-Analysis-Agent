# OWASP Top 10 Secure Coding Notes

## Broken Access Control
Every request that reads, updates, creates, or deletes protected data must check the current user's permission on the server. Do not trust hidden fields, client-side route guards, or user supplied identifiers. Prefer deny-by-default authorization rules and object-level checks.

## Injection
SQL, NoSQL, OS command, LDAP, and template injection happen when untrusted input is interpreted as a command or query. Use parameterized queries, safe ORM APIs, allow-list validation, and output encoding. Avoid building SQL with string concatenation or formatting.

## Cross-Site Scripting
XSS happens when untrusted content is rendered as executable browser code. Escape output by context, sanitize rich HTML with a trusted sanitizer, avoid direct `innerHTML`, and use framework rendering APIs safely.

## Cross-Site Request Forgery
CSRF tricks an authenticated browser into sending unwanted state-changing requests. Use CSRF tokens, SameSite cookies, origin checks, and avoid disabling framework CSRF protections for browser-facing forms.

## Hardcoded Secrets
Secrets in source code, configuration committed to git, logs, or client bundles can be stolen and reused. Store secrets in environment variables or a secret manager, rotate exposed credentials, and scan commits before merging.
