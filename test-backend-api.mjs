// Test the backend API to see if it's getting real data or mock data
const API_URL = 'http://localhost:3001';

async function testQuoteEndpoint() {
  console.log('Testing backend quote endpoint...\n');

  try {
    const response = await fetch(`${API_URL}/api/quotes/AAPL`);
    const data = await response.json();

    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.current === 178.72) {
      console.log('\n❌ USING MOCK DATA - Price matches mock value ($178.72)');
    } else {
      console.log(`\n✅ USING REAL DATA - Price is $${data.current} (not mock $178.72)`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQuoteEndpoint();
