import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { loadFacultyTimetable, loadAllFacultyTimetables } from '../services/timetablePersistence';
import { Calendar, Layers, Printer, UserCircle, Users, ChevronDown } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const StaffTimetable = () => {
    const { teachers } = useData();
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [dbSchedule, setDbSchedule] = useState([]);
    const [isPrintingAll, setIsPrintingAll] = useState(false);
    const [allFacultyData, setAllFacultyData] = useState(null);
    const [isPreparingPrint, setIsPreparingPrint] = useState(false);

    // Extract a unique, sorted list of all faculty members from the teachers list
    const allFaculty = useMemo(() => {
        if (!teachers) return [];
        const uniqueNames = [...new Set(teachers.map(t => t.name))].filter(Boolean);
        return uniqueNames.sort((a, b) => a.localeCompare(b));
    }, [teachers]);

    // Fetch from Supabase when faculty changes
    useEffect(() => {
        let isMounted = true;
        const fetchFacultyTimetable = async () => {
            if (!selectedFaculty || !teachers) {
                if (isMounted) setDbSchedule([]);
                return;
            }
            
            const facultyObj = teachers.find(t => t.name === selectedFaculty);
            const facultyId = facultyObj ? facultyObj.id : selectedFaculty;
            
            try {
                const data = await loadFacultyTimetable(facultyId);
                if (isMounted) setDbSchedule(data || []);
            } catch (err) {
                console.error("Failed to load faculty timetable from DB", err);
                if (isMounted) setDbSchedule([]);
            }
        };
        fetchFacultyTimetable();
        return () => { isMounted = false; };
    }, [selectedFaculty, teachers]);

    const handlePrintAll = async () => {
        setIsPreparingPrint(true);
        try {
            const data = await loadAllFacultyTimetables();
            const grouped = {};
            data.forEach(row => {
                const fName = row.faculty_name;
                if (!fName) return;
                if (!grouped[fName]) {
                    grouped[fName] = Array(6).fill(null).map(() => Array(7).fill(null));
                }
                if (grouped[fName][row.day]) {
                    grouped[fName][row.day][row.period] = {
                        displayCode: row.course_code,
                        type: row.is_lab ? 'LAB' : 'REGULAR',
                        semester: row.semester,
                        section: row.section
                    };
                }
            });
            setAllFacultyData(grouped);
            setIsPrintingAll(true);
            setTimeout(() => {
                window.print();
                setIsPrintingAll(false);
                setIsPreparingPrint(false);
            }, 800);
        } catch (error) {
            console.error("Failed to prepare print:", error);
            setIsPreparingPrint(false);
            alert("Failed to prepare print document.");
        }
    };

    // Compute the selected faculty's personal timetable
    const mySchedule = useMemo(() => {
        const grid = Array(6).fill(null).map(() => Array(7).fill(null));
        if (!dbSchedule || dbSchedule.length === 0) return grid;

        dbSchedule.forEach(row => {
            if (grid[row.day]) {
                grid[row.day][row.period] = {
                    displayCode: row.course_code,
                    type: row.is_lab ? 'LAB' : 'REGULAR',
                    semester: row.semester,
                    section: row.section
                };
            }
        });
        
        return grid;
    }, [dbSchedule]);

    return (
        <div className="timetable-container">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
                .timetable-container {
                    font-family: 'Outfit', sans-serif;
                    padding: 1.5rem;
                    background: #f1f5f9;
                    min-height: 100vh;
                }
                @media screen {
                    .dashboard-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #1e293b;
                        padding: 1.5rem 2rem;
                        border-radius: 16px;
                        color: white;
                        margin-bottom: 2rem;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        flex-wrap: wrap;
                        gap: 1rem;
                    }
                    .control-group {
                        display: flex;
                        gap: 1rem;
                        align-items: center;
                    }
                    .faculty-select-wrapper {
                        position: relative;
                        display: flex;
                        align-items: center;
                        background: white;
                        border-radius: 10px;
                        padding: 0;
                        transition: all 0.2s ease;
                    }
                    .faculty-select-wrapper:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }
                    .faculty-select-wrapper svg {
                        color: #64748b;
                        position: absolute;
                        left: 1rem;
                        pointer-events: none;
                    }
                    .faculty-select {
                        padding: 0.6rem 2.5rem 0.6rem 2.5rem;
                        background: transparent;
                        border: none;
                        font-family: 'Outfit', sans-serif;
                        font-weight: 800;
                        font-size: 0.95rem;
                        min-width: 250px;
                        outline: none;
                        cursor: pointer;
                        color: #1e293b;
                        appearance: none;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                    }
                    .faculty-select option {
                        background: white;
                        color: #1e293b;
                        font-family: 'Outfit', sans-serif;
                    }
                    .select-arrow {
                        position: absolute;
                        right: 1rem;
                        pointer-events: none;
                        color: #64748b;
                    }
                    .btn-premium {
                        padding: 0.6rem 1.5rem;
                        border-radius: 10px;
                        font-weight: 800;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                        cursor: pointer;
                        border: none;
                    }
                    .btn-print { background: white; color: #1e293b; }
                    .btn-print:hover { background: #f8fafc; transform: translateY(-2px); }
                   
                    .timetable-glass-card {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                    }
                    .main-grid {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                    }
                    .main-grid th {
                        padding: 1.2rem 0.5rem;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 0.7rem;
                        font-weight: 600;
                        text-align: center;
                        border-bottom: 1px solid #e2e8f0;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .main-grid td {
                        padding: 8px;
                        border-bottom: 1px solid #f1f5f9;
                        vertical-align: middle;
                        text-align: center;
                    }
                    .day-column {
                        background: #fff;
                        color: #1e293b;
                        font-weight: 800;
                        font-size: 0.95rem;
                        width: 120px;
                        border-right: 1px solid #f1f5f9;
                    }
                    .subject-box {
                        height: 95px;
                        border-radius: 14px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 0.5rem;
                        transition: all 0.2s;
                        background: #fff;
                    }
                    .box-regular {
                        color: #4338ca;
                        font-weight: 800;
                        font-size: 1.3rem;
                    }
                    .box-lab {
                        background: #f0fdf4;
                        border: 2px solid #bbf7d0;
                        color: #15803d;
                        font-weight: 800;
                        font-size: 1.3rem;
                    }
                    .box-elective {
                        background: #fffbeb;
                        border: 2px solid #fde68a;
                        color: #b45309;
                        font-weight: 800;
                        font-size: 1.1rem;
                    }
                    .strip-cell {
                        width: 32px;
                        background: #f8fafc;
                        font-size: 0.65rem;
                        font-weight: 800;
                        color: #94a3b8;
                        writing-mode: vertical-rl;
                        transform: rotate(180deg);
                        text-align: center;
                        border-left: 1px solid #f1f5f9;
                        border-right: 1px solid #f1f5f9;
                    }
                    .empty-state {
                        padding: 4rem 2rem;
                        text-align: center;
                        color: #64748b;
                        font-size: 1.1rem;
                        font-weight: 500;
                    }
                    .print-only { display: none; }
                }
                @media print {
                    .screen-only { display: none !important; }
                    .print-only { display: block !important; padding: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    @page { size: landscape; margin: 3mm; }
                    .official-table { width: 100%; border-collapse: collapse; border: 1.2px solid black; }
                    .official-table th, .official-table td { border: 1px solid black; text-align: center; height: 26px; font-size: 9px; font-family: "Times New Roman", serif; padding: 1px; }
                    .official-table th { background: #f0f0f0 !important; font-weight: bold; }
                }
            `}</style>

            <div className="screen-only">
                <header className="dashboard-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#3b82f6', padding: '10px', borderRadius: '12px' }}>
                            <UserCircle color="white" size={24} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Staff Timetable</h1>
                            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>Select a staff member to view their schedule</p>
                        </div>
                    </div>
                    <div className="control-group">
                        <div className="faculty-select-wrapper">
                            <Users size={18} />
                            <select 
                                className="faculty-select" 
                                value={selectedFaculty} 
                                onChange={(e) => setSelectedFaculty(e.target.value)}
                            >
                                <option value="">Select a Faculty Member...</option>
                                {allFaculty.map((faculty, idx) => (
                                    <option key={idx} value={faculty}>{faculty}</option>
                                ))}
                            </select>
                            <ChevronDown size={18} className="select-arrow" />
                        </div>
                        <button className="btn-premium btn-print" onClick={() => {
                            if (!selectedFaculty) return alert("Please select a faculty member first.");
                            window.print();
                        }}>
                            <Printer size={18} /> Print
                        </button>
                        <button className="btn-premium btn-print-all" onClick={handlePrintAll} disabled={isPreparingPrint} style={{ marginLeft: '10px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Printer size={18} /> {isPreparingPrint ? 'Preparing...' : 'Print All'}
                        </button>
                    </div>
                </header>

                <div className="timetable-glass-card">
                    {!selectedFaculty ? (
                        <div className="empty-state">
                            Please select a faculty member from the dropdown above to view their timetable.
                        </div>
                    ) : (
                        <table className="main-grid">
                            <thead>
                                <tr>
                                    <th style={{ width: '120px' }}>Day</th>
                                    <th>P1<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>08:45-09:40</span></th>
                                    <th>P2<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>09:40-10:35</span></th>
                                    <th className="strip-cell"></th>
                                    <th>P3<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>10:55-11:45</span></th>
                                    <th>P4<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>11:45-12:35</span></th>
                                    <th className="strip-cell"></th>
                                    <th>P5<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>01:45-02:35</span></th>
                                    <th>P6<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>02:35-03:25</span></th>
                                    <th>P7<br /><span style={{ opacity: 0.6, fontSize: '0.6rem' }}>03:25-04:15</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map((day, dIdx) => (
                                    <tr key={day}>
                                        <td className="day-column">{day}</td>
                                        {mySchedule[dIdx].map((cell, sIdx) => {
                                            const items = [];
                                            items.push(
                                                <td key={`${dIdx}-${sIdx}`}>
                                                    {cell ? (
                                                        <div className={`subject-box ${cell.type === 'LAB' ? 'box-lab' : (cell.type === 'ELECTIVE_GROUP' ? 'box-elective' : 'box-regular')}`}>
                                                            <div style={{ fontSize: '1.1rem' }}>
                                                                {cell.displayCode}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>
                                                                Sem {cell.semester} - {cell.section}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="subject-box" style={{ opacity: 0.2 }}>-</div>
                                                    )}
                                                </td>
                                            );
                                            if (sIdx === 1) items.push(<td key={`break-${dIdx}`} className="strip-cell">BREAK</td>);
                                            if (sIdx === 3) items.push(<td key={`lunch-${dIdx}`} className="strip-cell">LUNCH</td>);
                                            return <React.Fragment key={`wrapper-${dIdx}-${sIdx}`}>{items}</React.Fragment>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isPrintingAll && allFacultyData ? (
                <div className="print-only">
                    {allFaculty.map((faculty, idx) => {
                        const schedule = allFacultyData[faculty] || Array(6).fill(null).map(() => Array(7).fill(null));
                        const hasClasses = schedule.some(dayRow => dayRow.some(cell => cell !== null));
                        if (!hasClasses) return null;
                        return (
                            <div key={idx} style={{ pageBreakAfter: 'always', padding: '20px' }}>
                                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                    <h1 style={{ fontSize: '20px', margin: 0 }}>PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY</h1>
                                    <h2 style={{ fontSize: '16px', margin: '5px 0' }}>INDIVIDUAL FACULTY TIME TABLE</h2>
                                    <p style={{ fontSize: '14px' }}>Faculty: {faculty.toUpperCase()}</p>
                                </div>
                                <table className="official-table">
                                    <thead>
                                        <tr>
                                            <th>Day</th>
                                            <th>P1</th>
                                            <th>P2</th>
                                            <th style={{ width: '20px' }}>B</th>
                                            <th>P3</th>
                                            <th>P4</th>
                                            <th style={{ width: '20px' }}>L</th>
                                            <th>P5</th>
                                            <th>P6</th>
                                            <th>P7</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DAYS.map((day, dIdx) => (
                                            <tr key={day}>
                                                <td style={{ fontWeight: 'bold' }}>{day.substring(0, 3)}</td>
                                                {[0, 1].map(s => <td key={s}>{schedule[dIdx][s] ? schedule[dIdx][s].displayCode : ''}</td>)}
                                                <td style={{ background: '#eee' }}></td>
                                                {[2, 3].map(s => <td key={s}>{schedule[dIdx][s] ? schedule[dIdx][s].displayCode : ''}</td>)}
                                                <td style={{ background: '#eee' }}></td>
                                                {[4, 5, 6].map(s => <td key={s}>{schedule[dIdx][s] ? schedule[dIdx][s].displayCode : ''}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            ) : selectedFaculty && (
                <div className="print-only">
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '20px', margin: 0 }}>PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY</h1>
                        <h2 style={{ fontSize: '16px', margin: '5px 0' }}>INDIVIDUAL FACULTY TIME TABLE</h2>
                        <p style={{ fontSize: '14px' }}>Faculty: {selectedFaculty.toUpperCase()}</p>
                    </div>

                    <table className="official-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>P1</th>
                                <th>P2</th>
                                <th style={{ width: '20px' }}>B</th>
                                <th>P3</th>
                                <th>P4</th>
                                <th style={{ width: '20px' }}>L</th>
                                <th>P5</th>
                                <th>P6</th>
                                <th>P7</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DAYS.map((day, dIdx) => (
                                <tr key={day}>
                                    <td style={{ fontWeight: 'bold' }}>{day.substring(0, 3)}</td>
                                    {[0, 1].map(s => <td key={s}>{mySchedule[dIdx][s] ? mySchedule[dIdx][s].displayCode : ''}</td>)}
                                    <td style={{ background: '#eee' }}></td>
                                    {[2, 3].map(s => <td key={s}>{mySchedule[dIdx][s] ? mySchedule[dIdx][s].displayCode : ''}</td>)}
                                    <td style={{ background: '#eee' }}></td>
                                    {[4, 5, 6].map(s => <td key={s}>{mySchedule[dIdx][s] ? mySchedule[dIdx][s].displayCode : ''}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StaffTimetable;
