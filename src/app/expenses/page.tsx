'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { formatCurrencyPlain } from '@/lib/calculations';
import { useToast } from '@/components/Toast';
import type { DailyEntry, ExpenseItem } from '@/lib/types';
import { EXPENSE_CATEGORIES } from '@/lib/types';
import { getNowPST, getTodayPSTStr } from '@/lib/dateUtils';

export default function ExpensesPage() {
    const { showToast } = useToast();
    const now = getNowPST();
    const [selectedDate, setSelectedDate] = useState(getTodayPSTStr());
    const [entry, setEntry] = useState<DailyEntry | null>(null);
    const [loading, setLoading] = useState(true);

    // Form state
    const [category, setCategory] = useState('Food');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(''); // Acts as 'totalPaid'
    const [myShare, setMyShare] = useState('');
    const [splits, setSplits] = useState<{ person_name: string; amount: string }[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Auto-sync myShare with amount
    useEffect(() => {
        setMyShare(amount);
    }, [amount]);

    // Handle split changes
    const addSplit = () => setSplits([...splits, { person_name: '', amount: '' }]);
    const removeSplit = (index: number) => setSplits(splits.filter((_, i) => i !== index));
    const updateSplit = (index: number, field: 'person_name' | 'amount', value: string) => {
        const newSplits = [...splits];
        newSplits[index][field] = value;
        setSplits(newSplits);
    };

    const remainingToSplit = Number(amount || 0) - Number(myShare || 0);
    const splitSum = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCategory, setEditCategory] = useState('Food');
    const [editDescription, setEditDescription] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const dateObj = parseISO(selectedDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/entries?year=${year}&month=${month}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const dayEntry = data.find((e: DailyEntry) => e.entry_date === selectedDate);
                setEntry(dayEntry || null);
            } else {
                setEntry(null);
            }
        } catch {
            showToast('Failed to load entries', 'error');
        } finally {
            setLoading(false);
        }
    }, [year, month, selectedDate, showToast]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const totalToday = (entry?.expense_items || []).reduce(
        (sum, item) => sum + Number(item.amount),
        0,
    );

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) return;

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
                body: JSON.stringify({ year, month, entry_date: selectedDate }),
            });
            const entryData = await entryRes.json();

            // Add expense
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    daily_entry_id: entryData.id,
                    category,
                    description: description || null,
                    amount: Number(myShare),
                    total_paid: Number(amount),
                    splits: remainingToSplit > 0 ? splits.map(s => ({ ...s, amount: Number(s.amount) })) : undefined,
                    entry_date: selectedDate
                }),
            });

            if (res.ok) {
                showToast(`Added ${formatCurrencyPlain(Number(myShare))} for ${category}`);
                setAmount('');
                setMyShare('');
                setSplits([]);
                setDescription('');
                fetchEntries();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to add expense', 'error');
            }
        } catch {
            showToast('Failed to add expense', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        try {
            const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Expense removed');
                fetchEntries();
            }
        } catch {
            showToast('Failed to delete expense', 'error');
        }
    };

    const handleEditClick = (item: ExpenseItem) => {
        setEditingId(item.id);
        setEditCategory(item.category);
        setEditDescription(item.description || '');
        setEditAmount(item.amount.toString());
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editAmount || Number(editAmount) <= 0) return;
        setSavingEdit(true);
        try {
            const res = await fetch('/api/expenses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    category: editCategory,
                    description: editDescription || null,
                    amount: Number(editAmount),
                }),
            });

            if (res.ok) {
                showToast('Expense updated');
                setEditingId(null);
                fetchEntries();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to update expense', 'error');
            }
        } catch {
            showToast('Failed to update expense', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Daily Expenses</h1>
                <p className="page-subtitle">Log and manage your daily spending</p>
            </div>

            {/* Date picker */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Select Date</label>
                    <input
                        type="date"
                        className="form-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={format(now, 'yyyy-MM-dd')}
                    />
                </div>
            </div>

            {/* Running total */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="stat-card accent">
                    <div className="stat-label">Total for {format(dateObj, 'EEEE, MMM d')}</div>
                    <div className="stat-value neutral">{formatCurrencyPlain(totalToday)}</div>
                </div>
                <div className="stat-card info">
                    <div className="stat-label">Items</div>
                    <div className="stat-value neutral">{(entry?.expense_items || []).length}</div>
                </div>
            </div>

            {/* Add expense form */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className="section-title" style={{ marginBottom: 'var(--space-md)' }}>Add Expense</h3>
                <form onSubmit={handleAddExpense}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select
                                className="form-select"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
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
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
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
                                max={amount ? Number(amount) : undefined}
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
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? 'Adding...' : 'Add Expense'}
                    </button>
                </form>
            </div>

            {/* Expense list */}
            <div className="section-header">
                <h2 className="section-title">Expenses</h2>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : (entry?.expense_items || []).length > 0 ? (
                <div className="list">
                    {(entry!.expense_items || []).map((item: ExpenseItem) => (
                        <div key={item.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            {editingId === item.id ? (
                                <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    <div className="form-row">
                                        <select
                                            className="form-select"
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                        >
                                            {EXPENSE_CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            min="0"
                                            step="1"
                                            required
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Description"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-sm" onClick={handleCancelEdit}>Cancel</button>
                                        <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={savingEdit}>
                                            {savingEdit ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <div className="list-item-content">
                                        <div className="list-item-icon" style={{ background: 'var(--info-bg)' }}>
                                            {getCategoryIcon(item.category)}
                                        </div>
                                        <div className="list-item-text">
                                            <span className="list-item-title">{item.category}</span>
                                            <span className="list-item-subtitle">{item.description || 'No description'}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        <span className="list-item-amount" style={{ color: 'var(--danger)' }}>
                                            -{formatCurrencyPlain(Number(item.amount))}
                                        </span>
                                        <div className="list-item-actions">
                                            <button
                                                className="btn btn-sm"
                                                onClick={() => handleEditClick(item)}
                                                style={{ marginRight: 'var(--space-xs)' }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteExpense(item.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <p className="empty-state-text">No expenses for this day yet.</p>
                </div>
            )}
        </div>
    );
}

function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
        Food: '🍽️', Snacks: '🍿',
        Transport: '🚗', Shopping: '🛒', Utilities: '⚡', Entertainment: '🎮',
        Education: '📚', Health: '💊', Other: '📦',
    };
    return icons[category] || '📦';
}
