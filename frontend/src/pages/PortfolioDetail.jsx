import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, PieChart, ArrowUpRight, ArrowDownRight, Plus, Pencil } from 'lucide-react';
import Layout from '../components/Layout';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useQuotes } from '../stores/quoteStore';
import AddTransactionModal from '../components/AddTransactionModal';
import EditTransactionModal from '../components/EditTransactionModal';

function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Portfolio store
  const fetchPortfolioDetail = usePortfolioStore((state) => state.fetchPortfolioDetail);

  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionFilter, setTransactionFilter] = useState('all');

  // Get holdings symbols for quote subscription
  const holdingSymbols = useMemo(() => {
    return portfolio?.holdings?.map(h => h.symbol) || [];
  }, [portfolio?.holdings]);

  // Quotes store for live prices - pass symbols to useQuotes hook
  const { quotes } = useQuotes(holdingSymbols);

  // Fetch portfolio details
  useEffect(() => {
    const loadPortfolio = async () => {
      setLoading(true);
      try {
        const data = await fetchPortfolioDetail(id);
        setPortfolio(data);
        setError(null);
      } catch (err) {
        console.error('Error loading portfolio:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadPortfolio();
  }, [id, fetchPortfolioDetail]);

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    if (!portfolio) return null;

    const holdings = portfolio.holdings || [];
    const cashBalance = portfolio.cash_balance || 0;

    let totalValue = cashBalance;
    let totalCost = 0;
    let dayChange = 0;

    holdings.forEach(holding => {
      const quote = quotes[holding.symbol];
      const currentPrice = quote?.c || holding.average_cost;
      const previousClose = quote?.pc || holding.average_cost;

      const marketValue = holding.total_shares * currentPrice;
      const costBasis = holding.total_shares * holding.average_cost;
      const holdingDayChange = holding.total_shares * (currentPrice - previousClose);

      totalValue += marketValue;
      totalCost += costBasis;
      dayChange += holdingDayChange;
    });

    const totalGainLoss = totalValue - totalCost - cashBalance;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
    const dayChangePercent = (totalValue - dayChange) > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

    return {
      totalValue,
      cashBalance,
      investedValue: totalValue - cashBalance,
      totalGainLoss,
      totalGainLossPercent,
      dayChange,
      dayChangePercent,
      holdingsCount: holdings.length
    };
  }, [portfolio, quotes]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!portfolio?.recent_transactions) return [];
    if (transactionFilter === 'all') return portfolio.recent_transactions;
    return portfolio.recent_transactions.filter(tx => tx.type === transactionFilter);
  }, [portfolio?.recent_transactions, transactionFilter]);

  // Format helpers
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatChange = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatCurrency(value)}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-text-secondary">Loading portfolio...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-loss">{error}</div>
        </div>
      </Layout>
    );
  }

  if (!portfolio || !metrics) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-text-secondary">Portfolio not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Briefcase className="w-8 h-8 text-brand" />
              <h1 className="text-2xl font-bold text-text-primary">{portfolio.name}</h1>
              {portfolio.is_paper_trading === 1 && (
                <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded">
                  Paper Trading
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAddTransactionModal(true)}
              data-testid="add-transaction-button"
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Transaction
            </button>
          </div>
          {portfolio.description && (
            <p className="text-text-secondary ml-11">{portfolio.description}</p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Value */}
          <div className="bg-card rounded-lg p-5 border border-line" data-testid="total-value-card">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
              <DollarSign className="w-4 h-4" />
              Total Value
            </div>
            <div className="text-2xl font-bold text-text-primary" data-testid="total-value">
              {formatCurrency(metrics.totalValue)}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {metrics.holdingsCount} holdings
            </div>
          </div>

          {/* Day Change */}
          <div className="bg-card rounded-lg p-5 border border-line" data-testid="day-change-card">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
              {metrics.dayChange >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-gain" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-loss" />
              )}
              Day Change
            </div>
            <div className={`text-2xl font-bold ${metrics.dayChange >= 0 ? 'text-gain' : 'text-loss'}`} data-testid="day-change">
              {formatChange(metrics.dayChange)}
            </div>
            <div className={`text-sm ${metrics.dayChange >= 0 ? 'text-gain' : 'text-loss'}`} data-testid="day-change-percent">
              {formatPercent(metrics.dayChangePercent)}
            </div>
          </div>

          {/* Total Gain/Loss */}
          <div className="bg-card rounded-lg p-5 border border-line" data-testid="gain-loss-card">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
              {metrics.totalGainLoss >= 0 ? (
                <TrendingUp className="w-4 h-4 text-gain" />
              ) : (
                <TrendingDown className="w-4 h-4 text-loss" />
              )}
              Total Gain/Loss
            </div>
            <div className={`text-2xl font-bold ${metrics.totalGainLoss >= 0 ? 'text-gain' : 'text-loss'}`} data-testid="total-gain-loss">
              {formatChange(metrics.totalGainLoss)}
            </div>
            <div className={`text-sm ${metrics.totalGainLoss >= 0 ? 'text-gain' : 'text-loss'}`} data-testid="total-gain-loss-percent">
              {formatPercent(metrics.totalGainLossPercent)}
            </div>
          </div>

          {/* Cash Balance */}
          <div className="bg-card rounded-lg p-5 border border-line" data-testid="cash-balance-card">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
              <PieChart className="w-4 h-4" />
              Cash Balance
            </div>
            <div className="text-2xl font-bold text-text-primary" data-testid="cash-balance">
              {formatCurrency(metrics.cashBalance)}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {((metrics.cashBalance / metrics.totalValue) * 100).toFixed(1)}% of portfolio
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-card rounded-lg border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-lg font-semibold text-text-primary">Holdings</h2>
          </div>

          {portfolio.holdings?.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              No holdings yet. Add stocks to your portfolio to see them here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Symbol</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Shares</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Avg Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Current Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Market Value</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {portfolio.holdings.map((holding) => {
                    const quote = quotes[holding.symbol];
                    const currentPrice = quote?.c || holding.average_cost;
                    const marketValue = holding.total_shares * currentPrice;
                    const costBasis = holding.total_shares * holding.average_cost;
                    const gainLoss = marketValue - costBasis;
                    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

                    return (
                      <tr
                        key={holding.id}
                        className="hover:bg-card-hover cursor-pointer transition-colors"
                        onClick={() => navigate(`/stock/${holding.symbol}`)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium text-text-primary">{holding.symbol}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-text-primary">
                          {holding.total_shares.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right text-text-secondary">
                          {formatCurrency(holding.average_cost)}
                        </td>
                        <td className="px-6 py-4 text-right text-text-primary">
                          {formatCurrency(currentPrice)}
                        </td>
                        <td className="px-6 py-4 text-right text-text-primary font-medium">
                          {formatCurrency(marketValue)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`font-medium ${gainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {formatChange(gainLoss)}
                          </div>
                          <div className={`text-xs ${gainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {formatPercent(gainLossPercent)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        {portfolio.recent_transactions?.length > 0 && (
          <div className="mt-8 bg-card rounded-lg border border-line overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Recent Transactions</h2>
              <select
                data-testid="transaction-filter"
                value={transactionFilter}
                onChange={(e) => setTransactionFilter(e.target.value)}
                className="px-3 py-1.5 border border-line rounded-md text-sm bg-page-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="all">All Types</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="dividend">Dividend</option>
                <option value="split">Split</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Symbol</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Shares</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Fees</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-card-hover">
                      <td className="px-6 py-4 text-text-secondary text-sm">
                        {new Date(tx.executed_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          tx.type === 'buy' ? 'bg-gain/10 text-gain' :
                          tx.type === 'dividend' ? 'bg-brand/10 text-brand' :
                          tx.type === 'split' ? 'bg-text-secondary/10 text-text-primary' :
                          'bg-loss/10 text-loss'
                        }`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-text-primary">{tx.symbol}</td>
                      <td className="px-6 py-4 text-right text-text-primary">{tx.shares}</td>
                      <td className="px-6 py-4 text-right text-text-secondary">{formatCurrency(tx.price)}</td>
                      <td className="px-6 py-4 text-right text-text-muted">{formatCurrency(tx.fees || 0)}</td>
                      <td className="px-6 py-4 text-right text-text-primary font-medium">
                        {formatCurrency(tx.shares * tx.price)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          data-testid={`edit-tx-${tx.id}`}
                          onClick={() => setEditingTransaction(tx)}
                          className="p-1.5 hover:bg-card-hover rounded transition-colors text-text-secondary hover:text-text-primary"
                          title="Edit transaction"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Transaction Modal */}
        <AddTransactionModal
          isOpen={showAddTransactionModal}
          onClose={() => setShowAddTransactionModal(false)}
          portfolioId={id}
          portfolioCash={metrics?.cashBalance || 0}
          onSuccess={async () => {
            // Refresh portfolio data
            const data = await fetchPortfolioDetail(id, true);
            setPortfolio(data);
          }}
        />

        <EditTransactionModal
          isOpen={editingTransaction !== null}
          transaction={editingTransaction}
          portfolioId={id}
          onClose={() => setEditingTransaction(null)}
          onSuccess={async () => {
            // Refresh portfolio data
            const data = await fetchPortfolioDetail(id, true);
            setPortfolio(data);
            setEditingTransaction(null);
          }}
        />
      </div>
    </Layout>
  );
}

export default PortfolioDetail;
