# 🛡️ Security Policy

## Reporting Vulnerabilities

**DO NOT OPEN A PUBLIC GITHUB ISSUE** for security vulnerabilities.

If you discover a security bug or have concerns about the security of CityPulse, please report it via one of the following methods:

- **Private Disclosure**: Send a detailed report to `security@yourdomain.com`.
- **GitHub Private Reporting**: Use the "Report a vulnerability" button in the "Security" tab of this repository.

Please include:
- A description of the vulnerability.
- Steps to reproduce the issue (proof-of-concept).
- Potential impact.

---

## Deployment Security Checklist (Self-Hosters)

To ensure your private instance is secure, please verify the following:

1. **Environment Isolation**: Ensure your `.env` file is NOT world-readable and never committed to source control.
2. **JWT Secret**: Use a unique, high-entropy secret (32+ characters) for `JWT_SECRET`.
3. **Admin Codes**: Change `ADMIN_SECRET_CODE` and `SUPER_ADMIN_CODE` from their defaults.
4. **Supabase RLS**: Ensure Row Level Security (RLS) is enabled for all tables. The provided `sql/` scripts enable RLS by default.
5. **HTTPS**: Always run the production application behind a reverse proxy (like Nginx) with a valid SSL certificate (Let's Encrypt).
6. **Rate Limiting**: Review the `express-rate-limit` configurations in `server/index.js` to ensure they meet your production traffic needs.
7. **Service Key Protection**: Never expose the `SUPABASE_SERVICE_KEY` to the client-side code. It must stay strictly on the backend.
