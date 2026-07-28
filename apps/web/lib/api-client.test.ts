import { describe, expect, it } from 'vitest';

import { backendProxyPath } from './api-client';

describe('backend API client', () => {
  it('routes FastAPI paths through the same-origin authenticated proxy', () => {
    expect(backendProxyPath('/api/v1/orders')).toBe(
      '/api/backend/api/v1/orders',
    );
  });

  it('rejects paths outside the versioned backend API', () => {
    expect(() => backendProxyPath('https://example.com')).toThrow(
      'Expected an /api/v1 backend path',
    );
  });
});
