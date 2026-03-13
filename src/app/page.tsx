'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { buildBudgetSummary, buildDailySummary, formatCurrencyPlain } from '@/lib/calculations';
import { useToast } from '@/components/Toast';
import type { DailyEntry, Debt, ExpenseItem, MonthlyBudget } from '@/lib/types';
import { EXPENSE_CATEGORIES } from '@/lib/types';
import { getNowPST, getTodayPSTStr } from '@/lib/dateUtils';

export default function DashboardPage() {
  const { showToast } = useToast();
  const now = getNowPST();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = getTodayPSTStr();

  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick add state
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [expenseDescription, setExpenseDescription] = useState('');
  // expenseAmount now acts as 'total_paid'
  const [expenseAmount, setExpenseAmount] = useState('');
  const [myShare, setMyShare] = useState('');
  const [splits, setSplits] = useState<{ person_name: string; amount: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Auto-sync myShare with expenseAmount when expenseAmount changes
  useEffect(() => {
    setMyShare(expenseAmount);
  }, [expenseAmount]);

  // Handle split changes
  const addSplit = () => setSplits([...splits, { person_name: '', amount: '' }]);
  const removeSplit = (index: number) => setSplits(splits.filter((_, i) => i !== index));
  const updateSplit = (index: number, field: 'person_name' | 'amount', value: string) => {
    const newSplits = [...splits];
    newSplits[index][field] = value;
    setSplits(newSplits);
  };

  const remainingToSplit = Number(expenseAmount || 0) - Number(myShare || 0);
  const splitSum = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);


  const fetchData = useCallback(async () => {
    try {
      const [budgetRes, entriesRes, debtsRes] = await Promise.all([
        fetch(`/api/budgets?year=${currentYear}`),
        fetch(`/api/entries?year=${currentYear}&month=${currentMonth}`),
        fetch(`/api/debts`), // Fetch all debts, not just open ones
      ]);

      const budgets = await budgetRes.json();
      const currentBudget = Array.isArray(budgets)
        ? budgets.find((b: MonthlyBudget) => b.month === currentMonth)
        : null;
      setBudget(currentBudget || null);

      const entriesData = await entriesRes.json();
      setEntries(Array.isArray(entriesData) ? entriesData : []);

      const debtsData = await debtsRes.json();
      setDebts(Array.isArray(debtsData) ? debtsData : []);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate totals
  const totalSpent = entries.reduce((sum, entry) => {
    const items = entry.expense_items || [];
    return sum + items.reduce((s, item) => s + Number(item.amount), 0);
  }, 0);

  const todayEntry = entries.find((e) => e.entry_date === todayStr);
  const todayExpenses = (todayEntry?.expense_items || []).reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  const totalCredit = debts
    .filter((d) => d.type === 'credit' && d.status === 'open')
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const totalDebit = debts
    .filter((d) => d.type === 'debit' && d.status === 'open')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  // Real today spent = Expenses ONLY
  const todaySpent = todayExpenses;

  // Real monthly spent = Total expenses ONLY
  const totalMonthlySpent = totalSpent;

  // Calculate actual cashflow/liquidity impact from debts this month
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const creditsCreatedThisMonth = debts
    .filter(d => d.type === 'credit' && d.entry_date?.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const creditsSettledThisMonth = debts
    .filter(d => d.type === 'credit' && d.status === 'settled' && d.settled_date?.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const debitsCreatedThisMonth = debts
    .filter(d => d.type === 'debit' && d.entry_date?.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const debitsSettledThisMonth = debts
    .filter(d => d.type === 'debit' && d.status === 'settled' && d.settled_date?.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const liquidityImpactThisMonth =
    (- creditsCreatedThisMonth) + creditsSettledThisMonth + debitsCreatedThisMonth - debitsSettledThisMonth;

  const budgetAmount = budget ? Number(budget.budget_amount) : 0;
  const budgetStartDateStr = budget?.start_date || `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  const summary = buildBudgetSummary(
    budgetStartDateStr,
    budgetAmount,
    todayStr,
    totalMonthlySpent,
    totalCredit,
    totalDebit,
    liquidityImpactThisMonth
  );
  const daily = buildDailySummary(todayStr, todaySpent, summary.dailyBudget);

  // Quick add expense handler
  const handleQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) return;

    if (remainingToSplit > 0) {
      if (splits.length === 0) {
        showToast('Please add who owes you the remaining amount.', 'error');
        return;
      }
      if (splitSum !== remainingToSplit) {
        showToast(`Split amounts (${splitSum}) must equal the remaining balance (${remainingToSplit}).`, 'error');
        return;
      }

      // Validate all splits have names and amounts
      for (const split of splits) {
        if (!split.person_name.trim() || !split.amount || Number(split.amount) <= 0) {
          showToast('Please fill out all split names and amounts properly.', 'error');
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      // Ensure daily entry exists
      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: currentYear,
          month: currentMonth,
          entry_date: todayStr,
        }),
      });
      const entry = await entryRes.json();

      // Add expense item
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_entry_id: entry.id,
          category: expenseCategory,
          description: expenseDescription || null,
          amount: Number(myShare),
          total_paid: Number(expenseAmount),
          splits: remainingToSplit > 0 ? splits.map(s => ({ ...s, amount: Number(s.amount) })) : undefined,
          entry_date: todayStr
        }),
      });

      showToast(`Added ${formatCurrencyPlain(Number(myShare))} for ${expenseCategory}`);
      setExpenseAmount('');
      setMyShare('');
      setSplits([]);
      setExpenseDescription('');
      setShowQuickExpense(false);
      fetchData();
    } catch {
      showToast('Failed to add expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };



  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {format(now, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Today's Summary */}
      <div className="section-header">
        <h2 className="section-title">Today</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowQuickExpense(!showQuickExpense)}>
          + Quick Add
        </button>
      </div>

      {showQuickExpense && (
        <div className="card fade-in" style={{ marginBottom: 'var(--space-md)' }}>
          <form onSubmit={handleQuickExpense}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Total Paid (PKR)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  min="0"
                  step="1"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">My Share (PKR)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={myShare}
                  onChange={(e) => setMyShare(e.target.value)}
                  min="0"
                  max={expenseAmount ? Number(expenseAmount) : undefined}
                  step="1"
                  required
                />
              </div>
            </div>

            {/* Splits Section */}
            {remainingToSplit > 0 && (
              <div className="fade-in" style={{
                background: 'var(--bg-secondary)',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-md)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                  <label className="form-label" style={{ margin: 0 }}>Split Remaining: {formatCurrencyPlain(remainingToSplit)}</label>
                  <span style={{
                    fontSize: '14px',
                    color: splitSum === remainingToSplit ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 500
                  }}>
                    Allocated: {formatCurrencyPlain(splitSum)}
                  </span>
                </div>

                {splits.map((split, index) => (
                  <div key={index} className="form-row" style={{ alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Person's Name"
                        value={split.person_name}
                        onChange={(e) => updateSplit(index, 'person_name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Amount"
                        value={split.amount}
                        onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                        min="1"
                        step="1"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeSplit(index)}
                      style={{ marginTop: '4px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={addSplit}
                  style={{ marginTop: 'var(--space-sm)' }}
                >
                  + Add Person
                </button>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="What was this for?"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Expense'}
            </button>
          </form>
        </div>
      )}

      {/* Recovery & Today's Summary */}
      <div className="stats-grid">
        <div className="stat-card recovery">
          <div className="stat-icon warning">🚀</div>
          <div className="stat-label">Recovery Action</div>
          <div className="stat-value neutral">
            {formatCurrencyPlain(Math.max(0, Math.round(summary.recoveryTarget)))}
            <span className="unit">/day</span>
          </div>
          <p className="card-subtitle">
            Target to hit 0 by end of month
          </p>
        </div>

        <div className="stat-card compact-group">
          <div className="stat-group-item">
            <div className="stat-label">Spent Today</div>
            <div className="stat-value neutral font-md">{formatCurrencyPlain(daily.todaySpent)}</div>
          </div>
          <div className="stat-group-divider"></div>
          <div className="stat-group-item">
            <div className="stat-label">Daily Budget</div>
            <div className="stat-value neutral font-md">{formatCurrencyPlain(Math.round(daily.dailyBudget))}</div>
          </div>
          <div className={`stat-group-item bg-highlight ${daily.dailyProfitLoss >= 0 ? 'success' : 'danger'}`}>
             <div className="stat-label">Today&apos;s P/L</div>
             <div className={`stat-value font-md ${daily.dailyProfitLoss >= 0 ? 'positive' : 'negative'}`}>
               {daily.dailyProfitLoss >= 0 ? '+' : ''}{formatCurrencyPlain(Math.round(daily.dailyProfitLoss))}
             </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="section-header">
        <h2 className="section-title">This Month</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card full-width">
           <div className="stat-header">
             <div className="stat-icon accent">📊</div>
             <div className="stat-label-large">Monthly Pace</div>
             <div className={`pace-indicator ${summary.burnRate <= 1 ? 'good' : 'bad'}`}>
                {summary.burnRate <= 1 ? 'On Track' : 'Over Pace'}
             </div>
           </div>
           
           <div className="metrics-row">
             <div className="metric">
               <span className="metric-label">Budget</span>
               <span className="metric-value">{formatCurrencyPlain(summary.monthlyBudget)}</span>
             </div>
             <div className="metric">
               <span className="metric-label">Spent</span>
               <span className="metric-value">{formatCurrencyPlain(summary.totalSpent)}</span>
             </div>
             <div className="metric">
               <span className="metric-label">P/L</span>
               <span className={`metric-value ${summary.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                 {summary.profitLoss >= 0 ? '+' : ''}{formatCurrencyPlain(Math.round(summary.profitLoss))}
               </span>
             </div>
             <div className="metric">
               <span className="metric-label">Remaining</span>
               <span className="metric-value highlight">{formatCurrencyPlain(Math.round(summary.remaining))}</span>
             </div>
           </div>

           <div className="progress-bar-container">
             <div className="progress-bar">
               <div className="progress-fill" style={{ width: `${Math.min(100, (summary.totalSpent / summary.monthlyBudget) * 100)}%` }}></div>
               <div className="time-marker" style={{ left: `${Math.min(100, (summary.currentDay / summary.daysInMonth) * 100)}%` }}>
                 <span className="marker-label">Today</span>
               </div>
             </div>
           </div>
        </div>

        <div className="stat-card accent">
          <div className="stat-icon accent">🔄</div>
          <div className="stat-label">Adjusted Liquid Remaining</div>
          <div className={`stat-value ${summary.adjustedRemaining >= 0 ? 'neutral' : 'negative'}`}>
            {formatCurrencyPlain(Math.round(summary.adjustedRemaining))}
          </div>
          <div className="card-subtitle">
            After Credit ({formatCurrencyPlain(totalCredit)}) & Debit ({formatCurrencyPlain(totalDebit)})
          </div>
        </div>
      </div>

    </div>
  );
}

