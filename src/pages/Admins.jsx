import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Search, Plus, Trash2, Save, Shield } from 'lucide-react';
import Modal from '../components/Modal';

const Admins = () => {
    const { adminAccounts, addAdminAccount, deleteAdminAccount } = useData();
    const [search, setSearch] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

    const handleAddAdmin = () => {
        if (!newAdmin.email || !newAdmin.password) return;
        addAdminAccount({ ...newAdmin, created_at: new Date() });
        setIsAddOpen(false);
        setNewAdmin({ name: '', email: '', password: '' });
    };

    const filtered = (adminAccounts || []).filter(a =>
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Admin Management</h1>
                    <p style={{ color: 'var(--text-light)' }}>Manage system administrators</p>
                </div>
                <div>
                    <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
                        <Plus size={18} /> Add Admin
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
                <div className="filter-bar">
                    <div className="search-wrapper">
                        <Search size={18} />
                        <input
                            className="elegant-input"
                            placeholder="Search admins..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Created At</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((a, idx) => (
                                <tr key={a.id || idx}>
                                    <td style={{ fontWeight: '500' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Shield size={16} color="var(--primary)" />
                                            {a.name || 'System Admin'}
                                        </div>
                                    </td>
                                    <td>{a.email}</td>
                                    <td style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            className="btn-outline"
                                            style={{ border: 'none', color: 'var(--danger)', padding: '4px', cursor: 'pointer' }}
                                            onClick={() => {
                                                if (window.confirm('Delete this admin access?')) deleteAdminAccount(a.id);
                                            }}
                                            disabled={a.email === 'admin@psnacet.edu.in'} // Protect primary admin
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No admins found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Admin">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Name</label>
                        <input className="input-field" style={{ width: '100%' }} value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="e.g. John Doe" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Email</label>
                        <input type="email" className="input-field" style={{ width: '100%' }} value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} placeholder="admin@example.com" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Password</label>
                        <input type="password" className="input-field" style={{ width: '100%' }} value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Secure Password" />
                    </div>
                    <button className="btn btn-primary" onClick={handleAddAdmin} style={{ marginTop: '0.5rem' }}>
                        <Save size={18} style={{ marginRight: 8 }} /> Create Admin
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Admins;
