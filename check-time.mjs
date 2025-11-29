const now = Math.floor(Date.now() / 1000);
const sixMonthsAgo = now - (180 * 24 * 60 * 60);

console.log('Current time (unix):', now);
console.log('Current time (date):', new Date(now * 1000).toISOString());
console.log('Six months ago (unix):', sixMonthsAgo);
console.log('Six months ago (date):', new Date(sixMonthsAgo * 1000).toISOString());
