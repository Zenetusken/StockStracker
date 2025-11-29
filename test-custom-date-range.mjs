// Test custom date range API endpoint
const from = Math.floor(new Date('2023-01-01').getTime() / 1000);
const to = Math.floor(new Date('2023-06-30').getTime() / 1000);

console.log('Testing custom date range...');
console.log('From:', from, '(2023-01-01)');
console.log('To:', to, '(2023-06-30)');
console.log('Date range:', Math.floor((to - from) / 86400), 'days');

const url = `http://localhost:3001/api/quotes/AAPL/candles?resolution=D&from=${from}&to=${to}`;
console.log('\nFetching:', url);

try {
  const response = await fetch(url);
  const data = await response.json();

  console.log('\nResponse status:', data.s);
  console.log('Data points:', data.t ? data.t.length : 0);

  if (data.t && data.t.length > 0) {
    const firstDate = new Date(data.t[0] * 1000);
    const lastDate = new Date(data.t[data.t.length - 1] * 1000);
    console.log('First date:', firstDate.toISOString().split('T')[0]);
    console.log('Last date:', lastDate.toISOString().split('T')[0]);
    console.log('First close price:', data.c[0]);
    console.log('Last close price:', data.c[data.c.length - 1]);
  }
} catch (error) {
  console.error('Error:', error.message);
}
