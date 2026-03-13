// ============================================
// Database Types
// ============================================

export interface User {
    id: string;
    name: string;
    email: string | null;
    currency: string;
    created_at: string;
}

export interface MonthlyBudget {
    id: string;
    user_id: string;
    year: number;
    month: number;
    budget_amount: number;
    start_date: string;
    created_at: string;
    updated_at: string;
}

export interface DailyEntry {
    id: string;
    budget_id: string;
    entry_date: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
    expense_items?: ExpenseItem[];
}

export interface ExpenseItem {
    id: string;
    daily_entry_id: string;
    category: string;
    description: string | null;
    amount: number;
    created_at: string;
}

export interface Debt {
    id: string;
    user_id: string;
    person_name: string;
    amount: number;
    type: 'credit' | 'debit';
    note: string | null;
    status: 'open' | 'settled';
    entry_date: string;
    settled_date: string | null;
    source_expense_id: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================
// Computed Types
// ============================================

export interface BudgetSummary {
    monthlyBudget: number;
    daysInMonth: number;
    currentDay: number;
    dailyBudget: number;
    expectedSpending: number;
    totalSpent: number;
    remaining: number;
    profitLoss: number;
    totalCredit: number;
    totalDebit: number;
    adjustedRemaining: number;
    recoveryTarget: number;
    burnRate: number; // percentage of budget spent vs percentage of month passed
}

export interface DailySummary {
    date: string;
    todaySpent: number;
    dailyBudget: number;
    dailyProfitLoss: number;
}

// ============================================
// Form Types
// ============================================

export interface ExpenseFormData {
    category: string;
    description: string;
    amount: number;
}

export interface DebtFormData {
    person_name: string;
    amount: number;
    type: 'credit' | 'debit';
    note: string;
    entry_date: string;
}

// ============================================
// Constants
// ============================================

export const EXPENSE_CATEGORIES = [
    'Food',
    'Snacks',
    'Transport',
    'Shopping',
    'Utilities',
    'Entertainment',
    'Education',
    'Health',
    'Other',
] as const;

export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
] as const;
