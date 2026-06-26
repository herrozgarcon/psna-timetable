import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx';
import { Upload, Save, FileSpreadsheet, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ExcelPreview.css';
import { v4 as uuidv4 } from 'uuid';

const ExcelPreview = () => {
    const { setSubjects, setTeachers, updateSchedule, facultyAccounts, addFacultyAccounts } = useData();
    const navigate = useNavigate();
    const [grid, setGrid] = useState(() => {
        const saved = sessionStorage.getItem('excel_preview_grid');
        return saved ? JSON.parse(saved) : [];
    });
    const [fileName, setFileName] = useState(() => {
        return sessionStorage.getItem('excel_preview_filename') || '';
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            const rows = [];
            for (let R = 0; R <= range.e.r; ++R) {
                const row = [];
                for (let C = 0; C <= range.e.c; ++C) {
                    const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
                    row.push(cell ? cell.v : '');
                }
                rows.push(row);
            }
            setGrid(rows);
            sessionStorage.setItem('excel_preview_grid', JSON.stringify(rows));
            sessionStorage.setItem('excel_preview_filename', file.name);
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    const handleCellChange = (rowIndex, colIndex, value) => {
        const newGrid = [...grid];
        newGrid[rowIndex] = [...newGrid[rowIndex]];
        newGrid[rowIndex][colIndex] = value;
        setGrid(newGrid);
        sessionStorage.setItem('excel_preview_grid', JSON.stringify(newGrid));
    };

    const processAndSave = async () => {
        if (grid.length === 0) return;
        setLoading(true);
        try {
            const rows = grid;
            let currentSem = 'General';
            let currentType = 'Lecture';
            const newSubjects = [];
            const newTeachers = [];
            const allAffectedSemesters = new Set();

            const safeInt = (val) => {
                if (val === undefined || val === null || val === '') return 0;
                let s = String(val).trim();
                const match = s.match(/(\d+)/);
                return match ? parseInt(match[0]) : 0;
            };

            const parseHeaders = (row, prevIndices) => {
                const h = row.map(cell => String(cell || '').trim().toUpperCase());
                let sections = [];
                for (let idx = 0; idx < h.length; idx++) {
                    const val = h[idx];
                    if (/^[A-Z]$/.test(val)) {
                        sections.push({ idx, name: val });
                    }
                    if (val.includes('SECTION') || val.includes('DEPT') || val.includes('TUTOR') || val.includes('SUB HAND')) {
                        break;
                    }
                }
                if (sections.length === 0 && prevIndices && prevIndices.sections && prevIndices.sections.length > 0) {
                    sections = prevIndices.sections;
                }

                const weekdayIdx = h.findIndex(x => x.includes('HOURS') || x.includes('ALLOTTED') || x.includes('WEEKDAY'));
                const satIdx = h.findIndex(x => x.includes('SAT') || x.includes('SATURDAY'));

                return {
                    codeIdx: h.findIndex(x => x === 'SUB.CODE' || x === 'SUB.COD'),
                    nameIdx: h.findIndex(x => x === 'SUBJECT NAME'),
                    weekdayIdx: weekdayIdx > -1 ? weekdayIdx : 12,
                    satIdx: satIdx > -1 ? satIdx : (weekdayIdx > -1 ? weekdayIdx + 1 : 13),
                    noOfSecIdx: h.findIndex(x => x.includes('NO OF SEC') || x.includes('NO. OF SEC') || x === 'NO OF SECTION'),
                    sections: sections
                };
            };

            let currentIndices = null;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                const rowUpper = row.map(c => String(c || '').trim().toUpperCase());

                // ME Semester detection logic from Master 2
                const semCell = row.find(c =>
                    /^(?:(?:[IXV\d]+)\s*ME\s*[A-Z]+)|(?:SEM\s*[IXV\d]+)|(?:SEMESTER\s*[IXV\d]+)$/i.test(String(c).trim())
                );
                if (semCell) {
                    let semText = String(semCell).trim().toUpperCase();
                    // Normalize SEM II formats
                    if (semText.includes('SEM')) {
                        const match = semText.match(/SEM\s+([IXV\d]+)/i);
                        if (match) semText = `SEM ${match[1]}`;
                    }
                    currentSem = semText;
                    allAffectedSemesters.add(currentSem);
                }

                const rowStr = rowUpper.join(' ');
                if (rowStr.includes('PRACTICAL')) currentType = 'Lab';
                else if (rowStr.includes('THEORY')) currentType = 'Lecture';

                if (rowUpper.some(c => c === 'SUB.CODE' || c === 'SUB.COD' || c === 'SUBJECT NAME')) {
                    currentIndices = parseHeaders(row, currentIndices);
                    continue;
                }

                if (!currentIndices) continue;

                const colB = String(row[1] || '').trim();
                const colC = String(row[2] || '').trim();
                let code = '';
                let name = '';

                if (/^[A-Z]+\d+/.test(colB)) { code = colB; name = String(row[2] || '').trim(); }
                else if (/^[A-Z]+\d+/.test(colC)) { code = colC; name = String(row[3] || '').trim(); }

                if (!code || !name || name.toUpperCase().includes('TOTAL')) continue;

                let weekday = safeInt(row[currentIndices.weekdayIdx]);
                const sat = safeInt(row[currentIndices.satIdx]);

                // Fallback for missing credits
                if (weekday === 0 && sat === 0) {
                    const fallbackHours = safeInt(row[7]); // Column H usually
                    if (fallbackHours > 0) {
                        weekday = Math.max(0, fallbackHours - sat);
                    } else {
                        weekday = 0; // Allow 0 hours if not specified
                    }
                }

                let finalType = (name.toUpperCase().includes('LAB') || name.toUpperCase().includes('PRACTICAL') || currentType === 'Lab') ? 'Lab' : 'Lecture';

                newSubjects.push({
                    id: uuidv4(),
                    code, name,
                    semester: currentSem,
                    credit: weekday,
                    satCount: sat,
                    type: finalType
                });

                let sectionCount = currentIndices.sections.length > 0 ? currentIndices.sections.length : 5;
                if (currentIndices.noOfSecIdx > -1) {
                    const secCount = safeInt(row[currentIndices.noOfSecIdx]);
                    if (secCount > 0) sectionCount = secCount;
                }
                const expectedSections = Array.from({ length: sectionCount }, (_, i) => String.fromCharCode(65 + i));

                currentIndices.sections.forEach(secObj => {
                    if (!expectedSections.includes(secObj.name)) return;
                    const tName = String(row[secObj.idx] || '').trim();
                    if (tName && isNaN(tName) && tName.length >= 2) {
                        const up = tName.toUpperCase();
                        if (!['YES', 'NO', 'STAFF', 'TUTOR', 'SUB', 'NIL', '-', '.'].some(k => up.includes(k))) {
                            newTeachers.push({
                                id: uuidv4(),
                                name: tName,
                                subjectCode: code,
                                section: secObj.name,
                                semester: currentSem
                            });
                        }
                    }
                });
            }

            // OVERWRITE existing data to prevent duplicates (The Proper Way)
            await setSubjects(newSubjects);
            await setTeachers(newTeachers);

            // Auto-create faculty accounts
            const uniqueTeacherNames = [...new Set(newTeachers.map(t => t.name))];
            const accArray = Array.isArray(facultyAccounts) ? facultyAccounts : [];
            const missingAccounts = uniqueTeacherNames.filter(name => {
                const normName = name.toLowerCase().trim();
                return !accArray.some(acc => acc.name.toLowerCase().trim() === normName);
            });

            if (missingAccounts.length > 0) {
                const newAccounts = missingAccounts.map(name => {
                    const nameParts = name.split(/\s+/);
                    const lastNameRaw = nameParts[nameParts.length - 1];
                    let handle = lastNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (handle.length < 3) handle = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
                    return {
                        id: uuidv4(),
                        name: name,
                        email: `${handle}@psnacet.edu.in`,
                        password: handle,
                        dept: 'General',
                        can_generate: false
                    };
                });
                await addFacultyAccounts(newAccounts);
            }

            for (const sem of allAffectedSemesters) {
                await updateSchedule(sem, {});
            }

            setMessage({ type: 'success', text: `Sync Complete: ${newSubjects.length} subjects imported properly.` });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: `Import failed: ${error.message || 'Check Excel format.'}` });
        } finally {
            setLoading(false);
        }
    };

    const getColumnLetter = (index) => {
        let letter = '';
        while (index >= 0) {
            letter = String.fromCharCode((index % 26) + 65) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    };

    return (
        <div className="excel-preview-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Excel Data Preview</h1>
                    <p>M=Weekday, N=Sat | Sections A-E | Overwrites Previous Data</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline btn-rotate-icon" onClick={() => { setGrid([]); setFileName(''); sessionStorage.removeItem('excel_preview_grid'); }}>
                        <RefreshCw size={18} /> Reset
                    </button>
                    <button className="btn btn-primary" onClick={processAndSave} disabled={loading || grid.length === 0}>
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        {loading ? 'Processing...' : 'Import Excel Data'}
                    </button>
                </div>
            </div>
            {message && (
                <div className={`alert-banner ${message.type}`} style={{
                    padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem',
                    backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    border: `2px solid ${message.type === 'success' ? '#16a34a' : '#ef4444'}`,
                    fontWeight: 800
                }}>{message.text}</div>
            )}
            <div className="card excel-card">
                {!grid.length ? (
                    <div className="empty-state">
                        <FileSpreadsheet size={64} />
                        <label className="btn btn-primary mt-2" style={{ cursor: 'pointer' }}>
                            <Upload size={18} /> Select Excel File
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                    </div>
                ) : (
                    <div className="excel-table-container">
                        <table className="excel-table">
                            <thead>
                                <tr>
                                    <th className="excel-row-header"></th>
                                    {grid[0]?.map((_, i) => <th key={i}>{getColumnLetter(i)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {grid.slice(0, 300).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <td className="excel-row-header">{rIdx + 1}</td>
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} style={{ padding: 0 }}>
                                                <input
                                                    type="text"
                                                    className="excel-input"
                                                    value={cell || ''}
                                                    onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExcelPreview;