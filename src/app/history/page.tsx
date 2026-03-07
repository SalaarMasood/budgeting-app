'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrencyPlain } from '@/lib/calculations';
import { useToast } from '@/components/Toast';
import type { MonthlyBudget, DailyEntry, ExpenseItem } from '@/lib/types';
import { MONTHS } from '@/lib/types';

export default function HistoryPage() {
    const { showToast } = useToast();
    const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedYear, setExpandedYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);

    const fetchBudgets = useCallback(async () => {
        try {
            const res = await fetch('/api/budgets');
            const data = await res.json();
            setBudgets(Array.isArray(data) ? data : []);
        } catch {
            showToast('Failed to load budgets', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    // Group budgets by year
    const years = [...new Set(budgets.map((b) => b.year))].sort((a, b) => b - a);
    const budgetsByYear: Record<number, MonthlyBudget[]> = {};
    years.forEach((year) => {
        budgetsByYear[year] = budgets
            .filter((b) => b.year === year)
            .sort((a, b) => b.month - a.month);
    });

    const handleMonthClick = async (year: number, month: number) => {
        if (selectedMonth?.year === year && selectedMonth?.month === month) {
            setSelectedMonth(null);
            setEntries([]);
            return;
        }

        setSelectedMonth({ year, month });
        setLoadingEntries(true);

        try {
            const res = await fetch(`/api/entries?year=${year}&month=${month}`);
            const data = await res.json();
            setEntries(Array.isArray(data) ? data : []);
        } catch {
            showToast('Failed to load entries', 'error');
        } finally {
            setLoadingEntries(false);
        }
    };

    const handleExport = (format: 'csv' | 'excel') => {
        if (!selectedMonth) return;
        const url = `/api/export?year=${selectedMonth.year}&month=${selectedMonth.month}&format=${format}`;
        window.open(url, '_blank');
    };

    if (loading) {
        return <div className="loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Monthly History</h1>
                <p className="page-subtitle">Browse past months and years</p>
            </div>

            {years.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <p className="empty-state-text">
                        No budget history yet. Set a monthly budget in Settings to get started.
                    </p>
                </div>
            ) : (
                <div className="accordion">
                    {years.map((year) => (
                        <div key={year} className="accordion-item">
                            <button
                                className="accordion-header"
                                onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                            >
                                <span>{year}</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    {budgetsByYear[year].length} month{budgetsByYear[year].length !== 1 ? 's' : ''}
                                    {' · '}
                                    {expandedYear === year ? '▼' : '▶'}
                                </span>
                            </button>
                            {expandedYear === year && (
                                <div className="accordion-content">
                                    <div className="month-grid">
                                        {budgetsByYear[year].map((budget) => (
                                            <div
                                                key={budget.id}
                                                className="month-card"
                                                onClick={() => handleMonthClick(budget.year, budget.month)}
                                                style={{
                                                    borderColor:
                                                        selectedMonth?.year === budget.year && selectedMonth?.month === budget.month
                                                            ? 'var(--accent-primary)'
                                                            : undefined,
                                                }}
                                            >
                                                <div className="month-card-name">{MONTHS[budget.month - 1]}</div>
                                                <div className="month-card-amount">
                                                    Budget: {formatCurrencyPlain(Number(budget.budget_amount))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Selected month detail */}
            {selectedMonth && (
                <div className="card fade-in" style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="card-header">
                        <h3 className="section-title">
                            {MONTHS[selectedMonth.month - 1]} {selectedMonth.year}
                        </h3>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleExport('csv')}>
                                📄 CSV
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleExport('excel')}>
                                📊 Excel
                            </button>
                        </div>
                    </div>

                    {loadingEntries ? (
                        <div className="loading"><div className="spinner" /></div>
                    ) : entries.length > 0 ? (
                        <div className="list">
                            {entries.map((entry) => {
                                const items = entry.expense_items || [];
                                const dayTotal = items.reduce((s, i) => s + Number(i.amount), 0);
                                return (
                                    <div key={entry.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 'var(--space-sm)' : 0 }}>
                                            <span className="list-item-title">{entry.entry_date}</span>
                                            <span className="list-item-amount" style={{ color: 'var(--text-primary)' }}>
                                                {formatCurrencyPlain(dayTotal)}
                                            </span>
                                        </div>
                                        {items.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: 'var(--space-md)' }}>
                                                {items.map((item: ExpenseItem) => (
                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                        <span>{item.category}{item.description ? ` — ${item.description}` : ''}</span>
                                                        <span>{formatCurrencyPlain(Number(item.amount))}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p className="empty-state-text">No entries for this month.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
