import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { User, Lock, ArrowRight } from 'lucide-react';
import bcrypt from 'bcryptjs';

const Login = ({ onLogin }) => {
    const { facultyAccounts, teachers, adminAccounts } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        const emailInput = email.trim().toLowerCase();
        const passInput = password.trim();

        // Helper to check password (supports both hash and plain text)
        const checkPassword = (input, stored) => {
            if (!stored) return false;
            // Handle bcrypt hash
            if (typeof stored === 'string' && (stored.startsWith('$2a$') || stored.startsWith('$2b$'))) {
                try {
                    return bcrypt.compareSync(input, stored);
                } catch (err) { return false; }
            }
            // Handle plain text for legacy/dev
            return input === stored;
        };

        // 1. Check Admin
        const adminUser = (adminAccounts || []).find(acc =>
            acc.email.toLowerCase() === emailInput && checkPassword(passInput, acc.password)
        );

        if (adminUser) {
            onLogin('admin', adminUser);
            return;
        }

        // 2. Check Faculty Account (Explicit)
        const facultyUser = (facultyAccounts || []).find(acc =>
            acc.email.toLowerCase() === emailInput && checkPassword(passInput, acc.password)
        );

        if (facultyUser) {
            onLogin('faculty', facultyUser);
            return;
        }

        setError('Invalid email or password');
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
            <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--primary)', borderRadius: '12px', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem' }}>P</div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-light)' }}>Sign in to manage timetables</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="email"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
                                placeholder="E.g. admin@psnacet.edu.in"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="password"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
                                placeholder="Enter password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div style={{ color: 'var(--danger)', fontSize: '0.875rem', textAlign: 'center', padding: '0.5rem', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fee2e2' }}>{error}</div>}

                    <button type="submit" className="btn btn-primary" style={{ height: '44px', fontSize: '1rem' }}>
                        Sign In <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;