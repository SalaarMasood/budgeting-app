'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || 'Invalid password');
            }
        } catch (err) {
            setError('An error occurred while logging in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100vw',
            position: 'absolute',
            top: 0,
            left: 0,
            background: 'var(--bg-primary)',
            zIndex: 999
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-2xl)' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div className="nav-logo-icon" style={{ margin: '0 auto', marginBottom: 'var(--space-md)' }}>💸</div>
                    <h1 className="page-title">BudgetApp</h1>
                    <p className="page-subtitle">Sign in to access your budget</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: 'var(--space-xl)' }}>
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{
                            color: 'var(--danger)',
                            fontSize: '13px',
                            background: 'var(--danger-bg)',
                            padding: 'var(--space-sm)',
                            borderRadius: 'var(--radius-sm)',
                            marginBottom: 'var(--space-md)',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Using the demo version? Enter the demo password.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
