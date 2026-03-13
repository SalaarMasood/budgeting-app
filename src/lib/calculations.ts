import { differenceInDays, parseISO, endOfMonth, startOfDay } from 'date-fns';
import type { BudgetSummary, DailySummary } from './types';

/**
 * Get number of days in a budget period (from start_date to end of month).
 */
export function daysInBudgetPeriod(startDateStr: string): number {
    const startDate = startOfDay(parseISO(startDateStr));
    const endDate = endOfMonth(startDate);
    // Add 1 because we want inclusive days (e.g. 1st to 31st is 31 days)
    return differenceInDays(endDate, startDate) + 1;
}

/**
 * Calculate daily budget from monthly budget.
 */
export function getDailyBudget(monthlyBudget: number, daysInPeriod: number): number {
    if (daysInPeriod <= 0) return 0;
    return monthlyBudget / daysInPeriod;
}

/**
 * Calculate expected spending by the current day.
 */
export function getExpectedSpending(dailyBudget: number, currentDay: number): number {
    return dailyBudget * currentDay;
}

/**
 * Calculate profit/loss: positive = under budget, negative = over budget.
 */
export function getProfitLoss(expectedSpending: number, totalSpent: number): number {
    return expectedSpending - totalSpent;
}

/**
 * Calculate adjusted remaining budget factoring in debts.
 * remaining + money_owed_to_user - money_user_owes
 */
export function getAdjustedRemaining(
    remaining: number,
    totalCredit: number,
    totalDebit: number,
): number {
    return remaining + totalCredit - totalDebit;
}

/**
 * Build full budget summary for a month.
 */
export function buildBudgetSummary(
    startDateStr: string,
    monthlyBudget: number,
    currentDateStr: string,
    totalSpent: number,
    totalCredit: number,
    totalDebit: number,
    liquidityImpactThisMonth: number = 0,
): BudgetSummary {
    const days = daysInBudgetPeriod(startDateStr);
    const daily = getDailyBudget(monthlyBudget, days);

    // Calculate how many days have passed since the start date
    const startObj = startOfDay(parseISO(startDateStr));
    const currentObj = startOfDay(parseISO(currentDateStr));
    // If current date is before start date, 0 days passed
    // If current date is within the period, calculate diff + 1 (for inclusive day)
    let elapsedDays = Math.max(0, differenceInDays(currentObj, startObj) + 1);
    // Cap elapsed days at the total days in period
    elapsedDays = Math.min(elapsedDays, days);

    const expected = getExpectedSpending(daily, elapsedDays);
    const remaining = monthlyBudget - totalSpent + liquidityImpactThisMonth;
    const profitLoss = getProfitLoss(expected, totalSpent);
    const adjustedRemaining = getAdjustedRemaining(remaining, totalCredit, totalDebit);

    // Calculate Recovery Target: How much can I spend per day for the rest of the month to hit 0?
    const remainingDays = days - elapsedDays;
    const recoveryTarget = remainingDays > 0 ? remaining / remainingDays : 0;

    // Calculate Burn Rate: % of budget spent vs % of month passed
    // 1.0 means spending exactly at the pace of time
    // > 1.0 means overspending
    const monthProgress = elapsedDays / days;
    const budgetProgress = totalSpent / monthlyBudget;
    const burnRate = monthProgress > 0 ? budgetProgress / monthProgress : 0;

    return {
        monthlyBudget,
        daysInMonth: days,
        currentDay: elapsedDays,
        dailyBudget: daily,
        expectedSpending: expected,
        totalSpent,
        remaining,
        profitLoss,
        totalCredit,
        totalDebit,
        adjustedRemaining,
        recoveryTarget,
        burnRate,
    };
}

/**
 * Build daily summary.
 */
export function buildDailySummary(
    date: string,
    todaySpent: number,
    dailyBudget: number,
): DailySummary {
    return {
        date,
        todaySpent,
        dailyBudget,
        dailyProfitLoss: dailyBudget - todaySpent,
    };
}

/**
 * Format currency amount.
 */
export function formatCurrency(amount: number, currency: string = 'PKR'): string {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString('en-PK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
    return `${sign}${currency} ${formatted}`;
}

/**
 * Format currency without sign prefix.
 */
export function formatCurrencyPlain(amount: number, currency: string = 'PKR'): string {
    return `${currency} ${amount.toLocaleString('en-PK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;
}
