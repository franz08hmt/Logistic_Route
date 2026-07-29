import { authorizeGeocodingRequest } from '@/lib/server/geocoding-auth';
import { normalizeGeoapifyAutocompleteResponse } from '@/lib/server/geoapify';

const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';

export async function GET(request: Request): Promise<Response> {
  const authError = await authorizeGeocodingRequest();
  if (authError) {
    return authError;
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { detail: 'GEOAPIFY_API_KEY is not configured' },
      { status: 503 },
    );
  }

  const parameters = new URL(request.url).searchParams;
  const query = parameters.get('q')?.trim() ?? '';
  if (query.length < 3 || query.length > 200) {
    return Response.json(
      { detail: 'Address query must contain between 3 and 200 characters' },
      { status: 422 },
    );
  }
  // The browser only sends search text to this same-origin endpoint. The
  // server owns the fixed Geoapify host and server-only API key.
  const searchUrl = new URL(GEOAPIFY_AUTOCOMPLETE_URL);
  searchUrl.searchParams.set('text', query);
  searchUrl.searchParams.set('format', 'geojson');
  searchUrl.searchParams.set('lang', 'vi');
  searchUrl.searchParams.set('filter', 'countrycode:vn');
  searchUrl.searchParams.set('bias', 'proximity:106.7009,10.7769');
  searchUrl.searchParams.set('limit', '6');
  searchUrl.searchParams.set('apiKey', apiKey);

  try {
    const response = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return Response.json(
        { detail: 'Address provider is temporarily unavailable' },
        { status: response.status === 429 ? 429 : 502 },
      );
    }
    return Response.json(normalizeGeoapifyAutocompleteResponse(payload));
  } catch {
    return Response.json(
      { detail: 'Address search timed out' },
      { status: 504 },
    );
  }
}
