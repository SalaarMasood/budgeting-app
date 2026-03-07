'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrencyPlain } from '@/lib/calculations';
import { useToast } from '@/components/Toast';
import type { Debt } from '@/lib/types';
import { getTodayPSTStr } from '@/lib/dateUtils';

export default function DebtsPage() {
    const { showToast } = useToast();
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'open' | 'settled'>('open');

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [personName, setPersonName] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'credit' | 'debit'>('credit');
    const [note, setNote] = useState('');
    const [entryDate, setEntryDate] = useState(getTodayPSTStr());
    const [submitting, setSubmitting] = useState(false);

    // Settle flow state
    const [settleDebtId, setSettleDebtId] = useState<string | null>(null);
    const [settleDebtItem, setSettleDebtItem] = useState<Debt | null>(null);
    const [expenseCategory, setExpenseCategory] = useState('Other');
    const [settling, setSettling] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPersonName, setEditPersonName] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editType, setEditType] = useState<'credit' | 'debit'>('credit');
    const [editNote, setEditNote] = useState('');
    const [editEntryDate, setEditEntryDate] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const fetchDebts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/debts');
            const data = await res.json();
            setDebts(Array.isArray(data) ? data : []);
        } catch {
            showToast('Failed to load debts', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchDebts();
    }, [fetchDebts]);

    const openDebts = debts.filter((d) => d.status === 'open');
    const totalCredit = openDebts
        .filter((d) => d.type === 'credit')
        .reduce((sum, d) => sum + Number(d.amount), 0);
    const totalDebit = openDebts
        .filter((d) => d.type === 'debit')
        .reduce((sum, d) => sum + Number(d.amount), 0);
    const netPosition = totalCredit - totalDebit;

    const handleAddDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!personName || !amount || Number(amount) <= 0) return;
        setSubmitting(true);

        try {
            const res = await fetch('/api/debts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    person_name: personName,
                    amount: Number(amount),
                    type,
                    note: note || null,
                    entry_date: entryDate || undefined,
                }),
            });

            if (res.ok) {
                showToast(`${type === 'credit' ? 'Credit' : 'Debit'} added for ${personName}`);
                setPersonName('');
                setAmount('');
                setNote('');
                setShowForm(false);
                fetchDebts();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to add debt', 'error');
            }
        } catch {
            showToast('Failed to add debt', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const openSettleModal = (debt: Debt) => {
        if (debt.type === 'credit') {
            // Credits just settle instantly, no expense to log
            executeSettle(debt.id);
        } else {
            setSettleDebtId(debt.id);
            setSettleDebtItem(debt);
            setExpenseCategory('Other');
        }
    };

    const executeSettle = async (id: string) => {
        setSettling(true);
        try {
            const res = await fetch('/api/debts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status: 'settled',
                    settled_date: getTodayPSTStr()
                }),
            });
            if (res.ok) {
                showToast('Marked as settled');
                fetchDebts();
            }
        } catch {
            showToast('Failed to settle', 'error');
        } finally {
            setSettling(false);
            setSettleDebtId(null);
            setSettleDebtItem(null);
        }
    };

    const confirmSettleWithExpense = async (logAsExpense: boolean) => {
        if (!settleDebtId || !settleDebtItem) return;

        if (logAsExpense) {
            setSettling(true);
            try {
                const todayStr = getTodayPSTStr();
                const now = new Date(); // Using raw Date just to extract current year/month for the entry
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;

                // 1. Ensure daily entry exists
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

                // 2. Insert expense
                await fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        daily_entry_id: entry.id,
                        category: expenseCategory,
                        description: `Settled Debt: ${settleDebtItem.person_name}`,
                        amount: Number(settleDebtItem.amount),
                        total_paid: Number(settleDebtItem.amount),
                        entry_date: todayStr
                    }),
                });
            } catch {
                showToast('Failed to log expense', 'error');
                setSettling(false);
                return; // Stop if expense fails to create
            }
        }

        // Proceed to actually settle the debt
        await executeSettle(settleDebtId);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/debts?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Debt removed');
                fetchDebts();
            }
        } catch {
            showToast('Failed to delete', 'error');
        }
    };

    const handleEditClick = (debt: Debt) => {
        setEditingId(debt.id);
        setEditPersonName(debt.person_name);
        setEditAmount(debt.amount.toString());
        setEditType(debt.type);
        setEditNote(debt.note || '');
        setEditEntryDate(debt.entry_date ? new Date(debt.entry_date).toISOString().split('T')[0] : getTodayPSTStr());
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editPersonName || !editAmount || Number(editAmount) <= 0) return;
        setSavingEdit(true);

        try {
            const res = await fetch('/api/debts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    person_name: editPersonName,
                    amount: Number(editAmount),
                    type: editType,
                    note: editNote || null,
                    entry_date: editEntryDate || undefined,
                }),
            });

            if (res.ok) {
                showToast('Debt updated');
                setEditingId(null);
                fetchDebts();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to update debt', 'error');
            }
        } catch {
            showToast('Failed to update debt', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    // Calculate net balances per person based on open debts
    const openDebtsRaw = debts.filter((d) => d.status === 'open');
    const personBalances: Record<string, { net: number, debts: Debt[] }> = {};

    openDebtsRaw.forEach(debt => {
        const name = debt.person_name.toLowerCase().trim();

        if (!personBalances[name]) {
            personBalances[name] = { net: 0, debts: [] };
        }

        personBalances[name].debts.push(debt);
        personBalances[name].net += debt.type === 'credit' ? Number(debt.amount) : -Number(debt.amount);
    });

    // We still need the original flats array for "Settled" tab
    const filteredDebts = debts.filter((d) => d.status === activeTab);

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Debt Tracker</h1>
                <p className="page-subtitle">Manage credits and debits with people</p>
            </div>

            {/* Summary */}
            <div className="stats-grid">
                <div className="stat-card success">
                    <div className="stat-icon success">💵</div>
                    <div className="stat-label">People Owe You</div>
                    <div className="stat-value positive">{formatCurrencyPlain(totalCredit)}</div>
                </div>
                <div className="stat-card danger">
                    <div className="stat-icon danger">💳</div>
                    <div className="stat-label">You Owe People</div>
                    <div className="stat-value negative">{formatCurrencyPlain(totalDebit)}</div>
                </div>
                <div className={`stat-card ${netPosition >= 0 ? 'success' : 'danger'}`}>
                    <div className={`stat-icon ${netPosition >= 0 ? 'success' : 'danger'}`}>
                        {netPosition >= 0 ? '📈' : '📉'}
                    </div>
                    <div className="stat-label">Net Position</div>
                    <div className={`stat-value ${netPosition >= 0 ? 'positive' : 'negative'}`}>
                        {netPosition >= 0 ? '+' : ''}{formatCurrencyPlain(netPosition)}
                    </div>
                </div>
            </div>

            {/* Add button */}
            <div className="section-header">
                <h2 className="section-title">Debts</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
                    + Add {type === 'credit' ? 'Credit' : 'Debit'}
                </button>
            </div>

            {/* Add form */}
            {showForm && (
                <div className="card fade-in" style={{ marginBottom: 'var(--space-lg)' }}>
                    <form onSubmit={handleAddDebt}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Person&apos;s Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Name"
                                    value={personName}
                                    onChange={(e) => setPersonName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Amount (PKR)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="1"
                                    step="1"
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select
                                    className="form-select"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
                                >
                                    <option value="credit">Credit (they owe me)</option>
                                    <option value="debit">Debit (I owe them)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note (optional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="What for?"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <label className="form-label">Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Adding...' : `Add ${type === 'credit' ? 'Credit' : 'Debit'}`}
                        </button>
                    </form>
                </div>
            )}

            {/* Settle Modal */}
            {settleDebtId && settleDebtItem && (
                <div className="card fade-in" style={{ marginBottom: 'var(--space-lg)', border: '1px solid var(--primary)' }}>
                    <h3 className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>Settle Debit</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '14px' }}>
                        You are settling a debt of <strong>{formatCurrencyPlain(Number(settleDebtItem.amount))}</strong> to {settleDebtItem.person_name}.
                        Would you like to log this as a daily expense for today so it affects your &quot;Spent Today&quot; calculations?
                    </p>

                    <div className="form-group">
                        <label className="form-label">Expense Category (if logging)</label>
                        <select
                            className="form-select"
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                        >
                            {/* Manually duplicate categories or import them if available. Using common ones to be safe. */}
                            <option value="Other">Other</option>
                            <option value="Food">Food</option>
                            <option value="Transport">Transport</option>
                            <option value="Shopping">Shopping</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Health">Health</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => confirmSettleWithExpense(true)}
                            disabled={settling}
                        >
                            {settling ? 'Processing...' : 'Yes, Log as Expense'}
                        </button>
                        <button
                            className="btn"
                            onClick={() => confirmSettleWithExpense(false)}
                            disabled={settling}
                        >
                            No, Just Settle It
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => { setSettleDebtId(null); setSettleDebtItem(null); }}
                            disabled={settling}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'open' ? 'active' : ''}`}
                    onClick={() => setActiveTab('open')}
                >
                    Open ({debts.filter((d) => d.status === 'open').length})
                </button>
                <button
                    className={`tab ${activeTab === 'settled' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settled')}
                >
                    Settled ({debts.filter((d) => d.status === 'settled').length})
                </button>
            </div>

            {/* Debts list */}
            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : activeTab === 'open' && Object.keys(personBalances).length > 0 ? (
                <div className="list">
                    {Object.entries(personBalances).map(([name, data]) => (
                        <div key={name} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 'var(--space-sm)' }}>
                                <div className="list-item-content">
                                    <div
                                        className="list-item-icon"
                                        style={{
                                            background: data.net === 0 ? 'var(--neutral-bg)' : data.net > 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                                        }}
                                    >
                                        {data.net === 0 ? '⚖️' : data.net > 0 ? '↙️' : '↗️'}
                                    </div>
                                    <div className="list-item-text">
                                        <span className="list-item-title" style={{ textTransform: 'capitalize' }}>{name}</span>
                                        <span className="list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                            {data.debts.length} active {data.debts.length === 1 ? 'record' : 'records'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <span
                                        className="list-item-amount"
                                        style={{ color: data.net === 0 ? 'var(--text-secondary)' : data.net > 0 ? 'var(--success)' : 'var(--danger)' }}
                                    >
                                        {data.net === 0 ? 'Settled (Net 0)' : `${data.net > 0 ? '+' : ''}${formatCurrencyPlain(data.net)}`}
                                    </span>
                                </div>
                            </div>

                            {/* Show individual records for this person indented */}
                            <div style={{ paddingLeft: 'calc(40px + var(--space-md))', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                {data.debts.map(debt => (
                                    <div key={debt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-xs) 0', borderTop: '1px solid var(--border)' }}>
                                        {editingId === debt.id ? (
                                            <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' }}>
                                                <div className="form-row">
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={editPersonName}
                                                        onChange={(e) => setEditPersonName(e.target.value)}
                                                        placeholder="Person's Name"
                                                        required
                                                    />
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={editAmount}
                                                        onChange={(e) => setEditAmount(e.target.value)}
                                                        placeholder="Amount"
                                                        min="1"
                                                        step="1"
                                                        required
                                                    />
                                                </div>
                                                <div className="form-row">
                                                    <select
                                                        className="form-select"
                                                        value={editType}
                                                        onChange={(e) => setEditType(e.target.value as 'credit' | 'debit')}
                                                    >
                                                        <option value="credit">Credit</option>
                                                        <option value="debit">Debit</option>
                                                    </select>
                                                    <input
                                                        type="date"
                                                        className="form-input"
                                                        value={editEntryDate}
                                                        onChange={(e) => setEditEntryDate(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={editNote}
                                                    onChange={(e) => setEditNote(e.target.value)}
                                                    placeholder="Note (optional)"
                                                />
                                                <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-sm" onClick={handleCancelEdit}>Cancel</button>
                                                    <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={savingEdit}>
                                                        {savingEdit ? 'Saving...' : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '14px' }}>
                                                    <span className={`badge ${debt.type}`} style={{ marginRight: 'var(--space-xs)', padding: '2px 6px', fontSize: '11px' }}>{debt.type}</span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{debt.note || (debt.type === 'credit' ? 'Owed' : 'Borrowed')} · {new Date(debt.entry_date).toLocaleDateString()}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                    <span style={{ fontWeight: 500, color: debt.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                                                        {debt.type === 'credit' ? '+' : '-'}{formatCurrencyPlain(Number(debt.amount))}
                                                    </span>
                                                    <div className="list-item-actions">
                                                        <button
                                                            className="btn btn-sm"
                                                            onClick={() => handleEditClick(debt)}
                                                            style={{ marginRight: 'var(--space-xs)', padding: '4px' }}
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button className="btn btn-success btn-sm" onClick={() => openSettleModal(debt)} style={{ marginRight: 'var(--space-xs)', padding: '4px' }}>
                                                            ✓
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(debt.id)} style={{ padding: '4px' }}>
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : activeTab === 'settled' && filteredDebts.length > 0 ? (
                <div className="list">
                    {filteredDebts.map((debt) => (
                        <div key={debt.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <div className="list-item-content">
                                    <div
                                        className="list-item-icon"
                                        style={{
                                            background: 'var(--neutral-bg)',
                                        }}
                                    >
                                        ⚖️
                                    </div>
                                    <div className="list-item-text">
                                        <span className="list-item-title" style={{ textTransform: 'capitalize' }}>{debt.person_name}</span>
                                        <span className="list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                            {debt.note || 'Settled record'}
                                            {' · '}
                                            <span style={{ opacity: 0.7, fontSize: '0.9em' }}>
                                                {new Date(debt.entry_date).toLocaleDateString()}
                                            </span>
                                            {' · '}
                                            <span className={`badge ${debt.type}`}>{debt.type}</span>
                                            {' '}
                                            <span className={`badge settled`}>settled</span>
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <span
                                        className="list-item-amount"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {formatCurrencyPlain(Number(debt.amount))}
                                    </span>
                                    <div className="list-item-actions">
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(debt.id)}>
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">🤝</div>
                    <p className="empty-state-text">
                        No {activeTab} debts. {activeTab === 'open' ? 'All clear!' : 'Nothing settled yet.'}
                    </p>
                </div>
            )}
        </div>
    );
}
