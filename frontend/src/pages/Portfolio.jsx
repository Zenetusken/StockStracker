import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, TrendingUp, TrendingDown, DollarSign, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import { usePortfolioStore } from '../stores/portfolioStore';
import NewPortfolioModal from '../components/NewPortfolioModal';

function Portfolio() {
  const navigate = useNavigate();
  const [showNewPortfolioModal, setShowNewPortfolioModal] = useState(false);

  // Get portfolios from centralized store
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const isLoading = usePortfolioStore((state) => state.isLoading);
  const fetchPortfolios = usePortfolioStore((state) => state.fetchPortfolios);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  // N11 fix: Memoize computed values to avoid recalculating on every render
  const { totalValue, totalGainLoss, totalGainLossPercent } = useMemo(() => {
    const value = portfolios.reduce((sum, p) => sum + (p.total_value || 0), 0);
    const gainLoss = portfolios.reduce((sum, p) => sum + (p.total_gain_loss || 0), 0);
    const percent = value > 0 ? (gainLoss / (value - gainLoss)) * 100 : 0;
    return { totalValue: value, totalGainLoss: gainLoss, totalGainLossPercent: percent };
  }, [portfolios]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value?.toFixed(2) || '0.00'}%`;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Portfolios</h1>
            <p className="text-text-muted">Manage your investment portfolios</p>
          </div>
          <button
            onClick={() => setShowNewPortfolioModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Portfolio
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-brand" />
              </div>
              <span className="text-text-muted text-sm">Total Value</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {formatCurrency(totalValue)}
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${totalGainLoss >= 0 ? 'bg-gain/10' : 'bg-loss/10'}`}>
                {totalGainLoss >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-gain" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-loss" />
                )}
              </div>
              <span className="text-text-muted text-sm">Total Gain/Loss</span>
            </div>
            <div className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatCurrency(totalGainLoss)}
            </div>
            <div className={`text-sm ${totalGainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatPercent(totalGainLossPercent)}
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand/10 rounded-lg">
                <Briefcase className="w-5 h-5 text-brand" />
              </div>
              <span className="text-text-muted text-sm">Total Portfolios</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {portfolios.length}
            </div>
          </div>
        </div>

        {/* Portfolio List */}
        <div className="bg-card rounded-lg shadow">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Your Portfolios</h2>
          </div>

          {isLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-page-bg rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : portfolios.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No portfolios yet</h3>
              <p className="text-text-muted mb-6">Create your first portfolio to start tracking your investments</p>
              <button
                onClick={() => setShowNewPortfolioModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Portfolio
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {portfolios.map((portfolio) => {
                const gainLoss = portfolio.total_gain_loss || 0;
                const gainLossPercent = portfolio.total_value > 0
                  ? (gainLoss / (portfolio.total_value - gainLoss)) * 100
                  : 0;
                const isPositive = gainLoss >= 0;

                return (
                  <button
                    key={portfolio.id}
                    onClick={() => navigate(`/portfolio/${portfolio.id}`)}
                    className="w-full p-6 flex items-center justify-between hover:bg-panel-hover transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand/10 rounded-lg">
                        <Briefcase className="w-6 h-6 text-brand" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary">{portfolio.name}</h3>
                        <p className="text-sm text-text-muted">
                          {portfolio.holdings_count || 0} holdings
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-text-primary">
                          {formatCurrency(portfolio.total_value)}
                        </div>
                        <div className={`text-sm flex items-center gap-1 justify-end ${isPositive ? 'text-gain' : 'text-loss'}`}>
                          {isPositive ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-muted" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Portfolio Modal */}
      <NewPortfolioModal
        isOpen={showNewPortfolioModal}
        onClose={() => setShowNewPortfolioModal(false)}
      />
    </Layout>
  );
}

export default Portfolio;
