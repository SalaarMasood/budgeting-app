import { NextRequest, NextResponse } from 'next/server';
import { supabase, getUserId } from '@/lib/supabase';

// GET /api/entries?year=2026&month=3
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
        return NextResponse.json(
            { error: 'year and month are required' },
            { status: 400 },
        );
    }

    // First get the budget for this month
    const { data: budget, error: budgetError } = await supabase
        .from('monthly_budgets')
        .select('id')
        .eq('user_id', await getUserId())
        .eq('year', parseInt(year))
        .eq('month', parseInt(month))
        .single();

    if (budgetError || !budget) {
        return NextResponse.json([]);
    }

    // Get all entries with their expense items
    const { data, error } = await supabase
        .from('daily_entries')
        .select(`
      *,
      expense_items (*)
    `)
        .eq('budget_id', budget.id)
        .order('entry_date', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST /api/entries
// Body: { year, month, entry_date, notes? }
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { year, month, entry_date, notes } = body;

    if (!year || !month || !entry_date) {
        return NextResponse.json(
            { error: 'year, month, and entry_date are required' },
            { status: 400 },
        );
    }

    // Get or create budget for this month
    let { data: budget } = await supabase
        .from('monthly_budgets')
        .select('id')
        .eq('user_id', await getUserId())
        .eq('year', year)
        .eq('month', month)
        .single();

    if (!budget) {
        // Auto-create budget with 0 amount if none exists
        const { data: newBudget, error: createError } = await supabase
            .from('monthly_budgets')
            .insert({
                user_id: await getUserId(),
                year,
                month,
                budget_amount: 0,
            })
            .select()
            .single();

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 });
        }
        budget = newBudget;
    }

    // Upsert the daily entry
    const { data, error } = await supabase
        .from('daily_entries')
        .upsert(
            {
                budget_id: budget!.id,
                entry_date,
                notes: notes || null,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'budget_id,entry_date' },
        )
        .select(`
      *,
      expense_items (*)
    `)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
