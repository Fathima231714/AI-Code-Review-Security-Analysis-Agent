# Python Secure Coding Rules

Use parameterized SQL calls such as `cursor.execute("select * from users where name = %s", (name,))`. Avoid f-strings, `%` formatting, or concatenation for SQL.

Do not call `eval`, `exec`, shell commands, or deserialization APIs on untrusted input. Prefer structured parsers and explicit allow lists.

Keep secrets out of Python files. Load them from environment variables or a vault and validate that required settings are present at startup.

Handle exceptions without exposing stack traces or internal paths to end users. Log detailed diagnostics on the server side.

When returning HTML, escape user-controlled data and use the template engine's auto-escaping features.
