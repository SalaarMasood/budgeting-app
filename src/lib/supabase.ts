import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { cookies } from 'next/headers';

export const getUserId = async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (token === 'demo') {
        return process.env.NEXT_PUBLIC_DEMO_USER_ID || '00000000-0000-0000-0000-000000000002';
    }

    return process.env.NEXT_PUBLIC_USER_ID || '00000000-0000-0000-0000-000000000001';
};
