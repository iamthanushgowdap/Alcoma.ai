const fs = require('fs');

const envPath = 'c:\\Users\\choco\\OneDrive\\Documents\\marine\\.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let clientId = '';
let clientSecret = '';

for (const line of lines) {
  if (line.startsWith('SENTINEL_CLIENT_ID=')) {
    clientId = line.split('=')[1].trim();
  }
  if (line.startsWith('SENTINEL_CLIENT_SECRET=')) {
    clientSecret = line.split('=')[1].trim();
  }
}

async function testProcess() {
  console.log('1. Fetching OIDC token...');
  const oauthUrl = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  const tokenRes = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    },
    body: params.toString()
  });

  if (!tokenRes.ok) {
    console.error('Failed to get token:', tokenRes.status, await tokenRes.text());
    return;
  }

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log('OIDC Token retrieved successfully!');

  console.log('2. Querying Process API...');
  // Ganges River Delta bounds
  const bbox = [89.98, 21.98, 90.02, 22.02];
  const evalscript = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04"],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}`;

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
              from: '2025-01-01T00:00:00Z',
              to: '2025-05-01T23:59:59Z',
            },
            maxCloudCoverage: 50,
          },
        },
      ],
    },
    output: {
      width: 256,
      height: 256,
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

  const processUrl = 'https://sh.dataspace.copernicus.eu/api/v1/process';
  try {
    const processRes = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(processBody)
    });

    console.log('Process API Status:', processRes.status, processRes.statusText);
    console.log('Content-Type:', processRes.headers.get('content-type'));
    
    if (!processRes.ok) {
      console.log('Error Details:', await processRes.text());
    } else {
      const buffer = await processRes.arrayBuffer();
      console.log('Image fetched successfully! Size in bytes:', buffer.byteLength);
    }
  } catch (err) {
    console.error('Process API Fetch Error:', err);
  }
}

testProcess();
