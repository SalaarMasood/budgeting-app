'use client';

import { useState, useEffect, useRef } from 'react';
import { formatCurrencyPlain } from '@/lib/calculations';
import { useToast } from '@/components/Toast';
import type { MonthlyBudget } from '@/lib/types';
import { MONTHS } from '@/lib/types';
import { getNowPST } from '@/lib/dateUtils';

export default function SettingsPage() {
    const { showToast } = useToast();
    const now = getNowPST();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [startDate, setStartDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    const [budgetAmount, setBudgetAmount] = useState('');
    const [currentBudget, setCurrentBudget] = useState<MonthlyBudget | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    const fetchBudget = async (y: number, m: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/budgets?year=${y}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const found = data.find((b: MonthlyBudget) => b.month === m);
                setCurrentBudget(found || null);
                if (found) {
                    setBudgetAmount(String(found.budget_amount));
                    setStartDate(found.start_date || `${y}-${String(m).padStart(2, '0')}-01`);
                } else {
                    setBudgetAmount('');
                    setStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
                }
            }
        } catch {
            showToastRef.current('Failed to load budget', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBudget(year, month);
    }, [year, month]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!budgetAmount || Number(budgetAmount) < 0) return;
        setSubmitting(true);

        try {
            const res = await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year,
                    month,
                    budget_amount: Number(budgetAmount),
                    start_date: startDate,
                }),
            });

            if (res.ok) {
                showToast(`Budget set to ${formatCurrencyPlain(Number(budgetAmount))} for ${MONTHS[month - 1]} ${year}`);
                fetchBudget(year, month);
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to save', 'error');
            }
        } catch {
            showToast('Failed to save budget', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Generate year options
    const yearOptions = [];
    for (let y = 2024; y <= now.getFullYear() + 1; y++) {
        yearOptions.push(y);
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Manage your monthly budgets</p>
            </div>

            {/* Set monthly budget */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className="section-title" style={{ marginBottom: 'var(--space-md)' }}>
                    Monthly Budget
                </h3>

                <form onSubmit={handleSave}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Year</label>
                            <select
                                className="form-select"
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Month</label>
                            <select
                                className="form-select"
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Budget Amount (PKR)</label>
                        <input
                            type="number"
                            className="form-input"
                            placeholder="e.g. 30000"
                            value={budgetAmount}
                            onChange={(e) => setBudgetAmount(e.target.value)}
                            min="0"
                            step="100"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                    </div>

                    {currentBudget && !loading && (
                        <div style={{
                            padding: 'var(--space-md)',
                            background: 'var(--info-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-md)',
                            fontSize: '13px',
                            color: 'var(--info)',
                        }}>
                            Current budget for {MONTHS[month - 1]} {year}:{' '}
                            <strong>{formatCurrencyPlain(Number(currentBudget.budget_amount))}</strong>
                            {' — saving will update it.'}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={submitting || loading}>
                        {submitting ? 'Saving...' : currentBudget ? 'Update Budget' : 'Set Budget'}
                    </button>
                </form>
            </div>

            {/* App info */}
            <div className="card">
                <h3 className="section-title" style={{ marginBottom: 'var(--space-md)' }}>
                    About
                </h3>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <p><strong>BudgetApp</strong> — Personal Budget Tracker</p>
                    <p>Track daily spending, monitor budget performance, and manage debts.</p>
                    <p style={{ marginTop: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                        Built with Next.js • Supabase • PostgreSQL
                    </p>
                </div>
            </div>
        </div>
    );
}
