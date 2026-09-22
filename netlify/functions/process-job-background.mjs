import { getStore } from '@netlify/blobs';
import { db } from '../../lib/db.js';
import { validateVideoUrl } from '../../lib/validation.js';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_SOURCE_BYTES = 400 * 1024 * 1024;
const STORE = 'clipforge-clips';

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${stderr}`)));
  });
}

async function setJob(id, data) {
  await db.job.update({ where: { id }, data });
}

async function downloadVideo(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Video download failed (${response.status}).`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_SOURCE_BYTES) throw new Error('The source video is too large. Maximum supported size is 400 MB.');

  const file = createWriteStream(destination);
  const reader = response.body.getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) throw new Error('The source video is too large. Maximum supported size is 400 MB.');
      if (!file.write(Buffer.from(value))) await new Promise(resolve => file.once('drain', resolve));
    }
  } finally {
    file.end();
  }
  await new Promise((resolve, reject) => {
    file.on('finish', resolve);
    file.on('error', reject);
  });
}

async function getDuration(source, fallback) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-i', source], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => stderr += chunk.toString());
    child.on('error', () => resolve(fallback));
    child.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) return resolve(fallback);
      const value = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      resolve(Number.isFinite(value) && value > 0 ? value : fallback);
    });
  });
}

export default async function handler(request) {
  let jobId;
  try {
    ({ jobId } = await request.json());
    if (!jobId) throw new Error('Missing job ID.');

    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found.');

    const checked = validateVideoUrl(job.url);
    if (!checked.ok) throw new Error(checked.error);

    await setJob(jobId, { status: 'processing', progress: 5, error: null });

    const workDir = join(tmpdir(), `clipforge-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const source = join(workDir, 'source.mp4');
    const store = getStore(STORE);

    try {
      await downloadVideo(checked.url, source);
      const sourceStats = await stat(source);
      if (sourceStats.size === 0) throw new Error('The downloaded video was empty.');
      await setJob(jobId, { progress: 30 });

      const total = await getDuration(source, Number(job.duration));
      const clipLength = Math.min(Number(job.duration), total);
      if (clipLength <= 0) throw new Error('The video has no usable duration.');

      const count = Math.max(1, Math.min(10, Number(job.clipCount)));
      const span = Math.max(0, total - clipLength);

      for (let i = 0; i < count; i++) {
        const start = count === 1 ? span / 2 : (span * i) / (count - 1);
        const output = join(workDir, `clip-${i + 1}.mp4`);
        await runFfmpeg([
          '-y', '-ss', String(start), '-i', source, '-t', String(clipLength),
          '-map', '0:v:0', '-map', '0:a?',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', output,
        ]);

        const bytes = await readFile(output);
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const key = `${jobId}/clip-${i + 1}.mp4`;
        await store.set(key, arrayBuffer, { metadata: { contentType: 'video/mp4', jobId } });
        await db.clip.create({
          data: {
            jobId,
            title: `Clip ${i + 1}`,
            start,
            end: start + clipLength,
            score: 0.5,
            videoUrl: `/.netlify/functions/clip?key=${encodeURIComponent(key)}`,
          },
        });
        await setJob(jobId, { progress: 30 + Math.round(65 * ((i + 1) / count)) });
      }

      await setJob(jobId, { status: 'complete', progress: 100 });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('ClipForge processing failed', error);
    if (jobId) {
      await db.job.update({
        where: { id: jobId },
        data: { status: 'failed', progress: 0, error: String(error?.message || error).slice(0, 1000) },
      }).catch(() => {});
    }
  }
}

export const config = { background: true };
