const testChartAPI = async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sixMonthsAgo = now - (180 * 24 * 60 * 60);

    console.log('Testing candles API endpoint...');
    console.log(`From: ${sixMonthsAgo}, To: ${now}`);

    const response = await fetch(
      `http://localhost:3001/api/quotes/AAPL/candles?resolution=D&from=${sixMonthsAgo}&to=${now}`
    );

    console.log('Status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
      return;
    }

    const data = await response.json();
    console.log('Response keys:', Object.keys(data));
    console.log('Status:', data.s);
    console.log('Data points:', data.t ? data.t.length : 0);

    if (data.t && data.t.length > 0) {
      console.log('First data point:', {
        time: data.t[0],
        open: data.o[0],
        high: data.h[0],
        low: data.l[0],
        close: data.c[0],
        volume: data.v[0]
      });
      console.log('✓ API working correctly!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testChartAPI();
