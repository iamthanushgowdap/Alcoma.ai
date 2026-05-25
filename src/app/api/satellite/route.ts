import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      provider = 'sentinel',
      clientId,
      clientSecret,
      mapTilerKey,
      bbox, // [minLng, minLat, maxLng, maxLat] for Sentinel Hub
      lat,  // Center latitude for MapTiler
      lng,  // Center longitude for MapTiler
      zoom = 14,
      width = 768,
      height = 768,
      dateFrom,
      dateTo,
      maxCloudCoverage = 20,
      bandConfiguration = 'true-color',
    } = body;

    // ----------------------------------------------------
    // PROVIDER: MAPTILER
    // ----------------------------------------------------
    if (provider === 'maptiler') {
      const activeMapTilerKey = mapTilerKey || process.env.MAPTILER_API_KEY || process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
      if (!activeMapTilerKey) {
        return NextResponse.json(
          { error: 'MapTiler API Key is required. Please configure it in Settings or the environment variables (.env).' },
          { status: 400 }
        );
      }

      if (lat === undefined || lng === undefined) {
        return NextResponse.json(
          { error: 'Latitude and longitude coordinates are required for MapTiler capture.' },
          { status: 400 }
        );
      }

      // MapTiler Static Map Capture URL
      const staticUrl = `https://api.maptiler.com/maps/satellite/static/${lng},${lat},${zoom}/${width}x${height}.jpg?key=${activeMapTilerKey}`;

      const response = await fetch(staticUrl);
      if (!response.ok) {
        let errorDetails = `HTTP Status ${response.status}`;
        try {
          const bodyText = await response.text();
          if (bodyText) {
            errorDetails += ` - ${bodyText}`;
          }
        } catch (_) {}
        return NextResponse.json(
          { error: `MapTiler Static Map API failed: ${errorDetails}` },
          { status: response.status }
        );
      }

      // Read response binary buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');
      const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

      return NextResponse.json({
        success: true,
        imageUrl: imageDataUrl,
        source: 'MapTiler',
        timestamp: new Date().toISOString(),
      });
    }

    // ----------------------------------------------------
    // PROVIDER: SENTINEL HUB
    // ----------------------------------------------------
    const activeClientId = clientId || process.env.SENTINEL_CLIENT_ID;
    const activeClientSecret = clientSecret || process.env.SENTINEL_CLIENT_SECRET;

    if (!activeClientId || !activeClientSecret) {
      return NextResponse.json(
        { error: 'Sentinel Hub Client ID and Client Secret are required. Please configure them in Settings or the environment variables (.env).' },
        { status: 400 }
      );
    }

    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return NextResponse.json(
        { error: 'A valid bounding box [minLng, minLat, maxLng, maxLat] is required for Sentinel Hub.' },
        { status: 400 }
      );
    }

    // 1. Get OAuth Token from Copernicus Data Space Ecosystem (CDSE) Keycloak Token Endpoint
    const oauthUrl = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', activeClientId);
    params.append('client_secret', activeClientSecret);

    const tokenResponse = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Sentinel Hub OAuth failed:', errorText);
      return NextResponse.json(
        { error: `Sentinel Hub OAuth failed (Status ${tokenResponse.status}): ${tokenResponse.statusText || 'Unauthorized'}. Please verify your client credentials.` },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to retrieve access token from Sentinel Hub.' },
        { status: 500 }
      );
    }

    // 2. Query Sentinel Hub Process API
    const processUrl = 'https://sh.dataspace.copernicus.eu/api/v1/process';

    // Set up Evalscript based on band configuration selection
    let evalscript = '';
    if (bandConfiguration === 'false-color') {
      // Infrared false color: B8 (NIR), B4 (Red), B3 (Green)
      evalscript = `//VERSION=3
function setup() {
  return {
    input: ["B03", "B04", "B08"],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B08, 2.5 * sample.B04, 2.5 * sample.B03];
}`;
    } else {
      // True Color: B4 (Red), B3 (Green), B02 (Blue)
      evalscript = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04"],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}`;
    }

    // Format dates to ISO
    const fromTime = dateFrom ? `${dateFrom}T00:00:00Z` : '2025-01-01T00:00:00Z';
    const toTime = dateTo ? `${dateTo}T23:59:59Z` : new Date().toISOString();

    const processBody = {
      input: {
        bounds: {
          bbox: bbox,
          properties: {
            crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
          },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange: {
                from: fromTime,
                to: toTime,
              },
              maxCloudCoverage: maxCloudCoverage,
            },
          },
        ],
      },
      output: {
        width: 768,
        height: 768,
        responses: [
          {
            identifier: 'default',
            format: {
              type: 'image/png',
            },
          },
        ],
      },
      evalscript: evalscript,
    };

    const processResponse = await fetch(processUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(processBody),
    });

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('Sentinel Hub Process API failed:', errorText);
      return NextResponse.json(
        { error: `Sentinel Hub Process API failed (Status ${processResponse.status}): ${processResponse.statusText}. Try adjusting date bounds or cloud coverage.` },
        { status: processResponse.status }
      );
    }

    // Read response binary buffer
    const arrayBuffer = await processResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl: imageDataUrl,
      source: 'Sentinel-2 L2A',
      bbox: bbox,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error proxying Sentinel Hub request:', error);
    return NextResponse.json(
      { error: error.message || 'An internal error occurred while fetching satellite imagery.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || 'maptiler';
    const z = searchParams.get('z');
    const x = searchParams.get('x');
    const y = searchParams.get('y');

    if (!z || !x || !y) {
      return NextResponse.json(
        { error: 'Missing required tile parameters: z, x, y' },
        { status: 400 }
      );
    }

    if (provider === 'maptiler') {
      const activeMapTilerKey = process.env.MAPTILER_API_KEY || process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
      if (!activeMapTilerKey) {
        return NextResponse.json(
          { error: 'MapTiler API Key is not configured on the server.' },
          { status: 500 }
        );
      }

      const tileUrl = `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${activeMapTilerKey}`;
      const response = await fetch(tileUrl);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch MapTiler tile: ${response.statusText}` },
          { status: response.status }
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Response(arrayBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return NextResponse.json(
      { error: `Unsupported tile provider: ${provider}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error proxying tile request:', error);
    return NextResponse.json(
      { error: error.message || 'An internal error occurred while fetching the tile.' },
      { status: 500 }
    );
  }
}

