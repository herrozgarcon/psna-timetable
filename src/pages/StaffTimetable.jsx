import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { loadFacultyTimetable, loadAllFacultyTimetables } from '../services/timetablePersistence';
import { Calendar, Layers, Printer, UserCircle, Users, ChevronDown } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const StaffTimetable = () => {
    const { teachers, subjects, timeSlots, preemptiveConstraints, department, schedule } = useData();
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
            
            const facultyId = selectedFaculty;
            
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
                        section: row.section,
                        facultyName: row.faculty_name,
                        teacherInitials: schedule?.[row.semester]?.[row.section]?.[row.day]?.[row.period]?.teacherName || row.faculty_name
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
                    section: row.section,
                    facultyName: row.faculty_name,
                    teacherInitials: schedule?.[row.semester]?.[row.section]?.[row.day]?.[row.period]?.teacherName || row.faculty_name
                };
            }
        });
        
        return grid;
    }, [dbSchedule, schedule]);

    // --- Helper Functions for Printed Timetable ---

    const to24h = (timeStr) => {
        if (!timeStr) return '';
        const clean = timeStr.trim();
        const parts = clean.split(':');
        if (parts.length >= 2) {
            let hour = parseInt(parts[0], 10);
            const min = parts[1].substring(0, 2);
            if (hour >= 1 && hour < 8) {
                hour += 12;
            }
            return `${hour}:${min}`;
        }
        return timeStr;
    };

    const getCleanSemester = (semStr) => {
        if (!semStr) return '';
        const s = String(semStr).toUpperCase().trim();
        if (s.includes('VIII') || s.endsWith('8')) return 'VIII';
        if (s.includes('VII') || s.endsWith('7')) return 'VII';
        if (s.includes('VI') || s.endsWith('6')) return 'VI';
        if (s.includes('V') || s.endsWith('5')) return 'V';
        if (s.includes('IV') || s.endsWith('4')) return 'IV';
        if (s.includes('III') || s.endsWith('3')) return 'III';
        if (s.includes('II') || s.endsWith('2')) return 'II';
        if (s.includes('I') || s.endsWith('1')) return 'I';
        return semStr;
    };

    const getFacultyFullName = (initials) => {
        if (!initials) return '';
        const upper = initials.toUpperCase().trim();
        const map = {
            'ND': 'Dr.N.Dhanalakshmi',
            'SSB': 'Dr.S.Satheesbabu',
            // Additional mappings if needed
        };
        return map[upper] || initials;
    };

    const getPeriodTimes = (sIdx) => {
        if (!timeSlots) return { start: '', end: '' };
        const teachingSlots = timeSlots.filter(s => s.type === 'teaching');
        const slot = teachingSlots[sIdx];
        if (slot) {
            return {
                start: to24h(slot.startTime),
                end: to24h(slot.endTime)
            };
        }
        const fallbacks = [
            { start: '8:45', end: '9:40' },
            { start: '9:40', end: '10:35' },
            { start: '10:55', end: '11:45' },
            { start: '11:45', end: '12:35' },
            { start: '13:45', end: '14:35' },
            { start: '14:35', end: '15:25' },
            { start: '15:25', end: '16:15' }
        ];
        return fallbacks[sIdx] || { start: '', end: '' };
    };

    const isFixed = (courseCode, section, day, period) => {
        if (!preemptiveConstraints || !preemptiveConstraints.slots) return false;
        const cleanCode = String(courseCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        for (const key of Object.keys(preemptiveConstraints.slots)) {
            if (cleanCode.includes(key.toUpperCase())) {
                const slots = preemptiveConstraints.slots[key]?.[section];
                if (slots && slots.some(s => s.d === day && period >= s.s && period < s.s + (s.duration || 1))) {
                    return true;
                }
            }
        }
        return false;
    };

    const getFacultySubjects = (grid) => {
        const list = [];
        const keys = new Set();
        grid.forEach(dayRow => {
            dayRow.forEach(cell => {
                if (cell && cell.displayCode) {
                    const key = `${cell.displayCode}-${cell.section}`;
                    if (!keys.has(key)) {
                        keys.add(key);
                        list.push({
                            code: cell.displayCode,
                            section: cell.section,
                            semester: cell.semester,
                            total: 0
                        });
                    }
                }
            });
        });
        
        list.forEach(item => {
            let count = 0;
            grid.forEach(dayRow => {
                dayRow.forEach(cell => {
                    if (cell && cell.displayCode === item.code && cell.section === item.section) {
                        count++;
                    }
                });
            });
            item.total = count;
        });

        if (subjects) {
            list.forEach(item => {
                const subObj = subjects.find(s => {
                    const codeClean = s.code.toUpperCase().trim();
                    return item.code.toUpperCase().includes(codeClean);
                });
                item.name = subObj ? subObj.name : '';
            });
        }
        return list.sort((a, b) => a.code.localeCompare(b.code));
    };

    const renderPrintedCell = (dIdx, s, grid, faculty) => {
        const cell = grid[dIdx][s];
        if (!cell) return '';

        // Block detection
        let start = s;
        while (start > 0 && grid[dIdx][start - 1] && grid[dIdx][start - 1].displayCode === cell.displayCode && grid[dIdx][start - 1].section === cell.section) {
            start--;
        }
        
        let end = s;
        while (end < 6 && grid[dIdx][end + 1] && grid[dIdx][end + 1].displayCode === cell.displayCode && grid[dIdx][end + 1].section === cell.section) {
            end++;
        }
        
        const len = end - start + 1;
        const pos = s - start;

        // Clean teacher initials to exclude the currently selected faculty member
        const upperFaculty = String(faculty || '').toUpperCase().trim();
        const coFaculty = (cell.teacherInitials || cell.facultyName || '')
            .split('/')
            .map(t => t.trim())
            .filter(t => t.toUpperCase() !== upperFaculty)
            .join('/');

        if (len === 1) {
            const isRed = isFixed(cell.displayCode, cell.section, dIdx, s);
            return (
                <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>
                    {cell.displayCode}
                </div>
            );
        }

        if (len === 2) {
            const isRed = isFixed(cell.displayCode, cell.section, dIdx, s);
            if (start < 4) { // Morning P1-P4
                if (pos === 0) {
                    if (coFaculty) {
                        return (
                            <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>
                                {coFaculty}
                            </div>
                        );
                    } else {
                        return (
                            <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>
                                {cell.displayCode}
                            </div>
                        );
                    }
                } else {
                    return (
                        <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>
                            {cell.displayCode}
                        </div>
                    );
                }
            } else { // Afternoon P5-P7
                if (pos === 0) {
                    return (
                        <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>
                            {cell.displayCode}
                        </div>
                    );
                } else {
                    return (
                        <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>
                            {cell.displayCode}
                        </div>
                    );
                }
            }
        }

        if (len >= 3) {
            const isRed = isFixed(cell.displayCode, cell.section, dIdx, s);
            
            if (coFaculty) {
                const parts = coFaculty.split('/').map(t => t.trim());
                let firstPart = '';
                let secondPart = '';
                if (parts.length > 2) {
                    firstPart = parts.slice(0, 2).join('/');
                    secondPart = '/' + parts.slice(2).join('/');
                } else {
                    firstPart = parts.join('/');
                }

                if (pos === 0) {
                    return (
                        <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>
                            {firstPart}
                        </div>
                    );
                } else if (pos === 1) {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-around' }}>
                            <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>{cell.displayCode}</div>
                            {secondPart && <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>{secondPart}</div>}
                        </div>
                    );
                } else if (pos === 2) {
                    return '';
                }
            } else {
                // If teaching alone, show course code in all periods of the block
                return (
                    <div style={{ color: isRed ? 'red' : 'black', fontWeight: 'bold', fontSize: '10pt' }}>
                        {cell.displayCode}
                    </div>
                );
            }
            return '';
        }

        return '';
    };

    const renderPrintPage = (faculty, grid) => {
        const subjectsList = getFacultySubjects(grid);
        return (
            <div className="print-page" style={{ fontFamily: '"Times New Roman", Times, serif', color: 'black', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: 0, color: '#1e3a8a' }}>PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY</h1>
                    <h2 style={{ fontSize: '12pt', fontWeight: 'normal', margin: '2px 0 5px 0', fontStyle: 'italic', color: '#1e3a8a' }}>(An Autonomous Institution Affiliated with Anna University)</h2>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', fontWeight: 'bold', fontSize: '11pt', margin: '5px 0' }}>
                        <span>DEPARTMENT OF {String(department || 'Computer Science and Engineering').toUpperCase()}</span>
                        <span style={{ position: 'absolute', right: 0 }}>w.e.f 02.02.2026</span>
                    </div>
                    
                    <div style={{ fontWeight: 'bold', fontSize: '11pt', margin: '2px 0' }}>2025-2026 EVEN SEMESTER</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginTop: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13pt', fontWeight: 'bold', textDecoration: 'underline', color: '#1e3a8a' }}>Individual Faculty Timetable</span>
                        <span style={{ position: 'absolute', right: 0, bottom: 0, fontWeight: 'bold', fontSize: '11pt' }}>{getFacultyFullName(faculty)}</span>
                    </div>
                </div>

                <table className="official-table">
                    <thead>
                        <tr>
                            <th style={{ width: '50px' }}></th>
                            {[0, 1, 2, 3].map(s => {
                                const times = getPeriodTimes(s);
                                return (
                                    <th key={s} style={{ width: '100px' }}>
                                        {times.start}<br />{times.end}
                                    </th>
                                );
                            })}
                            <th style={{ width: '35px' }}></th>
                            {[4, 5, 6].map(s => {
                                const times = getPeriodTimes(s);
                                return (
                                    <th key={s} style={{ width: '100px' }}>
                                        {times.start}<br />{times.end}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {DAYS.map((day, dIdx) => (
                            <tr key={day}>
                                <td style={{ fontWeight: 'bold', fontSize: '10pt', width: '50px' }}>{day.charAt(0) + day.slice(1, 2).toLowerCase()}</td>
                                {[0, 1, 2, 3].map(s => (
                                    <td key={s} style={{ width: '100px', height: '48px', padding: '2px' }}>
                                        {renderPrintedCell(dIdx, s, grid, faculty)}
                                    </td>
                                ))}
                                
                                {dIdx === 0 && (
                                    <td rowSpan={6} style={{ width: '35px', padding: 0, verticalAlign: 'middle', textAlign: 'center', background: 'white' }}>
                                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '4px', fontWeight: 'bold', fontSize: '9pt' }}>
                                            LUNCHBREAK
                                        </div>
                                    </td>
                                )}
                                
                                {[4, 5, 6].map(s => (
                                    <td key={s} style={{ width: '100px', height: '48px', padding: '2px' }}>
                                        {renderPrintedCell(dIdx, s, grid, faculty)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <table className="subjects-table">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', width: '60%' }}>Subjects</th>
                            <th style={{ textAlign: 'center', width: '25%' }}>Class</th>
                            <th style={{ textAlign: 'center', width: '15%' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjectsList.map((item, idx) => {
                            const classDept = (!department || department.toUpperCase() === 'GENERAL') ? '' : department;
                            const classString = `${getCleanSemester(item.semester)} ${classDept ? classDept + ' ' : ''}${item.section}`;
                            return (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 'bold' }}>{item.code} – {item.name || 'Theory / Lab'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{classString}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.total}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="sig-section">
                    <div className="sig-line">Dept TTI/C</div>
                    <div className="sig-line">HOD-{department || 'CSE'}</div>
                    <div className="sig-line">Prof TTI/C</div>
                    <div className="sig-line">Principal</div>
                </div>
            </div>
        );
    };

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
                    .print-only { display: block !important; padding: 0; margin: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    @page { size: landscape; margin: 10mm; }
                    .official-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        border: 1px solid black; 
                        font-family: "Times New Roman", Times, serif;
                        margin-bottom: 12px;
                    }
                    .official-table th, .official-table td { 
                        border: 1px solid black; 
                        text-align: center; 
                        vertical-align: middle; 
                        font-family: "Times New Roman", Times, serif;
                        font-size: 10pt;
                        padding: 4px;
                    }
                    .official-table th { 
                        font-weight: bold; 
                        background: white !important; 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                    }
                    .official-table td { 
                        height: 40px; 
                    }
                    .subjects-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        border: 1px solid black; 
                        font-family: "Times New Roman", Times, serif;
                        margin-top: 8px;
                        margin-bottom: 15px;
                    }
                    .subjects-table th, .subjects-table td { 
                        border: 1px solid black; 
                        padding: 5px 8px; 
                        font-family: "Times New Roman", Times, serif;
                        font-size: 10pt;
                    }
                    .subjects-table th { 
                        font-weight: bold; 
                        background: white !important;
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                    }
                    .sig-section { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-top: 25px; 
                        padding: 0 10px; 
                        font-family: "Times New Roman", Times, serif;
                    }
                    .sig-line { 
                        text-align: center; 
                        font-weight: bold; 
                        font-size: 10pt; 
                        border-top: 1px solid black;
                        width: 130px;
                        padding-top: 5px;
                    }
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
                        const scheduleGrid = allFacultyData[faculty] || Array(6).fill(null).map(() => Array(7).fill(null));
                        const hasClasses = scheduleGrid.some(dayRow => dayRow.some(cell => cell !== null));
                        if (!hasClasses) return null;
                        return (
                            <div key={idx} style={{ pageBreakAfter: idx < allFaculty.length - 1 ? 'always' : 'auto', padding: '10px 20px' }}>
                                {renderPrintPage(faculty, scheduleGrid)}
                            </div>
                        );
                    })}
                </div>
            ) : selectedFaculty && (
                <div className="print-only">
                    {renderPrintPage(selectedFaculty, mySchedule)}
                </div>
            )}
        </div>
    );
};

export default StaffTimetable;
