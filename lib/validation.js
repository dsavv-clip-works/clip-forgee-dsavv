export function validateVideoUrl(value) {
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: 'Only HTTP and HTTPS video URLs are supported.' };
    const host = url.hostname.toLowerCase();
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
    if (blocked.includes(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      return { ok: false, error: 'That video URL is not allowed.' };
    }
    const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4) {
      const [a,b,c,d] = ipv4.slice(1).map(Number);
      const privateIp = a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
      if (privateIp) return { ok: false, error: 'That video URL is not allowed.' };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error: 'Enter a valid video URL.' };
  }
}
