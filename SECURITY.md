# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | ✅ Active  |
| < 3.0   | ❌ EOL     |

## Reporting a Vulnerability

If you discover a security vulnerability in CityPulse, please **do NOT open a public GitHub Issue**.

Instead, please report it privately via one of these channels:

1. **GitHub Security Advisories** — click "Report a vulnerability" in the Security tab
2. **Email** — contact the maintainer directly (see GitHub profile)

Please include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to respond within **72 hours** and issue a patch within **7 days** for critical issues.

## Security Best Practices for Self-Hosters

When deploying CityPulse, ensure you:

- [ ] Generate a strong `JWT_SECRET` (minimum 64 bytes): `openssl rand -base64 64`
- [ ] Use unique, random `ADMIN_SECRET_CODE` and `SUPER_ADMIN_CODE`
- [ ] Enable Supabase RLS (all policies are in `sql/06_rls_policies.sql`)
- [ ] Keep `SUPABASE_SERVICE_KEY` confidential — it bypasses RLS
- [ ] Configure `CLIENT_URL` to your exact production domain (CORS protection)
- [ ] Use HTTPS in production (Render/Vercel handle this automatically)
- [ ] Rotate your Supabase service key regularly via the Supabase dashboard
- [ ] Set `NODE_ENV=production` in your server environment

## Known Design Decisions

- The `exec_sql` Supabase RPC function uses string interpolation for the HTTP bridge. This is intentional but restricts the function to the `service_role` only (never exposed to client).
- JWT tokens have a 30-day expiry. Consider implementing refresh token rotation for production at scale.
