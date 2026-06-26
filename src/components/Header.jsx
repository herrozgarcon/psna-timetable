import React from 'react';
import { LogOut, Bell, User } from 'lucide-react';
import './Layout.css';

const Header = ({ onLogout, currentUser }) => {
    const displayName = currentUser?.name || 'Admin';
    const displayEmail = currentUser?.email || 'admin@psnacet.edu.in';
    const initial = displayName.charAt(0).toUpperCase();

    return (
        <header className="app-header">
            <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'white', padding: '4px', borderRadius: '8px', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <img src={`${import.meta.env.BASE_URL}logo.png`} alt="PSNA Logo" style={{ height: '32px', width: 'auto' }} />
                </div>
                PSNA TIME TABLE
            </div>

            <div className="header-profile">
                <div style={{ textAlign: 'right', marginRight: '0.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b' }}>{displayName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>{displayEmail}</div>
                </div>

                <div className="avatar">{initial}</div>

                <button
                    onClick={onLogout}
                    className="logout-btn"
                    title="Logout"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
};

export default Header;
