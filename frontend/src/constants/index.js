import { API_BASE_URL } from '@/lib/api/url';

export { API_BASE_URL };

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/health`,
  QUEUES: {
    TEST_JOB: `${API_BASE_URL}/queues/test-job`,
    STATUS: `${API_BASE_URL}/queues/status`,
  },
  SEARCH: {
    TEST_QUERY: `${API_BASE_URL}/search/test-query`,
    INIT: `${API_BASE_URL}/search/init`,
  },
};

export const BRAND = {
  NAME: 'ThePurple',
  TAGLINE: 'Modern E-Commerce Excellence',
  COLORS: {
    PRIMARY_PURPLE: '#7E22CE',
    DEEP_PURPLE: '#581C87',
    VIBRANT_PURPLE: '#9333EA',
    LIGHT_PURPLE: '#FAF5FF',
    ACCENT_GOLD: '#F59E0B',
  },
};
