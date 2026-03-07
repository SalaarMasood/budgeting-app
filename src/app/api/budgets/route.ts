import { NextRequest, NextResponse } from 'next/server';
import { supabase, USER_ID } from '@/lib/supabase';

// GET /api/budgets?year=2026
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    let query = supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', USER_ID)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

    if (year) {
        query = query.eq('year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST /api/budgets
// Body: { year, month, budget_amount, start_date? }
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { year, month, budget_amount, start_date } = body;

    if (!year || !month || budget_amount === undefined) {
        return NextResponse.json(
            { error: 'year, month, and budget_amount are required' },
            { status: 400 },
        );
    }

    const payload: Record<string, unknown> = {
        user_id: USER_ID,
        year,
        month,
        budget_amount,
        updated_at: new Date().toISOString(),
    };
    if (start_date) {
        payload.start_date = start_date;
    }

    // Upsert: insert or update if exists
    const { data, error } = await supabase
        .from('monthly_budgets')
        .upsert(
            payload,
            { onConflict: 'user_id,year,month' },
        )
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
