'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/expenses', label: 'Expenses', icon: '💰' },
    { href: '/debts', label: 'Debts', icon: '🤝' },
    { href: '/history', label: 'History', icon: '📅' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Navbar() {
    const pathname = usePathname();
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <nav className="nav-sidebar">
            <div className="nav-logo">
                <div className="nav-logo-icon">💸</div>
                <span className="nav-logo-text">BudgetApp</span>
            </div>
            <ul className="nav-links">
                {NAV_ITEMS.map((item) => (
                    <li key={item.href}>
                        <Link
                            href={item.href}
                            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                        >
                            <span className="nav-link-icon">{item.icon}</span>
                            <span className="nav-link-text">{item.label}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
                <button
                    onClick={handleLogout}
                    className="nav-link"
                    style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer'
                    }}
                >
                    <span className="nav-link-icon">🚪</span>
                    <span className="nav-link-text">Logout</span>
                </button>
            </div>
        </nav>
    );
}
