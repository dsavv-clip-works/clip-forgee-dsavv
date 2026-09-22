import { getStore } from '@netlify/blobs';

export default async function handler(request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key || key.length > 600 || key.includes('..')) return new Response('Invalid clip key.', { status: 400 });
  const blob = await getStore('clipforge-clips').get(key, { type: 'blob' });
  if (!blob) return new Response('Clip not found.', { status: 404 });
  return new Response(blob, {
    headers: {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
    },
  });
}
