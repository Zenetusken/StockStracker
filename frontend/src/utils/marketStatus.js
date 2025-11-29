/**
 * Market Status Utility
 * Determines if the US stock market is open based on current time
 */

/**
 * Check if current time is during regular trading hours
 * Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
 * @returns {object} - { isOpen, status, message }
 */
export function getMarketStatus() {
  const now = new Date();

  // Convert to ET timezone
  const etTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );

  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Weekend check
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      status: 'closed',
      message: 'Markets Closed - Weekend',
      color: 'gray',
      dotColor: 'bg-gray-500',
    };
  }

  // Market open: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM in minutes
  const marketClose = 16 * 60; // 4:00 PM in minutes

  // Pre-market: 4:00 AM - 9:30 AM ET
  const preMarketStart = 4 * 60; // 4:00 AM in minutes

  // After-hours: 4:00 PM - 8:00 PM ET
  const afterHoursEnd = 20 * 60; // 8:00 PM in minutes

  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return {
      isOpen: true,
      status: 'open',
      message: 'Market Open',
      color: 'green',
      dotColor: 'bg-green-500',
    };
  } else if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    const minutesUntilOpen = marketOpen - timeInMinutes;
    const hoursUntil = Math.floor(minutesUntilOpen / 60);
    const minutesUntil = minutesUntilOpen % 60;

    return {
      isOpen: false,
      status: 'pre-market',
      message: `Pre-Market (Opens in ${hoursUntil}h ${minutesUntil}m)`,
      color: 'yellow',
      dotColor: 'bg-yellow-500',
    };
  } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
    return {
      isOpen: false,
      status: 'after-hours',
      message: 'After Hours',
      color: 'orange',
      dotColor: 'bg-orange-500',
    };
  } else {
    // Outside all trading times
    return {
      isOpen: false,
      status: 'closed',
      message: 'Market Closed',
      color: 'red',
      dotColor: 'bg-red-500',
    };
  }
}

/**
 * Format time remaining until market opens
 * @returns {string} - Formatted time string
 */
export function getTimeUntilOpen() {
  const now = new Date();
  const etTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );

  // Calculate next market open (9:30 AM ET next weekday)
  const nextOpen = new Date(etTime);
  nextOpen.setHours(9, 30, 0, 0);

  // If already past market open today, move to tomorrow
  if (etTime.getHours() >= 16 || (etTime.getHours() === 9 && etTime.getMinutes() >= 30)) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }

  // Skip weekends
  while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }

  const diff = nextOpen - etTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

export default {
  getMarketStatus,
  getTimeUntilOpen,
};
