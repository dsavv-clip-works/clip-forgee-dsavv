# ClipForge — Netlify deployment

This version is adapted for Netlify. The old Redis + Docker worker path is no longer required for production deployment.

## What runs on Netlify

- Next.js App Router web application
- Next.js API routes for creating and reading jobs
- Netlify Background Function for video processing
- FFmpeg bundled through `ffmpeg-static`
- Netlify Blobs for persistent MP4 clip storage
- Prisma + hosted PostgreSQL for job/clip metadata

Netlify supports Next.js App Router and route handlers through its OpenNext adapter. Background Functions can run for up to 15 minutes, which is why the video processor uses that model. citeturn0search0turn0search2

## 1. Create a PostgreSQL database

Use a hosted PostgreSQL provider such as Neon, Supabase, Railway, or another managed PostgreSQL service.

Copy its connection string into Netlify as:

`DATABASE_URL`

Use a pooled connection string if your provider offers one, because serverless deployments can create many short-lived database connections.

## 2. Push this folder to GitHub

Upload the contents of this project to a GitHub repository.

## 3. Create the Netlify site

In Netlify:

1. Add a new site from Git.
2. Select the repository.
3. Netlify will read `netlify.toml`.
4. Build command: `npx prisma generate && next build`
5. Publish directory: `.next`

Netlify's current Next.js integration supports the App Router and route handlers without a custom Next.js adapter configuration. citeturn0search0turn0search10

## 4. Add environment variables

In Netlify Project configuration → Environment variables, add:

`DATABASE_URL`

Optional AI variables are included for future semantic clip selection:

`AI_API_KEY`
`AI_BASE_URL`
`AI_MODEL`
`AI_TRANSCRIBE_MODEL`

Do not put production secrets in `netlify.toml` or commit them to Git. Netlify environment variables are injected into functions at deploy time. citeturn0search8

## 5. Initialize the database

After the first deploy, run Prisma migrations against your hosted database from a local environment or CI:

`npx prisma db push`

For a production migration workflow, use Prisma migrations instead of `db push` once the schema is stable.

## 6. Netlify Blobs

No S3/R2 credentials are required for this version. The processor stores generated MP4s in the `clipforge-clips` Netlify Blobs store and the download function reads them back.

Netlify Blobs supports persistent site-wide objects and files up to 5 GB per object. citeturn1search1

## Important limitations

### Direct video URLs only

The input must point to a directly downloadable video file. A normal YouTube/TikTok/Instagram webpage URL is not automatically converted into an MP4.

### Processing limit

The background processor has a 15-minute execution limit. Large videos can exceed that limit. Netlify documents 15 minutes as the maximum background execution time. citeturn0search2turn0search4

### Source-size limit

This build caps source downloads at 400 MB to avoid exhausting serverless temporary storage and memory while processing.

### Clip selection

The current selector still creates evenly distributed excerpts. It is not yet a semantic/AI ranking system, so the UI should not be interpreted as having true AI highlight detection yet.

## Local development

Install dependencies and run:

`npm install`

`npx prisma generate`

`npm run dev`

For production-like Netlify testing, use the Netlify CLI:

`npx netlify dev`

The old `docker-compose.yml` and Python worker are retained as a legacy/local reference, but they are not part of the Netlify production path.
