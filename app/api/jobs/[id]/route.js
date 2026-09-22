import { db } from '../../../../lib/db';

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const job = await db.job.findUnique({
      where: { id },
      include: { clips: { orderBy: { createdAt: 'asc' } } },
    });
    if (!job) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json(job);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Unable to load the job.' }, { status: 500 });
  }
}
