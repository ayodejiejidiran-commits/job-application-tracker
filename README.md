# Job Application Tracker (Vercel + Supabase)

Free starter infrastructure for tracking and drafting job applications across LinkedIn, Indeed, and Glassdoor.

## What it does
- Tracks jobs and application statuses: `DRAFT`, `READY_TO_REVIEW`, `APPLIED`, `ARCHIVED`
- Matches job descriptions to your resume (score + matched/missing keywords + resume evidence)
- Blends resume match with your saved job criteria (titles, locations, include/exclude keywords, years range)
- Generates non-exaggerated drafts from your resume content only
- Enforces one-page resume limits during draft generation
- Shows applications in board and table views, with filters and weekly progress
- Sends Monday reminders (5-10 applications goal) via Vercel Cron + in-app notifications
- Includes a Chrome extension skeleton to save jobs into your tracker
- Zero-manual-entry discovery finds job posting URLs from compliant APIs (Remotive + Arbeitnow)

## Important
This project does **not** auto-submit applications on job boards.
It keeps you in review control and supports one-click workflow from the tracker (`Open Apply` + review draft + status update).

## Setup
1. Install deps
   - `npm install`
2. Create env file
   - `cp .env.example .env.local`
   - Fill values from your Supabase project
3. Run SQL
   - Execute `supabase/schema.sql` in Supabase SQL editor
   - If upgrading an existing install, rerun it to add discovery tables and constraints
4. Start app
   - `npm run dev`

## Zero-manual-entry discovery
- Dashboard now includes `Find Jobs` and `Refresh Listings` buttons.
- The feature uses resume-driven criteria and calls compliant public sources:
  - Remotive Jobs API
  - USAJobs API (optional; enabled when env is set)
  - Arbeitnow Job Board API (excluded automatically in US-only mode)
- It inserts new job URLs into `jobs` and creates `DRAFT` applications automatically.
- Discovery enforces `posted_at` within the last 14 days.
- Discovery filters to United States jobs only (including US-remote jobs) and excludes non-English postings.
- No server-side scraping of LinkedIn/Indeed/Glassdoor is used.
- Manual trigger endpoint: `POST /api/jobs/discover`
- Daily cron endpoint: `GET /api/cron/daily-discover`

## UI routes
- `/dashboard` board/table tracker + weekly goal widgets
- `/criteria` manage job criteria for matching
- `/login` email/password auth UI

## Dashboard filters
- United States only (default on)
- Remote only
- City filter (for on-site/hybrid city targeting)
- Last 14 days (default on)

## Discovery rate limit
- Default cooldown is `1` hour (`DISCOVERY_RATE_LIMIT_HOURS`).
- Manual `Find Jobs` requests use `force=true` to bypass cooldown for on-demand refresh.

## Seed your resume JSON
- Use `supabase/resume.sample.json` as your template.
- Insert into `resume_versions` for your user ID:
  - `insert into resume_versions (user_id, label, resume_json) values ('<YOUR_AUTH_USER_ID>', 'default', '<JSON>'::jsonb);`
- Or upload a PDF in the app:
  - Go to `/criteria`
  - Use **Resume Upload**
  - The app extracts `resume_json`, stores it in `resume_versions`, and auto-creates `job_criteria` if missing.
- If no resume is uploaded, discovery auto-falls back to `DEFAULT_RESUME_JSON_PATH` (`./supabase/resume.sample.json` by default).

## Deploy
- Push to GitHub and import into Vercel
- Keep `vercel.json` as-is for Monday cron
- Set `CRON_SECRET` in Vercel and Supabase keys in env
- Keep `vercel.json` as-is for:
  - daily discover cron (`/api/cron/daily-discover`)
  - Monday reminder cron (`/api/cron/monday-reminder`)

## Discovery env vars
- `DISCOVERY_RATE_LIMIT_HOURS` default `1`
- `DISCOVERY_US_ONLY` default `true`
- `DISCOVERY_USE_RESUME_PROFILE_ONLY` default `true`
- `RESUME_PDF_DIR` default `/mnt/data`
- `RESUME_PDF_PATHS` optional comma-separated absolute PDF paths
- `DEFAULT_RESUME_JSON_PATH` default `./supabase/resume.sample.json`
- `USAJOBS_USER_AGENT_EMAIL` optional; enables USAJobs source by default
- `USAJOBS_AUTH_KEY` optional key for USAJobs requests

## Add new discovery source
- Implement source adapter under `lib/discovery/sources/`
- Return normalized jobs with valid HTTPS URLs
- Register source in `lib/discovery/discoverJobs.ts`

## One-page resume draft
Store your resume in `resume_versions.resume_json`; draft generation and matching only reuse your existing bullets/skills.
