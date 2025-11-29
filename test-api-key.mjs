import fs from 'fs';

// Load API key
const apiKey = fs.readFileSync('/tmp/api-key/finnhub.io.key', 'utf8').trim();
console.log(`API Key loaded: ${apiKey.substring(0, 10)}... (${apiKey.length} chars)`);

// Test API call
const testSymbol = 'AAPL';
const url = `https://finnhub.io/api/v1/quote?symbol=${testSymbol}&token=${apiKey}`;

console.log(`\nTesting Finnhub API with symbol: ${testSymbol}`);
console.log(`URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

try {
  const response = await fetch(url);
  console.log(`\nResponse Status: ${response.status} ${response.statusText}`);

  if (response.ok) {
    const data = await response.json();
    console.log('\n✅ API CALL SUCCESS! Real data received:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nCurrent Price:', data.c);
    console.log('Previous Close:', data.pc);
    console.log('Change:', (data.c - data.pc).toFixed(2));
  } else {
    const errorText = await response.text();
    console.error('\n❌ API CALL FAILED!');
    console.error('Error:', errorText);
  }
} catch (error) {
  console.error('\n❌ NETWORK ERROR!');
  console.error('Error:', error.message);
}
