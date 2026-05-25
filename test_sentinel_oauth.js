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

console.log('Credentials:');
console.log('  Client ID:', clientId);
console.log('  Client Secret Length:', clientSecret.length);

const endpoints = [
  'https://sh.dataspace.copernicus.eu/oauth/token',
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
];

async function testOAuth() {
  for (const url of endpoints) {
    console.log(`\nTesting endpoint: ${url}`);
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      console.log(`  Status: ${res.status} ${res.statusText}`);
      console.log(`  Content-Type: ${res.headers.get('content-type')}`);
      const text = await res.text();
      console.log(`  Response body: ${text.substring(0, 400)}`);
    } catch (err) {
      console.error('  Fetch Error:', err.message);
    }
  }
}

testOAuth();
