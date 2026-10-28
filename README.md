# Cloud Task Manager
Cloud Computing Lab project for Muhammad Ismail, K22SW034.
React UI, Supabase Authentication and PostgreSQL database, Vercel deployment.

## Current status
Source code and database schema prepared. Supabase connection, browser testing,
two-account security tests and live deployment still need to be completed.
No fake users or simulated cloud data are included. Without configuration the app
shows a setup screen. The final report must use actual observed results.

## 1. Run locally on Windows
Install Node.js LTS (22.12 or newer; Node 24 LTS is suitable).
Extract this folder, open it in VS Code, then open a CMD terminal here:
    node --version
    npm --version
    npm ci
Copy .env.example to .env.local. Supply the two values described below.
    npm run dev
Open the localhost URL printed by Vite, normally http://127.0.0.1:5173.
Keep this terminal running. Ctrl+C stops it.

## 2. Configure Supabase
1. Create a free project at https://supabase.com/dashboard .
2. Keep the database password private.
3. Open SQL Editor. Paste all of supabase/schema.sql and run ONCE in a new project.
4. Copy the project URL and PUBLIC publishable key from the project connection/API settings.
   A legacy public anon key is also supported. NEVER use a secret/service_role key.
5. Put these in .env.local:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-public-key
6. In Authentication URL configuration, set Site URL to your local URL for local
   testing and allow that URL as a redirect. After deployment change Site URL
   to the live HTTPS address and allow the exact live origin as a redirect too.
7. Keep email confirmation enabled. Sign up with a real accessible email,
   open the confirmation email, then return to sign in.
8. Restart npm run dev after changing environment variables.

The VITE values are public browser configuration, not authorization secrets.
Row Level Security in schema.sql enforces ownership for all four CRUD actions.
Do not disable RLS. Do not put passwords in source files or screenshots.
Passwords are handled by Supabase Auth, never stored in the tasks table.

## 3. Use the app
Create account -> confirm email -> sign in -> add a task -> edit it -> complete it.
Search and filters apply to your loaded tasks. Refresh fetches the latest records.
For another device, sign in to the same account and press Refresh.
Cross-device changes are fetched on login/Refresh; realtime push is not implemented.
Delete asks for confirmation. Due dates are calendar dates, not UTC timestamps.
Signing out hides the workspace. Data remains in the cloud.

## 4. Publish to GitHub and Vercel
1. Create a NEW GitHub repository named CloudTaskManager.
2. Upload source files including package-lock.json, .gitignore and .env.example.
   Do not upload node_modules, dist, .env.local or real credentials.
3. Sign in at https://vercel.com with GitHub and import this repository.
4. Choose Vite. Build: npm run build. Output: dist.
5. Add both VITE_SUPABASE_* environment values to the Vercel Production environment.
   Add to Preview only if you deliberately need preview deployments.
6. Deploy. Add the returned URL to Supabase auth URL configuration.
7. Test signup, login and CRUD on the deployed URL, then on a second device.
8. Changing Vercel environment values requires a fresh deployment.
No purchased domain is needed. Use the generated Vercel address.
Free services have quotas and Supabase free projects can pause after inactivity.
Check the app before presenting.

## 5. Report and evidence
docs/REPORT_OUTLINE.md is the report plan, not the final submission.
docs/TEST_PLAN.md records tests still to perform.
Save screenshots only after real tests. The completed Word report will include
actual results, database evidence, live URL and GitHub URL.

## Files
src/main.jsx      UI, authentication, task operations and validation
src/style.css     responsive layout and visual styling
supabase/schema.sql  table, constraints, index and ownership policies
.env.example      public connection variable template
vercel.json       deployment build settings
package-lock.json reproducible dependency versions

## Scope
This is a small academic application. No attachments, task sharing, admin roles,
password-reset UI, realtime subscriptions or pagination are included.
Fetches up to the configured Supabase API row limit; intended for a small dataset.

## References
https://react.dev/
https://vite.dev/guide/
https://supabase.com/docs/reference/javascript/auth-signup
https://supabase.com/docs/reference/javascript/auth-signinwithpassword
https://supabase.com/docs/guides/database/postgres/row-level-security
https://vercel.com/docs/frameworks/frontend/vite
