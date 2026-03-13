import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        const adminPassword = process.env.ADMIN_PASSWORD;
        const demoPassword = process.env.DEMO_PASSWORD;

        if (!adminPassword || !demoPassword) {
            console.error('Missing passwords in environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (password === adminPassword) {
            const response = NextResponse.json({ success: true, role: 'admin' });
            response.cookies.set({
                name: 'auth-token',
                value: 'admin',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 30, // 30 days
            });
            return response;
        }

        if (password === demoPassword) {
            const response = NextResponse.json({ success: true, role: 'demo' });
            response.cookies.set({
                name: 'auth-token',
                value: 'demo',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7, // 7 days
            });
            return response;
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
    }
}
