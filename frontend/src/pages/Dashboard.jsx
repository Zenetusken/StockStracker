import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import NewsFeed from '../components/NewsFeed';
import MarketOverview from '../components/MarketOverview';
import TopMovers from '../components/TopMovers';
import MarketStatus from '../components/MarketStatus';
import EconomicCalendar from '../components/EconomicCalendar';
import PortfolioSummaryCard from '../components/PortfolioSummaryCard';
import WatchlistSummaryCard from '../components/WatchlistSummaryCard';
import { Skeleton } from '../components/ui';

function Dashboard() {
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Brief delay to allow components to mount and start fetching
    const timer = setTimeout(() => setIsInitialLoad(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Page-level loading skeleton
  if (isInitialLoad) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header skeleton */}
          <div className="mb-8">
            <Skeleton variant="title" className="w-64 mb-2" />
            <Skeleton className="w-48" />
          </div>

          {/* Portfolio + Watchlist row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-lg shadow p-6 h-40">
              <Skeleton variant="title" className="w-24 mb-4" />
              <Skeleton className="w-full mb-2" />
              <Skeleton className="w-3/4" />
            </div>
            <div className="bg-card rounded-lg shadow p-6 h-40">
              <Skeleton variant="title" className="w-24 mb-4" />
              <Skeleton className="w-full mb-2" />
              <Skeleton className="w-3/4" />
            </div>
          </div>

          {/* Market Status + Top Movers row */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg shadow p-4 h-36">
              <Skeleton className="w-20 mb-2" />
              <Skeleton variant="title" className="w-16" />
            </div>
            <div className="lg:col-span-2 bg-card rounded-lg shadow p-6 h-64">
              <Skeleton variant="title" className="w-32 mb-4" />
              <Skeleton className="w-full h-40" />
            </div>
          </div>

          {/* Market Overview skeleton */}
          <div className="mt-8 bg-card rounded-lg shadow p-6 h-80">
            <Skeleton variant="title" className="w-40 mb-4" />
            <Skeleton className="w-full h-56" />
          </div>

          {/* Economic Calendar + News row */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg shadow p-6 h-48">
              <Skeleton variant="title" className="w-32 mb-4" />
              <Skeleton className="w-full mb-2" />
              <Skeleton className="w-3/4 mb-2" />
              <Skeleton className="w-1/2" />
            </div>
            <div className="lg:col-span-2 bg-card rounded-lg shadow p-6 h-64">
              <Skeleton variant="title" className="w-28 mb-4" />
              <Skeleton className="w-full h-40" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-primary mb-2">
            Welcome to Your Dashboard
          </h2>
          <p className="text-text-muted">
            Track your portfolio, watchlists, and market data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Portfolio Card */}
          <PortfolioSummaryCard />

          {/* Watchlist Card */}
          <WatchlistSummaryCard />
        </div>

        {/* Market Status + Top Movers Row (#118-121) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Status (#121) */}
          <MarketStatus />

          {/* Top Movers (#118, #119, #120) */}
          <div className="lg:col-span-2">
            <TopMovers />
          </div>
        </div>

        {/* Market Overview Section (#116, #117) */}
        <div className="mt-8">
          <MarketOverview />
        </div>

        {/* Economic Calendar + News Row (#122) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Economic Calendar (#122) */}
          <EconomicCalendar />

          {/* Market News Section (#97) */}
          <div className="lg:col-span-2">
            <NewsFeed
              title="Market News"
              category="general"
              limit={10}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
