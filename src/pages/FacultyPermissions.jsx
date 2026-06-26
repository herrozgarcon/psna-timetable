import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Search, Save, CheckCircle, XCircle } from 'lucide-react';
import Modal from '../components/Modal';

const FacultyPermissions = () => {
    const { facultyAccounts, updateFacultyPermission } = useData();
    const [search, setSearch] = useState('');

    const filtered = (facultyAccounts || []).filter(a =>
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.email?.toLowerCase().includes(search.toLowerCase())
    );

    const togglePermission = (id, currentVal) => {
        updateFacultyPermission(id, !currentVal);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Faculty Permissions</h1>
                    <p style={{ color: 'var(--text-light)' }}>Manage advanced privileges for faculty members</p>
                </div>
            </div>

            <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
                <div className="filter-bar">
                    <div className="search-wrapper">
                        <Search size={18} />
                        <input
                            className="elegant-input"
                            placeholder="Search faculty..."
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
                                <th>Department</th>
                                <th style={{ textAlign: 'center' }}>Can Generate Timetable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((a, idx) => (
                                <tr key={a.id || idx}>
                                    <td style={{ fontWeight: '500' }}>{a.name}</td>
                                    <td>{a.email}</td>
                                    <td><span className="badge badge-info">{a.dept || 'General'}</span></td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="btn-outline"
                                            style={{
                                                border: 'none',
                                                background: a.can_generate ? '#dcfce7' : '#f1f5f9',
                                                color: a.can_generate ? '#166534' : '#64748b',
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => togglePermission(a.id, a.can_generate)}
                                        >
                                            {a.can_generate ? (
                                                <>
                                                    <CheckCircle size={16} /> Allowed
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle size={16} /> Restricted
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No faculty accounts found. Add teachers first.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FacultyPermissions;
