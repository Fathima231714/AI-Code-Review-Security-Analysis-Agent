# Java Secure Coding Rules

Use `PreparedStatement` or safe repository parameters for database input. Never concatenate request parameters into SQL strings.

Validate file uploads by extension, content type where reliable, size, and destination path. Normalize paths and prevent path traversal.

Keep authentication and authorization checks in backend services or controllers. A frontend role check is only a usability hint.

Avoid logging passwords, tokens, session identifiers, personal data, or full request bodies.

For Spring Security, keep CSRF enabled for browser sessions unless the endpoint is truly stateless and protected by another suitable control.
