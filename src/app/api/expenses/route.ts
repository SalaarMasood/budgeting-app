import { NextRequest, NextResponse } from 'next/server';
import { supabase, getUserId } from '@/lib/supabase';
import { getTodayPSTStr } from '@/lib/dateUtils';

// POST /api/expenses
// Body: { daily_entry_id, category, description?, amount, total_paid?, splits?, entry_date? }
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { daily_entry_id, category, description, amount, total_paid, splits = [], entry_date } = body;

    const myShare = Number(amount);
    const totalPaid = total_paid !== undefined ? Number(total_paid) : myShare;

    if (!daily_entry_id || !category || amount === undefined) {
        return NextResponse.json(
            { error: 'daily_entry_id, category, and amount are required' },
            { status: 400 },
        );
    }

    if (myShare > totalPaid) {
        return NextResponse.json(
            { error: 'Your share cannot be greater than the total amount paid.' },
            { status: 400 },
        );
    }

    if (totalPaid > myShare) {
        if (!splits || splits.length === 0) {
            return NextResponse.json(
                { error: 'Please specify who owes you for the remaining amount.' },
                { status: 400 },
            );
        }

        const splitsSum = splits.reduce((sum: number, split: { amount: number }) => sum + Number(split.amount), 0);
        if (splitsSum !== (totalPaid - myShare)) {
            return NextResponse.json(
                { error: 'The split amounts must exactly add up to the remaining balance (Total Paid - My Share).' },
                { status: 400 }
            );
        }
    }

    // Use the RPC to atomically insert the expense and credits
    const { data, error } = await supabase.rpc('log_expense_with_splits', {
        p_user_id: await getUserId(),
        p_daily_entry_id: daily_entry_id,
        p_category: category,
        p_description: description || null,
        p_my_share: myShare,
        p_total_paid: totalPaid,
        p_splits: splits,
        p_entry_date: entry_date || getTodayPSTStr()
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE /api/expenses?id=...
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('expense_items')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

// PATCH /api/expenses
// Body: { id, category, description?, amount }
export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const { id, category, description, amount } = body;

    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (category) updates.category = category;
    if (description !== undefined) updates.description = description || null;
    if (amount !== undefined) updates.amount = amount;

    const { data, error } = await supabase
        .from('expense_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
