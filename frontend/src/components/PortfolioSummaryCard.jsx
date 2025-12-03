import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

export default function PortfolioSummaryCard() {
  const navigate = useNavigate();
  const { portfolios, isLoading, fetchPortfolios } = usePortfolioStore();

  useEffect(() => {
    fetchPortfolios().catch(console.error);
  }, [fetchPortfolios]);

  // Calculate totals across all portfolios
  const totalInvested = portfolios.reduce((sum, p) => sum + (p.total_invested || 0), 0);
  const totalHoldings = portfolios.reduce((sum, p) => sum + (p.holdings_count || 0), 0);
  const totalCash = portfolios.reduce((sum, p) => sum + (p.cash_balance || 0), 0);

  const handleClick = () => {
    // Navigate to first portfolio or portfolio list
    const defaultPortfolio = portfolios.find((p) => p.is_default) || portfolios[0];
    if (defaultPortfolio) {
      navigate(`/portfolio/${defaultPortfolio.id}`);
    } else {
      navigate('/portfolio');
    }
  };

  // Loading state
  if (isLoading && portfolios.length === 0) {
    return (
      <div className="rounded-lg shadow bg-card p-6 h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-text-secondary" />
            <h3 className="text-lg font-semibold text-text-primary">My Portfolio</h3>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-page-bg rounded w-3/4"></div>
          <div className="h-4 bg-page-bg rounded w-1/2"></div>
          <div className="h-4 bg-page-bg rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (portfolios.length === 0) {
    return (
      <div
        onClick={() => navigate('/portfolio')}
        className="rounded-lg shadow bg-card p-6 cursor-pointer hover:shadow-md transition-shadow h-full"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-text-secondary" />
            <h3 className="text-lg font-semibold text-text-primary">My Portfolio</h3>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary">
          Create your first portfolio to start tracking investments
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="rounded-lg shadow bg-card p-6 cursor-pointer hover:shadow-md transition-shadow h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">My Portfolio</h3>
        </div>
        <ChevronRight className="w-5 h-5 text-text-muted" />
      </div>

      {/* Total Value */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-text-primary">
          ${(totalInvested + totalCash).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-text-muted">
          Total portfolio value
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Portfolios</span>
          <span className="font-medium text-text-primary">{portfolios.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Holdings</span>
          <span className="font-medium text-text-primary">{totalHoldings}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Cash</span>
          <span className="font-medium text-text-primary">
            ${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
