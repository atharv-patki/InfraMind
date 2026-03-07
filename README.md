## InfraMind AI - Intelligent Cloud Infrastructure Monitoring

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

To run the devserver:
```
npm install
npm run dev
```

## Welcome Email Setup (Optional)

Signup can send a professional welcome email via Resend.

1. Local dev (`npm run dev`) setup:
```
Copy-Item .dev.vars.example .dev.vars
```
Then edit `.dev.vars` and set `RESEND_API_KEY`.

2. Cloud deploy setup:
```
npx wrangler secret put RESEND_API_KEY
```

3. Set sender/base URL vars (`.dev.vars` for local or `wrangler.json` `vars` for deploy):
```
WELCOME_EMAIL_FROM="InfraMind AI <onboarding@resend.dev>"
WELCOME_EMAIL_REPLY_TO="support@inframind.ai"
APP_BASE_URL="http://127.0.0.1:5173"
```

If `RESEND_API_KEY` is not set, signup still works and email sending is skipped.
If you use `onboarding@resend.dev`, delivery can be restricted by your Resend account mode. If mail does not arrive, use a verified sender domain and check spam.
