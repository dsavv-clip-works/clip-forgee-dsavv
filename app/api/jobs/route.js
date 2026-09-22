import { db } from '../../../lib/db';
import { validateVideoUrl } from '../../../lib/validation';

const ALLOWED_COUNTS = new Set([1, 3, 5, 10]);
const ALLOWED_DURATIONS = new Set([15, 30, 45, 60, 90]);

export async function POST(req) {
  try {
    const body = await req.json();
    const checked = validateVideoUrl(body.url);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

    const clipCount = Number(body.clipCount || 3);
    const duration = Number(body.duration || 45);
    if (!ALLOWED_COUNTS.has(clipCount) || !ALLOWED_DURATIONS.has(duration)) {
      return Response.json({ error: 'Invalid clip settings.' }, { status: 400 });
    }

    const job = await db.job.create({
      data: { url: checked.url, clipCount, duration, status: 'queued', progress: 0 },
    });

    const processUrl = new URL('/.netlify/functions/process-job-background', req.url);
    const trigger = await fetch(processUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    });

    if (!trigger.ok && trigger.status !== 202) {
      await db.job.update({ where: { id: job.id }, data: { status: 'failed', error: 'Could not start the video processor.' } });
      return Response.json({ error: 'Could not start the video processor.' }, { status: 502 });
    }

    return Response.json(job, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Unable to create the job.' }, { status: 500 });
  }
}
