import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Clock, Save, Coffee, BookOpen, Edit2, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
const TimeSlots = () => {
    const { timeSlots, setTimeSlots } = useData();
    const [localSlots, setLocalSlots] = useState([]);
    useEffect(() => {
        if (timeSlots) {
            setLocalSlots(timeSlots);
        }
    }, [timeSlots]);
    const [newSlot, setNewSlot] = useState({ startTime: '', endTime: '', label: '', type: 'teaching' });
    const normalizeTime = (timeStr) => {
        if (!timeStr) return '';
        let [h, m] = timeStr.trim().split(':');
        let hour = parseInt(h, 10);
        if (hour >= 1 && hour <= 6) {
            hour += 12;
        }
        const hh = String(hour).padStart(2, '0');
        const mm = m ? m.padStart(2, '0') : '00';
        return `${hh}:${mm}`;
    };
    const extractPeriodNumber = (label) => {
        const match = label.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 999;
    };

    const handleSave = () => {
        const normalized = localSlots.map(slot => ({
            ...slot,
            id: String(slot.id || Date.now() + Math.random()),
            startTime: normalizeTime(slot.startTime),
            endTime: normalizeTime(slot.endTime)
        }));
        const sorted = normalized.sort((a, b) => {
            const timeCompare = a.startTime.localeCompare(b.startTime);
            if (timeCompare !== 0) return timeCompare;
            return extractPeriodNumber(a.label) - extractPeriodNumber(b.label);
        });
        setTimeSlots(sorted);
        setLocalSlots(sorted);
        alert('Configuration saved successfully! Time slots have been normalized and sorted.');
    };
    const [editingId, setEditingId] = useState(null);
    const handleAddSlot = () => {
        if (!newSlot.startTime || !newSlot.endTime || !newSlot.label) return;
        if (editingId) {
            setLocalSlots(prev => prev.map(slot =>
                String(slot.id) === String(editingId)
                    ? {
                        ...slot,
                        ...newSlot,
                        startTime: normalizeTime(newSlot.startTime),
                        endTime: normalizeTime(newSlot.endTime)
                    }
                    : slot
            ));
            setEditingId(null);
        } else {
            setLocalSlots(prev => [...prev, {
                id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                ...newSlot,
                startTime: normalizeTime(newSlot.startTime),
                endTime: normalizeTime(newSlot.endTime)
            }]);
        }
        setNewSlot({ startTime: '', endTime: '', label: '', type: 'teaching' });
    };
    const handleEditSlot = (slot) => {
        setNewSlot({
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: slot.label,
            type: slot.type
        });
        setEditingId(String(slot.id));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleCancelEdit = () => {
        setNewSlot({ startTime: '', endTime: '', label: '', type: 'teaching' });
        setEditingId(null);
    };
    const handleDeleteSlot = (id, label) => {
        if (window.confirm(`Delete "${label}"?`)) {
            setLocalSlots(prev => {
                const filtered = prev.filter(slot => String(slot.id) !== String(id));
                return filtered;
            });
            if (String(editingId) === String(id)) {
                handleCancelEdit();
            }
        }
    };
    useEffect(() => {
        if (localSlots.some(s => !s.id || typeof s.id === 'object')) {
            const clean = localSlots.map((s, i) => ({
                ...s,
                id: (s.id && typeof s.id !== 'object') ? String(s.id) : `fixed-${Date.now()}-${i}`
            }));
            setLocalSlots(clean);
        }
    }, [localSlots.length]);
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            const importedSlots = data.map((row, index) => {
                let type = 'teaching';
                if (row.Type) type = row.Type.toLowerCase();
                else if (row.Label && (row.Label.toLowerCase().includes('break') || row.Label.toLowerCase().includes('lunch'))) type = 'break';
                return {
                    id: `import-${Date.now()}-${index}`, // Robust ID
                    startTime: normalizeTime(row.Start || row.startTime || ''),
                    endTime: normalizeTime(row.End || row.endTime || ''),
                    label: row.Label || row.label || `Period ${index + 1}`,
                    type: type
                };
            }).filter(slot => slot.startTime && slot.endTime);
            const uniqueImportedSlots = [];
            const seenImported = new Set();
            for (const slot of importedSlots) {
                const key = `${slot.startTime}-${slot.endTime}`;
                if (!seenImported.has(key)) {
                    seenImported.add(key);
                    uniqueImportedSlots.push(slot);
                }
            }
            const newUniqueSlots = uniqueImportedSlots.filter(newSlot => {
                const isDuplicate = localSlots.some(existingSlot =>
                    existingSlot.startTime === newSlot.startTime &&
                    existingSlot.endTime === newSlot.endTime
                );
                return !isDuplicate;
            });
            if (newUniqueSlots.length < importedSlots.length) {
                const duplicateCount = importedSlots.length - newUniqueSlots.length;
                alert(`Import completed: ${newUniqueSlots.length} new slots added. ${duplicateCount} duplicates skipped.`);
            }
            setLocalSlots([...localSlots, ...newUniqueSlots]);
        };
        reader.readAsBinaryString(file);
    };
    const handleDownloadTemplate = () => {
        const templateData = [
            { Start: '09:00', End: '09:50', Label: 'Period 1', Type: 'teaching' },
            { Start: '09:50', End: '10:40', Label: 'Period 2', Type: 'teaching' },
            { Start: '10:40', End: '10:55', Label: 'Morning Break', Type: 'break' },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "time_slots_template.xlsx");
    };
    const formatTime12h = (time24) => {
        if (!time24) return '';
        const [h, m] = time24.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
    };
    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '0.5rem' }}>
                        Time Slots Management
                    </h1>
                    <p style={{ color: '#666' }}>Configure daily schedules and periods</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleSave}
                    style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                >
                    <Save size={20} />
                    Save Configuration
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* Left Column: Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Manual Entry Card */}
                    <div className="card" style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={20} className="text-primary" />
                            {editingId ? 'Update Slot' : 'Add Manual Slot'}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Label</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Period 1, Break"
                                    value={newSlot.label}
                                    onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Type</label>
                                <select
                                    value={newSlot.type}
                                    onChange={(e) => setNewSlot({ ...newSlot, type: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                >
                                    <option value="teaching">Teaching Period</option>
                                    <option value="break">Break / Lunch</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Start Time</label>
                                    <TimePicker12
                                        value={newSlot.startTime}
                                        onChange={(val) => setNewSlot({ ...newSlot, startTime: val })}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>End Time</label>
                                    <TimePicker12
                                        value={newSlot.endTime}
                                        onChange={(val) => setNewSlot({ ...newSlot, endTime: val })}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={handleAddSlot}
                                    style={{
                                        marginTop: '1rem',
                                        padding: '0.75rem',
                                        background: editingId ? '#f59e0b' : '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        flex: 1
                                    }}
                                >
                                    {editingId ? 'Update Slot' : 'Add Slot'}
                                </button>
                                {editingId && (
                                    <button
                                        onClick={handleCancelEdit}
                                        style={{
                                            marginTop: '1rem',
                                            padding: '0.75rem',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: 600
                                        }}
                                        title="Cancel Edit"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Upload Card */}
                    <div className="card" style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={20} className="text-secondary" />
                            Import from File
                        </h2>
                        <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            />
                            <FileSpreadsheetIcon size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                            <p style={{ fontWeight: 500, color: '#475569' }}>Click to upload Excel/CSV</p>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>Columns: Start, End, Label, Type</p>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleDownloadTemplate();
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#64748b',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                                className="hover:text-primary"
                            >
                                <span style={{ borderBottom: '1px solid currentColor' }}>Download Template Format</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: List */}
                <div className="card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Current Schedule</h2>
                        <span style={{ fontSize: '0.875rem', color: '#64748b', background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
                            {localSlots.length} Slots
                        </span>
                    </div>
                    <div style={{ overflowX: 'auto', paddingBottom: '2rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Period</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Type</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Start Time</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>End Time</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Duration</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...localSlots].sort((a, b) => {
                                    const tA = normalizeTime(a.startTime);
                                    const tB = normalizeTime(b.startTime);
                                    const timeCompare = tA.localeCompare(tB);
                                    if (timeCompare !== 0) return timeCompare;
                                    return extractPeriodNumber(a.label) - extractPeriodNumber(b.label);
                                }).map((slot) => (
                                    <tr key={slot.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: '#334155' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {slot.type === 'break' ? <Coffee size={16} className="text-orange-500" /> : <BookOpen size={16} className="text-primary" />}
                                                {slot.label}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                background: slot.type === 'break' ? '#fff7ed' : '#f0f9ff',
                                                color: slot.type === 'break' ? '#c2410c' : '#0369a1'
                                            }}>
                                                {slot.type === 'break' ? 'BREAK' : 'TEACHING'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: '#475569' }}>
                                            {formatTime12h(slot.startTime)}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: '#475569' }}>
                                            {formatTime12h(slot.endTime)}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>
                                            {calculateDuration(slot.startTime, slot.endTime)}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleEditSlot(slot)}
                                                style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', marginRight: '0.5rem' }}
                                                className="hover:bg-yellow-50"
                                                title="Edit Slot"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSlot(slot.id, slot.label)}
                                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', transition: 'background 0.2s' }}
                                                className="hover:bg-red-50"
                                                title="Delete Slot"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {localSlots.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            No time slots configured. Add one to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Component for 12h Time Selection
const TimePicker12 = ({ value, onChange }) => {
    // Parse existing value or default
    let h = '12', m = '00', ap = 'AM';
    if (value) {
        const [hh, mm] = value.split(':');
        const hour = parseInt(hh, 10);
        ap = hour >= 12 ? 'PM' : 'AM';
        h = String(hour % 12 || 12); // No leading zero logic if using select 1-12
        m = mm;
    }

    const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
    const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00, 05... 55

    const handleChange = (newH, newM, newAp) => {
        let hour24 = parseInt(newH, 10);
        if (newAp === 'PM' && hour24 !== 12) hour24 += 12;
        if (newAp === 'AM' && hour24 === 12) hour24 = 0;

        const hh = String(hour24).padStart(2, '0');
        onChange(`${hh}:${newM}`);
    };

    return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
                value={h}
                onChange={(e) => handleChange(e.target.value, m, ap)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}
            >
                {hours.map(hr => (
                    <option key={hr} value={hr}>{hr}</option>
                ))}
            </select>
            <span style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>:</span>
            <select
                value={m}
                onChange={(e) => handleChange(h, e.target.value, ap)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}
            >
                {minutes.map(min => (
                    <option key={min} value={min}>{min}</option>
                ))}
            </select>
            <select
                value={ap}
                onChange={(e) => handleChange(h, m, e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}
            >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    );
};

// Helper for duration
const calculateDuration = (start, end) => {
    if (!start || !end) return '';
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const diff = (endH * 60 + endM) - (startH * 60 + startM);
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins}m`;
};

// Helper Icon Component
const FileSpreadsheetIcon = ({ size, style }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
    >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M8 13h2" />
        <path d="M8 17h2" />
        <path d="M14 13h2" />
        <path d="M14 17h2" />
    </svg>
);

export default TimeSlots;
