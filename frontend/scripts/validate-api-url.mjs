const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  console.error('NEXT_PUBLIC_API_URL is required for a production frontend build.');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(apiUrl);
} catch {
  console.error('NEXT_PUBLIC_API_URL must be a valid HTTPS URL ending in /api/v1.');
  process.exit(1);
}

if (
  parsedUrl.protocol !== 'https:' ||
  parsedUrl.username ||
  parsedUrl.password ||
  !/^\/api\/v1\/?$/.test(parsedUrl.pathname) ||
  parsedUrl.search ||
  parsedUrl.hash ||
  parsedUrl.hostname.toLowerCase().includes('replace') ||
  parsedUrl.hostname === 'localhost' ||
  parsedUrl.hostname === '127.0.0.1'
) {
  console.error('NEXT_PUBLIC_API_URL must be a public HTTPS URL ending in /api/v1.');
  process.exit(1);
}
