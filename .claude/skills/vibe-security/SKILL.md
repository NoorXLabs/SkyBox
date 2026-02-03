---
name: vibe-security
description: Secure coding guide for web applications. Use when writing, reviewing, or modifying any web application code to ensure security best practices are followed. Triggers include any work involving authentication, authorization, user input handling, file uploads, API endpoints, database queries, redirects, session management, or security headers. Also use when generating new endpoints, forms, or features that accept user input or manage access control.
---

# Secure Coding Guide for Web Applications

Approach all code from a **bug hunter's perspective** — make applications as secure as possible without breaking functionality.

## Key Principles

- **Defense in depth**: Never rely on a single security control
- **Fail securely**: When something fails, fail closed (deny access)
- **Least privilege**: Grant minimum permissions necessary
- **Input validation**: Never trust user input; validate everything server-side
- **Output encoding**: Encode data appropriately for the rendering context

## Security Audit Checklist

When writing or reviewing code, check each applicable category:

### Access Control

- Verify user owns the resource on every request (not just route-level)
- Use UUIDs instead of sequential IDs (prevents enumeration)
- Check organization membership for multi-tenant apps
- Re-validate permissions after privilege changes
- Return 404 (not 403) for unauthorized resources to prevent enumeration
- Revoke tokens/sessions immediately on account removal or deactivation

**For detailed patterns and implementation**: See [references/access-control.md](references/access-control.md)

### Client-Side Security

**XSS Prevention:**
- Sanitize every user-controllable input (direct and indirect)
- Use context-specific output encoding (HTML, JS, URL, CSS)
- Implement Content Security Policy headers
- Avoid `unsafe-inline` and `unsafe-eval` for scripts

**CSRF Prevention:**
- Protect all state-changing endpoints with CSRF tokens
- Include pre-auth endpoints (login, signup, password reset, OAuth callbacks)
- Set SameSite cookie attribute; combine with CSRF tokens for defense in depth
- Never perform state changes on GET requests

**Secrets:**
- No API keys, secrets, or sensitive PII in client-side code
- Check JS bundles, source maps, HTML comments, hidden fields, hydration data
- Watch for build-tool-exposed env vars (NEXT_PUBLIC_*, REACT_APP_*)

**For detailed bypass techniques, code examples, and checklists**: See [references/client-side-bugs.md](references/client-side-bugs.md)

### Server-Side Security

**SSRF Prevention:**
- Validate URL scheme is HTTP/HTTPS only
- Resolve DNS and validate IP is not private/internal/cloud metadata
- Block `169.254.169.254` and other cloud metadata endpoints
- Limit or validate redirect following

**File Upload Security:**
- Validate file extension against allowlist AND magic bytes
- Rename files to random UUIDs; store outside webroot
- Set per-file-type size limits server-side
- Serve with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`

**SQL Injection:**
- Always use parameterized queries (prepared statements)
- Whitelist ORDER BY columns and table/column names (can't parameterize these)
- Escape LIKE wildcards (%, _)
- Never expose SQL errors to users

**XXE Prevention:**
- Disable DTD processing and external entity resolution
- Consider JSON instead of XML where possible
- Remember: DOCX, XLSX, PPTX, SVG are XML-based

**Path Traversal:**
- Never use user input directly in file paths
- Canonicalize paths and validate against base directory
- Prefer indirect references (map keys to paths)

**For detailed attack tables, prevention code, and checklists**: See [references/server-side-bugs.md](references/server-side-bugs.md)

### Open Redirects

- Validate redirect URLs against domain allowlist
- Prefer relative URLs only; validate path starts with `/` without `//`
- Block bypass techniques: @ symbol, protocol tricks, double encoding, unicode homographs

**For bypass technique table and IDN protection**: See [references/open-redirects.md](references/open-redirects.md)

### Password Security

- Minimum 8 characters (12+ recommended), no low maximum
- Use Argon2id, bcrypt, or scrypt — never MD5, SHA1, or plain SHA256

### Security Headers

Include in all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-store  (for sensitive pages)
```

## General Rules

1. Validate all input server-side — never trust client-side validation alone
2. Use parameterized queries — never concatenate user input into queries
3. Encode output contextually — HTML, JS, URL, CSS contexts need different encoding
4. Apply authentication AND authorization checks on every endpoint
5. Handle errors securely — don't leak stack traces or internal details
6. Keep dependencies updated — track vulnerable dependencies
7. When unsure, choose the more restrictive option and document the security consideration
