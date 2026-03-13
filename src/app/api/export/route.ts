import { NextRequest, NextResponse } from 'next/server';
import { supabase, getUserId } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// GET /api/export?year=2026&month=3&format=csv|excel
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const format = searchParams.get('format') || 'csv';

    if (!year || !month) {
        return NextResponse.json(
            { error: 'year and month are required' },
            { status: 400 },
        );
    }

    // Get budget
    const { data: budget } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', await getUserId())
        .eq('year', parseInt(year))
        .eq('month', parseInt(month))
        .single();

    if (!budget) {
        return NextResponse.json(
            { error: 'No budget found for this month' },
            { status: 404 },
        );
    }

    // Get all entries with expenses
    const { data: entries } = await supabase
        .from('daily_entries')
        .select(`
      *,
      expense_items (*)
    `)
        .eq('budget_id', budget.id)
        .order('entry_date', { ascending: true });

    // Flatten data for export
    const rows: Record<string, string | number>[] = [];
    (entries || []).forEach((entry) => {
        const items = (entry as { expense_items?: Array<{ category: string; description: string | null; amount: number }> }).expense_items || [];
        if (items.length === 0) {
            rows.push({
                Date: entry.entry_date,
                Category: '',
                Description: entry.notes || '',
                Amount: 0,
            });
        } else {
            items.forEach((item) => {
                rows.push({
                    Date: entry.entry_date,
                    Category: item.category,
                    Description: item.description || '',
                    Amount: item.amount,
                });
            });
        }
    });

    if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${year}-${month}`);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="budget_${year}_${month}.xlsx"`,
            },
        });
    }

    // CSV format
    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="budget_${year}_${month}.csv"`,
        },
    });
}
