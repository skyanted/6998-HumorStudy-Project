# Deploy this funnystudy project to Vercel

The application already uses the restored teaching database at
`https://pcqtipefoxzsdccgjwwa.supabase.co`. Reuse it for this deployment so the
existing test account, studies, and participation records remain available.
Do not run RESTORE.md again against this populated database.

The authoritative course setup files are `RESTORE.md` and `REPOSITORIES.md` in
`../supabase-teaching-data/`. Those names refer to files in the downloaded ZIP,
not the websites restore.md or repositories.md. Funnystudy uses Google sign-in.

## Vercel project

Import your own Git repository containing this modified original application,
or deploy this project directory using Vercel CLI. If importing a parent repo,
select the funnystudy directory containing this package.json as Root Directory.
Do not select the old standalone preview directory.

- Framework: Next.js
- Node.js: 24.x
- Install command: npm ci
- Build command: npm run build
- Output directory: leave the Next.js default

This app needs server rendering, server actions, and Auth callbacks. Do not
configure a static export. The local dev-server port 3002 is not a deployment setting.

## Environment variables

For the first stable deployment, add these variables to **Production**.
Copy the two public IDs/keys from the existing local configuration; do not put
.env.local into Git.

| Variable | Value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://pcqtipefoxzsdccgjwwa.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | The public publishable/anon key from this same project, matching .env.local |
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | The existing Google OAuth client ID, matching the enabled Supabase Google provider |
| NEXT_PUBLIC_SITE_URL | The full stable deployed origin, e.g. https://YOUR-PROJECT.vercel.app, with no /auth/callback suffix |

The app supports NEXT_PUBLIC_SUPABASE_ANON_KEY as an alternative, but only one
public-key variable is needed. Do not put a service-role key, database password,
or Google client secret in NEXT_PUBLIC variables. The Google client secret
belongs in the Supabase Google provider configuration.

If the Vercel domain is not yet known, create the project to obtain its domain,
then set NEXT_PUBLIC_SITE_URL and deploy/redeploy before testing login.
Changed variables apply to a new deployment, not an already built deployment.

Preview deployments need their own matching origin and permitted callback;
copying the Production SITE_URL to Preview will send users back to Production.
Local Development keeps http://localhost:3002 in .env.local.

## OAuth URLs

In Supabase > Authentication > URL Configuration:

- Site URL: https://YOUR-PROJECT.vercel.app
- Redirect URLs: https://YOUR-PROJECT.vercel.app/auth/callback
- Keep http://localhost:3002/auth/callback for local development.

In Google Auth Platform, keep the OAuth client's authorized redirect URI:
`https://pcqtipefoxzsdccgjwwa.supabase.co/auth/v1/callback`.
This is Google's return to Supabase, distinct from the application's callback.
If the Google OAuth app is in Testing, add the PM/testers as test users unless
the configured audience already grants them access.

## Verify after deployment

Sign in with your own account, complete/skip the existing onboarding prompts,
then check Current, Past, Calendar, Start/Continue study, completion stats,
Settings, and sign out. Check that login returns to the Vercel domain.
The existing shared Supabase copy provides the data; images still load from
external URLs. This deployment does not set up notification providers or cron.

References:
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/social-login/auth-google
