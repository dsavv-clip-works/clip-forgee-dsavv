# ClipForge

ClipForge turns a direct video URL into short vertical MP4 clips.

## Netlify architecture

- Next.js 15 App Router
- PostgreSQL + Prisma for job state
- Netlify Background Function for processing
- FFmpeg for 9:16 rendering
- Netlify Blobs for persistent clip files

## Current clip selection

The processor currently uses deterministic, evenly spaced excerpts. AI transcription/semantic ranking is intentionally not enabled until a model-backed selector is added.

## Deploy

See `DEPLOY.md` for the Netlify setup steps.

## Before going live

Set `DATABASE_URL` in Netlify and initialize the Prisma schema. Netlify Blobs handles rendered clip storage automatically. The processor requires direct downloadable video URLs and currently uses evenly spaced excerpts rather than semantic AI ranking.
