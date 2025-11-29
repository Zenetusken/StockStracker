import Layout from '../components/Layout';

function Dashboard() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Your Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Track your portfolio, watchlists, and market data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Portfolio Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              My Portfolio
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage your investments
            </p>
          </div>

          {/* Watchlist Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Watchlists
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track your favorite stocks
            </p>
          </div>

          {/* Market Overview Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Market Overview
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Latest market news and trends
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
