# Milestone 1 Study Notes

## OWASP Topics

- SQL Injection: avoid string-built queries; use parameters.
- XSS: escape output and avoid unsafe HTML sinks.
- CSRF: keep CSRF tokens and SameSite cookie controls for browser forms.
- Broken Access Control: enforce authorization checks on every protected backend action.
- Hardcoded Secrets: keep passwords, API keys, and tokens out of source code.

## Secure Coding Guidelines

- Validate inputs at trust boundaries.
- Use framework security features instead of custom security logic where possible.
- Keep secrets in environment variables or a secret manager.
- Log enough for debugging without logging sensitive data.
- Fail safely and avoid exposing stack traces to users.

## Code Smells

- Long methods and repeated code.
- Hidden side effects.
- Magic strings and numbers.
- Overly broad exception handling.
- Business logic mixed directly into controllers.

## RAG Architecture

RAG retrieves relevant knowledge-base chunks before calling the LLM. In this project, OWASP and secure coding notes are chunked into `vector-store.json`; the AI service retrieves the most relevant chunks and includes them in the Ollama prompt so findings are grounded in project-approved security guidance.
