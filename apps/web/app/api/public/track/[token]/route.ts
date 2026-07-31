import { backendUrl } from '@/lib/server/backend';

type TrackingRouteContext = {
  params: Promise<{ token: string }>;
};

const trackingTokenPattern = /^[A-Za-z0-9_-]{32,64}$/;

export async function GET(
  _request: Request,
  context: TrackingRouteContext,
): Promise<Response> {
  const { token } = await context.params;
  if (!trackingTokenPattern.test(token)) {
    return Response.json(
      { detail: 'Tracking information not found' },
      { status: 404 },
    );
  }

  try {
    const response = await fetch(
      backendUrl(`/api/v1/public/track/${encodeURIComponent(token)}`),
      { cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return Response.json(
      { detail: 'Tracking service is temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}
