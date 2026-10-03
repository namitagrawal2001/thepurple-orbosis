const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

export const API_BASE_URL =
  configuredApiUrl ||
  (process.env.NODE_ENV !== 'production'
    ? 'http://localhost:5000/api/v1'
    : (() => {
        throw new Error('NEXT_PUBLIC_API_URL is required in production.');
      })());
