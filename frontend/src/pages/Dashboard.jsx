import { useState } from 'react';
import Layout from '../components/Layout';
import { ApiHealthWidget, ApiKeysModal } from '../components/api-keys';
import NewsFeed from '../components/NewsFeed';

function Dashboard() {
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Portfolio Card */}
          <div className="bg-card p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              My Portfolio
            </h3>
            <p className="text-sm text-text-muted">
              View and manage your investments
            </p>
          </div>

          {/* Watchlist Card */}
          <div className="bg-card p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Watchlists
            </h3>
            <p className="text-sm text-text-muted">
              Track your favorite stocks
            </p>
          </div>

          {/* API Status Card */}
          <ApiHealthWidget onClick={() => setIsApiKeysModalOpen(true)} />
        </div>

        {/* Market News Section (#97) */}
        <div className="mt-8">
          <NewsFeed
            title="Market News"
            category="general"
            limit={15}
          />
        </div>
      </div>

      {/* API Keys Modal */}
      <ApiKeysModal
        isOpen={isApiKeysModalOpen}
        onClose={() => setIsApiKeysModalOpen(false)}
      />
    </Layout>
  );
}

export default Dashboard;
