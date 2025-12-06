import Layout from '../components/Layout';
import NewsFeed from '../components/NewsFeed';
import MarketOverview from '../components/MarketOverview';
import TopMovers from '../components/TopMovers';
import MarketStatus from '../components/MarketStatus';
import EconomicCalendar from '../components/EconomicCalendar';
import PortfolioSummaryCard from '../components/PortfolioSummaryCard';
import WatchlistSummaryCard from '../components/WatchlistSummaryCard';

function Dashboard() {
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
