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
4. Start app
   - `npm run dev`

## UI routes
- `/dashboard` board/table tracker + weekly goal widgets
- `/criteria` manage job criteria for matching
- `/login` email/password auth UI

## Seed your resume JSON
- Use `supabase/resume.sample.json` as your template.
- Insert into `resume_versions` for your user ID:
  - `insert into resume_versions (user_id, label, resume_json) values ('<YOUR_AUTH_USER_ID>', 'default', '<JSON>'::jsonb);`

## Deploy
- Push to GitHub and import into Vercel
- Keep `vercel.json` as-is for Monday cron
- Set `CRON_SECRET` in Vercel and Supabase keys in env

## One-page resume draft
Store your resume in `resume_versions.resume_json`; draft generation and matching only reuse your existing bullets/skills.
