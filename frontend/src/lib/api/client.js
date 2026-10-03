import { getAccessToken } from '@/lib/auth/session';
import { notify } from '@/lib/notify';
import { API_BASE_URL } from '@/lib/api/url';

const API_URL = API_BASE_URL;

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Central API request helper.
 *
 * @param {string} path      — API path (e.g. "/user/me")
 * @param {object} options   — { method, body, formData, token, silent }
 * @returns {Promise<any>}   — parsed response data
 */
export async function request(path, { method = 'GET', body, formData, token, silent } = {}) {
  const isGet = method.toUpperCase() === 'GET';
  const shouldBeSilent = silent !== undefined ? silent : isGet;
  const accessToken = token === undefined ? await getAccessToken() : token;

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: formData || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    if (!shouldBeSilent) notify.error('Network error. Please check your connection.');
    throw new ApiError('Network error. Please check your connection.', 0);
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      const message = payload.message || 'Request failed';
      if (!shouldBeSilent) notify.error(message);
      throw new ApiError(message, response.status, payload.errors || []);
    }
    if (!shouldBeSilent && method !== 'GET' && payload.message) {
      notify.success(payload.message);
    }
    return payload.data;
  }

  if (!response.ok) {
    if (!shouldBeSilent) notify.error('Request failed');
    throw new ApiError('Request failed', response.status);
  }

  return response;
}

export const getApiUrl = () => API_URL;
