import { NextRequest, NextResponse } from 'next/server';
import { supabase, getUserId } from '@/lib/supabase';
import { getTodayPSTStr } from '@/lib/dateUtils';

// GET /api/debts?status=open
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
        .from('debts')
        .select('*')
        .eq('user_id', await getUserId())
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST /api/debts
// Body: { person_name, amount, type, note? }
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { person_name, amount, type, note } = body;

    if (!person_name || !amount || !type) {
        return NextResponse.json(
            { error: 'person_name, amount, and type are required' },
            { status: 400 },
        );
    }

    if (!['credit', 'debit'].includes(type)) {
        return NextResponse.json(
            { error: 'type must be credit or debit' },
            { status: 400 },
        );
    }

    const payload: Record<string, unknown> = {
        user_id: await getUserId(),
        person_name,
        amount,
        type,
        note: note || null,
        status: 'open',
    };
    if (body.entry_date) {
        payload.entry_date = body.entry_date;
    }

    const { data, error } = await supabase
        .from('debts')
        .insert(payload)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// PATCH /api/debts
// Body: { id, status?, amount?, note? }
export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'settled') {
            updateData.settled_date = updates.settled_date || getTodayPSTStr();
        } else if (updates.status === 'open') {
            updateData.settled_date = null;
        }
    }
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.note !== undefined) updateData.note = updates.note;
    if (updates.person_name) updateData.person_name = updates.person_name;
    if (updates.type) updateData.type = updates.type;
    if (updates.entry_date) updateData.entry_date = updates.entry_date;

    const { data, error } = await supabase
        .from('debts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE /api/debts?id=...
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
