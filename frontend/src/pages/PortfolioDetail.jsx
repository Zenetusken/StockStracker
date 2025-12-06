import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, PieChart, ArrowUpRight, ArrowDownRight, Plus, Pencil, Trash2, X, Download, Upload, ChevronUp, ChevronDown, Layers, Receipt, MoreVertical } from 'lucide-react';
import Layout from '../components/Layout';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useQuotes } from '../stores/quoteStore';
import AddTransactionModal from '../components/AddTransactionModal';
import EditTransactionModal from '../components/EditTransactionModal';
import TaxLotsModal from '../components/TaxLotsModal';
import LotSalesModal from '../components/LotSalesModal';
import DeletePortfolioModal from '../components/DeletePortfolioModal';
import PortfolioValueChart from '../components/PortfolioValueChart';
import AllocationPieChart from '../components/AllocationPieChart';
import BenchmarkComparison from '../components/BenchmarkComparison';
import TopPerformers from '../components/TopPerformers';
import BottomPerformers from '../components/BottomPerformers';
import DividendIncome from '../components/DividendIncome';

function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Portfolio store
  const fetchPortfolioDetail = usePortfolioStore((state) => state.fetchPortfolioDetail);
  const deleteTransaction = usePortfolioStore((state) => state.deleteTransaction);
  const addTransaction = usePortfolioStore((state) => state.addTransaction);

  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [importStatus, setImportStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [deleteError, setDeleteError] = useState(null);
  const [holdingsSort, setHoldingsSort] = useState({ field: null, direction: 'desc' });
  const [holdingsFilter, setHoldingsFilter] = useState('all'); // 'all' | 'gainers' | 'losers'
  const [viewingTaxLots, setViewingTaxLots] = useState(null); // symbol string or null
  const [showLotSalesModal, setShowLotSalesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef(null);

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

  // Sorted and filtered holdings with calculated values
  const sortedHoldings = useMemo(() => {
    if (!portfolio?.holdings) return [];

    // Calculate total portfolio value for allocation percentage
    const totalPortfolioValue = metrics?.totalValue || 0;

    // Calculate values for each holding
    let holdingsWithValues = portfolio.holdings.map(holding => {
      const quote = quotes[holding.symbol];
      const currentPrice = quote?.c || holding.average_cost;
      const previousClose = quote?.pc || holding.average_cost;
      const marketValue = holding.total_shares * currentPrice;
      const costBasis = holding.total_shares * holding.average_cost;
      const gainLoss = marketValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
      const dayChange = holding.total_shares * (currentPrice - previousClose);
      const dayChangePercent = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
      const allocation = totalPortfolioValue > 0 ? (marketValue / totalPortfolioValue) * 100 : 0;

      return {
        ...holding,
        currentPrice,
        previousClose,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPercent,
        dayChange,
        dayChangePercent,
        allocation
      };
    });

    // Apply filter
    if (holdingsFilter === 'gainers') {
      holdingsWithValues = holdingsWithValues.filter(h => h.gainLoss >= 0);
    } else if (holdingsFilter === 'losers') {
      holdingsWithValues = holdingsWithValues.filter(h => h.gainLoss < 0);
    }

    // Apply sorting if a field is selected
    if (holdingsSort.field) {
      holdingsWithValues.sort((a, b) => {
        const aVal = a[holdingsSort.field];
        const bVal = b[holdingsSort.field];
        if (holdingsSort.direction === 'asc') {
          return aVal - bVal;
        }
        return bVal - aVal;
      });
    }

    return holdingsWithValues;
  }, [portfolio?.holdings, quotes, holdingsSort, holdingsFilter, metrics?.totalValue]);

  // Toggle sort for holdings
  const toggleHoldingsSort = (field) => {
    setHoldingsSort(prev => {
      if (prev.field === field) {
        // Toggle direction
        return { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      // New field, start with descending (highest first)
      return { field, direction: 'desc' };
    });
  };

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

  // Export holdings to CSV
  const exportHoldingsToCsv = () => {
    if (!sortedHoldings?.length) return;

    const headers = ['Symbol', 'Shares', 'Avg Cost', 'Current Price', 'Cost Basis', 'Market Value', 'Gain/Loss', 'Gain/Loss %', 'Day Change', 'Day Change %', 'Allocation %'];
    const rows = sortedHoldings.map(h => [
      h.symbol,
      h.total_shares,
      h.average_cost.toFixed(2),
      h.currentPrice.toFixed(2),
      h.costBasis.toFixed(2),
      h.marketValue.toFixed(2),
      h.gainLoss.toFixed(2),
      h.gainLossPercent.toFixed(2),
      h.dayChange.toFixed(2),
      h.dayChangePercent.toFixed(2),
      h.allocation.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${portfolio.name.replace(/\s+/g, '_')}_holdings_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Export transactions to CSV
  const exportToCsv = () => {
    if (!portfolio?.recent_transactions?.length) return;

    const headers = ['Date', 'Type', 'Symbol', 'Shares', 'Price', 'Fees', 'Total', 'Notes'];
    const rows = portfolio.recent_transactions.map(tx => [
      new Date(tx.executed_at).toISOString().split('T')[0],
      tx.type.toUpperCase(),
      tx.symbol,
      tx.shares,
      tx.price.toFixed(2),
      (tx.fees || 0).toFixed(2),
      (tx.shares * tx.price).toFixed(2),
      tx.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${portfolio.name.replace(/\s+/g, '_')}_transactions.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Import transactions from CSV
  const importFromCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());

      if (lines.length < 2) {
        setImportStatus({ type: 'error', message: 'CSV file is empty or has no data rows' });
        return;
      }

      // Parse header
      const header = lines[0].toLowerCase();
      const hasType = header.includes('type');
      const hasSymbol = header.includes('symbol');
      const hasShares = header.includes('shares');
      const hasPrice = header.includes('price');

      if (!hasType || !hasSymbol || !hasShares || !hasPrice) {
        setImportStatus({ type: 'error', message: 'CSV must have Type, Symbol, Shares, and Price columns' });
        return;
      }

      // Parse data rows
      const dataRows = lines.slice(1);
      let imported = 0;
      let errors = 0;

      for (const row of dataRows) {
        try {
          // Parse CSV row (handle quoted values)
          const values = row.match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];

          if (values.length < 4) continue;

          // Find column indices from header
          const headerCols = lines[0].match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').trim().toLowerCase()) || [];
          const dateIdx = headerCols.findIndex(c => c === 'date');
          const typeIdx = headerCols.findIndex(c => c === 'type');
          const symbolIdx = headerCols.findIndex(c => c === 'symbol');
          const sharesIdx = headerCols.findIndex(c => c === 'shares');
          const priceIdx = headerCols.findIndex(c => c === 'price');
          const feesIdx = headerCols.findIndex(c => c === 'fees');
          const notesIdx = headerCols.findIndex(c => c === 'notes');

          const type = values[typeIdx]?.toLowerCase();
          const symbol = values[symbolIdx]?.toUpperCase();
          const shares = parseFloat(values[sharesIdx]);
          const price = parseFloat(values[priceIdx]);
          const fees = feesIdx >= 0 ? parseFloat(values[feesIdx]) || 0 : 0;
          const notes = notesIdx >= 0 ? values[notesIdx] || '' : '';
          const dateStr = dateIdx >= 0 ? values[dateIdx] : null;

          // Validate
          if (!['buy', 'sell', 'dividend', 'split'].includes(type)) continue;
          if (!symbol || isNaN(shares) || isNaN(price)) continue;

          // Parse date
          let executedAt = new Date().toISOString().split('T')[0];
          if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              executedAt = parsed.toISOString().split('T')[0];
            }
          }

          await addTransaction(id, {
            type,
            symbol,
            shares,
            price,
            fees,
            notes,
            executed_at: executedAt
          });

          imported++;
        } catch {
          errors++;
        }
      }

      // Refresh portfolio data
      const data = await fetchPortfolioDetail(id, true);
      setPortfolio(data);

      if (imported > 0) {
        setImportStatus({ type: 'success', message: `Successfully imported ${imported} transaction${imported > 1 ? 's' : ''}${errors > 0 ? ` (${errors} failed)` : ''}` });
      } else {
        setImportStatus({ type: 'error', message: 'No valid transactions found in CSV' });
      }
    } catch (err) {
      setImportStatus({ type: 'error', message: `Import failed: ${err.message}` });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle successful portfolio deletion - navigate to portfolio list
  const handleDeleteSuccess = () => {
    navigate('/portfolio');
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLotSalesModal(true)}
                data-testid="realized-gains-button"
                className="flex items-center gap-2 px-4 py-2 bg-card border border-line text-text-primary rounded-lg hover:bg-card-hover transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Realized Gains
              </button>
              <button
                onClick={() => setShowAddTransactionModal(true)}
                data-testid="add-transaction-button"
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Transaction
              </button>

              {/* Menu button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-card-hover rounded-lg transition-colors"
                  data-testid="portfolio-menu-button"
                >
                  <MoreVertical className="w-5 h-5 text-text-secondary" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-line py-1 z-10">
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-card-hover flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        exportHoldingsToCsv();
                      }}
                      data-testid="menu-export-holdings"
                    >
                      <Download className="w-4 h-4 text-brand" />
                      Export Holdings
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-card-hover flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        exportToCsv();
                      }}
                      data-testid="menu-export-transactions"
                    >
                      <Download className="w-4 h-4 text-brand" />
                      Export Transactions
                    </button>
                    <div className="border-t border-line my-1"></div>
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-loss hover:bg-card-hover flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteModal(true);
                      }}
                      data-testid="menu-delete-portfolio"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Portfolio
                    </button>
                  </div>
                )}
              </div>
            </div>
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

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Portfolio Value Chart */}
          <PortfolioValueChart portfolioId={id} />

          {/* Allocation Pie Chart */}
          <AllocationPieChart
            holdings={sortedHoldings}
            totalValue={metrics.totalValue}
            cashBalance={metrics.cashBalance}
          />
        </div>

        {/* Benchmark Comparison */}
        <div className="mb-8">
          <BenchmarkComparison
            portfolioReturn={metrics.totalGainLoss}
            portfolioValue={metrics.totalValue}
            portfolioCostBasis={metrics.totalValue - metrics.totalGainLoss}
          />
        </div>

        {/* Dividend Income & Performers Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <DividendIncome transactions={portfolio?.recent_transactions} />
          <TopPerformers holdings={sortedHoldings} limit={5} />
          <BottomPerformers holdings={sortedHoldings} limit={5} />
        </div>

        {/* Holdings Table */}
        <div className="bg-card rounded-lg border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Holdings</h2>
            <div className="flex items-center gap-3">
              {sortedHoldings.length > 0 && (
                <button
                  data-testid="export-holdings-csv"
                  onClick={exportHoldingsToCsv}
                  className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-md text-sm bg-page-bg text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Holdings
                </button>
              )}
              <div className="flex gap-1">
              <button
                data-testid="filter-all"
                onClick={() => setHoldingsFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  holdingsFilter === 'all'
                    ? 'bg-brand text-white'
                    : 'bg-page-bg text-text-secondary hover:text-text-primary hover:bg-table-header'
                }`}
              >
                All
              </button>
              <button
                data-testid="filter-gainers"
                onClick={() => setHoldingsFilter('gainers')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  holdingsFilter === 'gainers'
                    ? 'bg-gain text-white'
                    : 'bg-page-bg text-text-secondary hover:text-gain hover:bg-gain/10'
                }`}
              >
                Gainers
              </button>
              <button
                data-testid="filter-losers"
                onClick={() => setHoldingsFilter('losers')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  holdingsFilter === 'losers'
                    ? 'bg-loss text-white'
                    : 'bg-page-bg text-text-secondary hover:text-loss hover:bg-loss/10'
                }`}
              >
                Losers
              </button>
            </div>
          </div>
          </div>

          {sortedHoldings.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              {holdingsFilter === 'all'
                ? 'No holdings yet. Add stocks to your portfolio to see them here.'
                : holdingsFilter === 'gainers'
                ? 'No holdings with gains.'
                : 'No holdings with losses.'}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Cost Basis</th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase cursor-pointer hover:text-text-primary select-none"
                      onClick={() => toggleHoldingsSort('marketValue')}
                      data-testid="sort-market-value"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Market Value
                        {holdingsSort.field === 'marketValue' && (
                          holdingsSort.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase cursor-pointer hover:text-text-primary select-none"
                      onClick={() => toggleHoldingsSort('gainLoss')}
                      data-testid="sort-gain-loss"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Gain/Loss
                        {holdingsSort.field === 'gainLoss' && (
                          holdingsSort.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase cursor-pointer hover:text-text-primary select-none"
                      onClick={() => toggleHoldingsSort('dayChange')}
                      data-testid="sort-day-change"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Day Change
                        {holdingsSort.field === 'dayChange' && (
                          holdingsSort.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase cursor-pointer hover:text-text-primary select-none"
                      onClick={() => toggleHoldingsSort('allocation')}
                      data-testid="sort-allocation"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Allocation
                        {holdingsSort.field === 'allocation' && (
                          holdingsSort.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedHoldings.map((holding) => (
                    <tr
                      key={holding.id}
                      className="hover:bg-card-hover cursor-pointer transition-colors"
                      onClick={() => navigate(`/stock/${holding.symbol}`)}
                      data-testid={`holding-row-${holding.symbol}`}
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
                        {formatCurrency(holding.currentPrice)}
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary" data-testid="cost-basis">
                        {formatCurrency(holding.costBasis)}
                      </td>
                      <td className="px-6 py-4 text-right text-text-primary font-medium" data-testid="market-value">
                        {formatCurrency(holding.marketValue)}
                      </td>
                      <td className="px-6 py-4 text-right" data-testid="gain-loss">
                        <div className={`font-medium ${holding.gainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {formatChange(holding.gainLoss)}
                        </div>
                        <div className={`text-xs ${holding.gainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {formatPercent(holding.gainLossPercent)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" data-testid="day-change">
                        <div className={`font-medium ${holding.dayChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {formatChange(holding.dayChange)}
                        </div>
                        <div className={`text-xs ${holding.dayChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {formatPercent(holding.dayChangePercent)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-text-primary" data-testid="allocation">
                        {holding.allocation.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          data-testid={`view-tax-lots-${holding.symbol}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingTaxLots(holding.symbol);
                          }}
                          className="p-1.5 hover:bg-card-hover rounded transition-colors text-text-secondary hover:text-brand"
                          title="View Tax Lots"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
              <div className="flex items-center gap-3">
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
                <button
                  data-testid="export-csv"
                  onClick={exportToCsv}
                  className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-md text-sm bg-page-bg text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={importFromCsv}
                  className="hidden"
                  data-testid="import-csv-input"
                />
                <button
                  data-testid="import-csv"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-md text-sm bg-page-bg text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
              </div>
            </div>
            {/* Import status message */}
            {importStatus && (
              <div
                data-testid="import-status"
                className={`px-6 py-3 ${importStatus.type === 'success' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}
              >
                {importStatus.message}
              </div>
            )}
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
                        <div className="flex items-center justify-center gap-1">
                          <button
                            data-testid={`edit-tx-${tx.id}`}
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1.5 hover:bg-card-hover rounded transition-colors text-text-secondary hover:text-text-primary"
                            title="Edit transaction"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            data-testid={`delete-tx-${tx.id}`}
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingTransaction(tx);
                            }}
                            className="p-1.5 hover:bg-loss/20 rounded transition-colors text-text-secondary hover:text-loss"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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

        {/* Delete Confirmation Modal */}
        {deletingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md" data-testid="delete-confirm-modal">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-line">
                <h2 className="text-xl font-semibold text-loss">
                  Delete Transaction
                </h2>
                <button
                  onClick={() => setDeletingTransaction(null)}
                  className="p-1 hover:bg-card-hover rounded transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-text-primary mb-4">
                  Are you sure you want to delete this transaction?
                </p>
                <div className="p-4 bg-table-header rounded-lg mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text-secondary">Type:</span>
                    <span className={`font-medium ${
                      deletingTransaction.type === 'buy' ? 'text-gain' :
                      deletingTransaction.type === 'dividend' ? 'text-brand' :
                      'text-loss'
                    }`}>
                      {deletingTransaction.type?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text-secondary">Symbol:</span>
                    <span className="text-text-primary font-medium">{deletingTransaction.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text-secondary">Shares:</span>
                    <span className="text-text-primary">{deletingTransaction.shares}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Price:</span>
                    <span className="text-text-primary">${deletingTransaction.price}</span>
                  </div>
                </div>
                {deleteError && (
                  <p className="text-sm text-loss mb-4">{deleteError}</p>
                )}
                <p className="text-sm text-text-muted">
                  This action cannot be undone. Portfolio holdings will be recalculated.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 p-6 pt-0">
                <button
                  onClick={() => setDeletingTransaction(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-delete"
                  onClick={async () => {
                    try {
                      setDeleteError(null);
                      await deleteTransaction(id, deletingTransaction.id);
                      const data = await fetchPortfolioDetail(id, true);
                      setPortfolio(data);
                      setDeletingTransaction(null);
                    } catch (err) {
                      console.error('Failed to delete transaction:', err);
                      setDeleteError('Failed to delete transaction. Please try again.');
                    }
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-loss rounded-lg hover:bg-loss/90 transition-colors"
                >
                  Delete Transaction
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tax Lots Modal */}
        <TaxLotsModal
          isOpen={viewingTaxLots !== null}
          onClose={() => setViewingTaxLots(null)}
          portfolioId={id}
          symbol={viewingTaxLots}
        />

        {/* Lot Sales / Realized Gains Modal */}
        <LotSalesModal
          isOpen={showLotSalesModal}
          onClose={() => setShowLotSalesModal(false)}
          portfolioId={id}
        />

        {/* Delete Portfolio Modal */}
        <DeletePortfolioModal
          portfolio={portfolio}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </Layout>
  );
}

export default PortfolioDetail;
