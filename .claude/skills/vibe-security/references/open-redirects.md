# Open Redirect

Any endpoint accepting a URL for redirection must be protected against open redirect attacks.

## Protection Strategies

1. **Allowlist Validation**
   ```
   allowed_domains = ['yourdomain.com', 'app.yourdomain.com']
   
   function isValidRedirect(url):
       parsed = parseUrl(url)
       return parsed.hostname in allowed_domains
   ```

2. **Relative URLs Only**
   - Only accept paths (e.g., `/dashboard`) not full URLs
   - Validate the path starts with `/` and doesn't contain `//`

3. **Indirect References**
   - Use a mapping instead of raw URLs: `?redirect=dashboard` → lookup to `/dashboard`

## Bypass Techniques to Block

| Technique | Example | Why It Works |
|-----------|---------|--------------|
| @ symbol | `https://legit.com@evil.com` | Browser navigates to evil.com with legit.com as username |
| Subdomain abuse | `https://legit.com.evil.com` | evil.com owns the subdomain |
| Protocol tricks | `javascript:alert(1)` | XSS via redirect |
| Double URL encoding | `%252f%252fevil.com` | Decodes to `//evil.com` after double decode |
| Backslash | `https://legit.com\@evil.com` | Some parsers normalize `\` to `/` |
| Null byte | `https://legit.com%00.evil.com` | Some parsers truncate at null |
| Tab/newline | `https://legit.com%09.evil.com` | Whitespace confusion |
| Unicode normalization | `https://legіt.com` (Cyrillic і) | IDN homograph attack |
| Data URLs | `data:text/html,<script>...` | Direct payload execution |
| Protocol-relative | `//evil.com` | Uses current page's protocol |
| Fragment abuse | `https://legit.com#@evil.com` | Parsed differently by different libraries |

## IDN Homograph Attack Protection

- Convert URLs to Punycode before validation
- Consider blocking non-ASCII domains entirely for sensitive redirects
