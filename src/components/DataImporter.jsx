import React, { useRef, useState } from 'react';
import { Upload, X, Check, AlertCircle, FileText, Download, Briefcase, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { useData } from '../context/DataContext';

const DataImporter = () => {
    const { subjects, addTeachers, addSubjects, clearTeachers, clearSubjects } = useData();

    // State
    const fileInputRef = useRef(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [fileName, setFileName] = useState('');
    const [importMode, setImportMode] = useState('strict'); // 'strict' | 'master'
    const [clearBeforeImport, setClearBeforeImport] = useState(false);

    // Status
    const [validationStatus, setValidationStatus] = useState('idle'); // idle, validating, success, error
    const [validationReport, setValidationReport] = useState(null);

    // Staging Data
    const [pendingTeachers, setPendingTeachers] = useState([]);
    const [pendingSubjects, setPendingSubjects] = useState([]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            setValidationStatus('validating');
            parseExcel(file);
        }
    };

    const resetImporter = () => {
        setFileName('');
        setValidationStatus('idle');
        setValidationReport(null);
        setPendingTeachers([]);
        setPendingSubjects([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const parseExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheets = {};
                workbook.SheetNames.forEach(sheetName => {
                    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 'A', defval: "" });
                });

                // Detect Allocation Format (PSNA Style)
                const isAllocationFormat = workbook.SheetNames.some(name => {
                    const rows = sheets[name];
                    if (!rows || rows.length < 5) return false;
                    const headerRow = rows.find(r => Object.values(r).some(v => /subj code & name/i.test(String(v))));
                    return !!headerRow;
                });

                if (isAllocationFormat) {
                    processAllocationFormat(sheets, workbook.SheetNames);
                } else if (importMode === 'strict') {
                    // Convert back to keyed objects for existing logic
                    const keyedSheets = {};
                    workbook.SheetNames.forEach(name => {
                        keyedSheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
                    });
                    validateStrict(keyedSheets, workbook.SheetNames);
                } else {
                    const keyedSheets = {};
                    workbook.SheetNames.forEach(name => {
                        keyedSheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
                    });
                    validateMaster(keyedSheets);
                }

            } catch (err) {
                console.error("Excel Parse Error:", err);
                setValidationStatus('error');
                setValidationReport({ headerErrors: ['Failed to parse Excel file. Ensure it is a valid .xlsx file.'] });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const processAllocationFormat = (sheets) => {
        const facultyMap = new Map();
        const globalSubjectMap = new Map();
        const assignments = [];
        const headerErrors = [];

        const sheetKeys = Object.keys(sheets);

        // 1. Scan ALL sheets for Faculty Map (Initials -> Full Name)
        sheetKeys.forEach(name => {
            const rows = sheets[name];
            if (!rows || rows.length === 0) return;

            let initCol = null;
            let nameCol = null;

            for (let i = 0; i < Math.min(rows.length, 50); i++) {
                const row = rows[i];
                Object.entries(row).forEach(([key, val]) => {
                    const v = String(val).toLowerCase();
                    if (v.includes('name') && v.includes('faculty')) nameCol = key;
                    if (v.includes('initial')) initCol = key;
                });

                if (initCol && nameCol) {
                    for (let j = i + 1; j < rows.length; j++) {
                        const r = rows[j];
                        const ini = String(r[initCol] || '').trim().toUpperCase();
                        const full = String(r[nameCol] || '').trim();
                        const isSubjectLike = /^[I|V|X]+ /i.test(full) || /[A-Z]{2,4}[0-9]{4}/.test(full);

                        if (ini && full && ini.length <= 5 && full.length > 5 && !isSubjectLike) {
                            facultyMap.set(ini, { name: full, department: 'CSE' });
                        } else if (j > i + 5 && (!ini || !full)) {
                            break;
                        }
                    }
                    break;
                }
            }
        });

        // 2. Identify and Parse Subjects/Assignments from all sheets
        sheetKeys.forEach(sheetName => {
            const rows = sheets[sheetName];
            if (!rows) return;

            let headerRows = [];
            for (let i = 0; i < Math.min(rows.length, 500); i++) {
                if (Object.values(rows[i]).some(v => /subj code & name/i.test(String(v)))) {
                    headerRows.push(i);
                }
            }

            headerRows.forEach(headerRowIdx => {
                const headerRow = rows[headerRowIdx];
                const colMap = {};
                Object.entries(headerRow).forEach(([key, val]) => {
                    const v = String(val).toLowerCase().trim();
                    if (v.includes('sem. no') || v === 'sem' || v === 'semester') colMap.semester = key;
                    if (v.includes('code') && !v.includes('name')) colMap.code = key;
                    if (v.includes('subj code & name')) colMap.fullName = key;
                    if (v.includes('credit')) colMap.credit = key;
                    if (v.includes('no of sec') || v.includes('no. of sec') || v.includes('no of section')) colMap.noOfSec = key;
                    if (/^[a-z]$/.test(v)) {
                        if (!colMap.secCols) colMap.secCols = [];
                        colMap.secCols.push({ id: v.toUpperCase(), col: key });
                    }
                });

                if (colMap.fullName) {
                    for (let i = headerRowIdx + 1; i < rows.length; i++) {
                        const row = rows[i];
                        const fullNameRaw = String(row[colMap.fullName] || '').trim();
                        if (!fullNameRaw || /total/i.test(fullNameRaw)) {
                            if (i > headerRowIdx + 5) break;
                            continue;
                        }

                        const codeMatch = fullNameRaw.match(/^([A-Z]{2,4}[0-9]{3,4})/i);
                        const code = (row[colMap.code] ? String(row[colMap.code]).trim() : (codeMatch ? codeMatch[1] : '')).toUpperCase();
                        let name = fullNameRaw;
                        if (code && name.toUpperCase().startsWith(code)) {
                            name = name.substring(code.length).replace(/^[\s\-\.]+/, '').trim();
                        }
                        const subKey = code || name.toUpperCase();
                        const semRaw = String(row[colMap.semester] || '').trim();
                        const semester = semRaw.match(/^(I|II|III|IV|V|VI|VII|VIII|1|2|3|4|5|6|7|8)/i)?.[0].toUpperCase() || semRaw;
                        const credits = String(row[colMap.credit] || '3').trim();

                        if (!globalSubjectMap.has(subKey)) {
                            globalSubjectMap.set(subKey, {
                                code: code || 'TBD',
                                name,
                                semester,
                                type: name.toLowerCase().includes('lab') ? 'Lab' : 'Lecture',
                                credits: (credits === '0' || !credits) ? '3' : credits
                            });
                        }

                        const noOfSecRaw = colMap.noOfSec ? String(row[colMap.noOfSec]).trim() : '';
                        const sectionCount = parseInt(noOfSecRaw) || (colMap.secCols ? colMap.secCols.length : 5);
                        const expectedSections = Array.from({ length: sectionCount }, (_, i) => String.fromCharCode(65 + i));

                        if (colMap.secCols) {
                            colMap.secCols.forEach(sec => {
                                if (!expectedSections.includes(sec.id)) return;
                                let teacherInitial = String(row[sec.col] || '').trim().toUpperCase();
                                if (!teacherInitial || teacherInitial === '0' || teacherInitial === '-' || teacherInitial === 'NIL') return;
                                if (teacherInitial.length > 10) return;

                                const faculty = facultyMap.get(teacherInitial) || { name: teacherInitial, department: 'CSE' };
                                if (/^[A-Z]{2,4}[0-9]{4}/.test(faculty.name) && faculty.name.length > 10) return;

                                assignments.push({
                                    name: faculty.name.trim(),
                                    department: faculty.department,
                                    subject: `${code || 'TBD'} - ${name}`,
                                    semester: semester,
                                    assignedClass: `Section ${sec.id}`,
                                    initial: teacherInitial
                                });
                            });
                        }
                    }
                }
            });
        });

        if (assignments.length === 0 && globalSubjectMap.size === 0) {
            headerErrors.push("Could not extract any data. Ensure the sheet follows the PSNA allocation format.");
        }

        const finalSubjects = Array.from(globalSubjectMap.values());
        setPendingTeachers(assignments);
        setPendingSubjects(finalSubjects);
        setValidationReport({
            validTeachers: assignments.length,
            validSubjects: finalSubjects.length,
            badRows: [],
            headerErrors: headerErrors,
            mode: 'PSNA Allocation Format (Enhanced)',
            preview: assignments.slice(0, 3)
        });
        setValidationStatus(headerErrors.length > 0 ? 'error' : 'success');
    };

    // --- STRICT MODE: Flat Assignment File + Catalog Support ---
    const validateStrict = (sheets, sheetNames) => {
        let validTeachers = [];
        let extractedSubjects = new Map();
        let headerErrors = [];
        let validSheetFound = false;

        const sheetKeys = Object.keys(sheets);

        for (const sheetName of sheetKeys) {
            const rows = sheets[sheetName];
            if (!rows || rows.length === 0) continue;

            const headers = Object.keys(rows[0]);
            const findCol = (candidates) => headers.find(h => candidates.some(c => h.toLowerCase().trim() === c.toLowerCase() || h.toLowerCase().trim().includes(c.toLowerCase())));

            const map = {
                name: findCol(['Teacher Name', 'Faculty Name', 'Name of the Teacher', 'Teacher', 'Staff Name']),
                dept: findCol(['Department', 'Dept', 'Branch', 'Dept Name']),
                subject: findCol(['Subject Code', 'Subject Name', 'Subject', 'Course', 'Paper', 'Course Name']),
                class: findCol(['Class', 'Assigned Class', 'Year/Sec', 'Section', 'Year', 'Sem']),
                credit: findCol(['Credit', 'Credits', 'Unit', 'Hrs', 'Session']),
                type: findCol(['Type', 'Category', 'Lab/Theory']),
                room: findCol(['Room', 'Lab', 'Venue', 'Location', 'Place']),
                alt1: findCol(['Alt Subject 1', 'Alternative 1']),
                alt2: findCol(['Alt Subject 2', 'Alternative 2']),
                alt3: findCol(['Alt Subject 3', 'Alternative 3'])
            };

            // Process if it looks like EITHER a Teacher Assignment sheet OR a Subject Catalog sheet
            if (map.name || map.subject) {
                validSheetFound = true;

                rows.forEach((row, idx) => {
                    // 1. Process Subject Data (Global across all sheets)
                    const subRaw = map.subject ? String(row[map.subject] || '').trim() : '';
                    if (subRaw && !subRaw.toLowerCase().includes('subject') && subRaw.length > 2) {
                        // Extract semester if it's at the start (e.g., "VI CS2611")
                        const semMatch = subRaw.match(/^(I|II|III|IV|V|VI|VII|VIII)\s+/i);
                        const cleanSem = semMatch ? semMatch[1].toUpperCase() : '';

                        let cleanSubRaw = subRaw.replace(/^(I|II|III|IV|V|VI|VII|VIII)\s+/i, '').trim();
                        const codeMatch = cleanSubRaw.match(/^([A-Z]{2,4}[0-9]{3,4})/i);
                        const code = codeMatch ? codeMatch[1].toUpperCase() : 'TBD';
                        let subName = cleanSubRaw.replace(code, '').replace(/^[\s\-\.]+/, '').replace(/\(IL\)$/i, '').trim();

                        const subId = code !== 'TBD' ? code : subName.toUpperCase();
                        const credRaw = map.credit ? String(row[map.credit] || '').trim() : '3';
                        const typeRaw = map.type ? String(row[map.type] || '').trim() : '';

                        if (!extractedSubjects.has(subId)) {
                            extractedSubjects.set(subId, {
                                id: subId,
                                code: code,
                                name: subName || cleanSubRaw,
                                semester: cleanSem,
                                type: (typeRaw.toLowerCase().includes('lab') || cleanSubRaw.toLowerCase().includes('lab')) ? 'Lab' : 'Lecture',
                                credits: isNaN(parseInt(credRaw)) ? '3' : credRaw
                            });
                        }

                        // 2. Process Teacher Assignment (If name column exists in this sheet)
                        const nameRaw = map.name ? String(row[map.name] || '').trim() : '';
                        if (nameRaw && nameRaw.length > 2 && !nameRaw.toLowerCase().includes('name')) {
                            const name = nameRaw.split(/(Assistant|Associate|Professor|AP|ASP|HOD)/i)[0].replace(/[,.]\s*$/, '').trim();
                            const dept = map.dept ? String(row[map.dept] || '').trim() : 'General';
                            const classRaw = map.class ? String(row[map.class] || '').trim() : '';

                            let finalClass = classRaw || 'Unassigned';
                            if (classRaw) {
                                const strClass = classRaw.toUpperCase();
                                const yearMatch = strClass.match(/\b(I|II|III|IV|V|VI|VII|VIII|1|2|3|4|5|6|7|8)\b/i);
                                const secMatch = strClass.match(/\b(A|B|C|D|E)\b/i);
                                const normY = (y) => {
                                    if (['I', '1'].includes(y)) return '1';
                                    if (['II', '2'].includes(y)) return '2';
                                    if (['III', 'VI', '3', '6'].includes(y)) return '3';
                                    if (['IV', 'VIII', '4', '8'].includes(y)) return '4';
                                    return y;
                                };
                                if (secMatch) {
                                    const year = yearMatch ? normY(yearMatch[0]) : '1';
                                    finalClass = `Year ${year} - Section ${secMatch[0]}`;
                                }
                            }

                            validTeachers.push({
                                id: `T-${validTeachers.length}-${Math.random().toString(36).substr(2, 5)}`,
                                name: name,
                                department: dept,
                                subject: `${code} - ${subName || cleanSubRaw}`,
                                assignedClass: finalClass,
                                semester: cleanSem,
                                alternatives: [row[map.alt1], row[map.alt2], row[map.alt3]].filter(Boolean).map(a => String(a).trim())
                            });
                        }
                    }
                });
            }
        }

        if (!validSheetFound) {
            headerErrors.push("Could not find any sheets containing 'Teacher Name' or 'Subject' data.");
        }

        if (validTeachers.length === 0 && extractedSubjects.size === 0) {
            headerErrors.push("No valid data rows found in the detected sheets.");
        }

        setPendingTeachers(validTeachers);
        setPendingSubjects(Array.from(extractedSubjects.values()));
        setValidationReport({
            validTeachers: validTeachers.length,
            validSubjects: extractedSubjects.size,
            badRows: [],
            headerErrors: headerErrors,
            mode: 'Strict Assignment (Multi-Sheet)',
            preview: validTeachers.slice(0, 3)
        });
        setValidationStatus(headerErrors.length > 0 ? 'error' : 'success');
    };

    // --- MASTER MODE (Legacy/Fuzzy) ---
    const validateMaster = (sheets) => {
        let teachersFound = [];
        let subjectsFound = [];

        Object.keys(sheets).forEach(name => {
            const rows = sheets[name];
            if (!rows || !rows.length) return;
            const keys = Object.keys(rows[0]).map(k => k.toLowerCase());

            const hasTeacher = keys.some(k => k.includes('teacher') || k.includes('faculty') || k.includes('staff'));
            const hasName = keys.some(k => k.includes('name'));
            const hasCredits = keys.some(k => k.includes('credit') || k.includes('unit'));

            if (hasTeacher || (hasName && !hasCredits)) {
                teachersFound.push(...rows);
            }

            if ((keys.some(k => k.includes('code') || k.includes('subject')) && hasCredits) || keys.some(k => k.includes('course'))) {
                subjectsFound.push(...rows);
            }
        });

        const fuzzyGet = (row, keywords) => {
            const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
            return key ? row[key] : '';
        };

        const cleanTeachers = teachersFound.map(t => ({
            name: fuzzyGet(t, ['teacher', 'faculty', 'name']),
            department: fuzzyGet(t, ['dept', 'branch', 'department']) || 'General',
            subject: fuzzyGet(t, ['subject', 'course', 'code', 'paper']) || '-',
            assignedClass: fuzzyGet(t, ['class', 'section', 'year', 'sem']) || '-',
            alternatives: [fuzzyGet(t, ['alt1', 'alt subject 1']), fuzzyGet(t, ['alt2', 'alt subject 2'])].filter(Boolean)
        })).filter(t => t.name);

        const cleanSubjects = subjectsFound.map(s => {
            const code = fuzzyGet(s, ['code', 'id', 'subject']);
            const existing = subjects.find(sub => sub.code === code);
            return {
                id: existing ? existing.id : uuidv4(),
                name: fuzzyGet(s, ['name', 'title', 'subject', 'course', 'paper']),
                code: code,
                type: String(fuzzyGet(s, ['type'])).toLowerCase().includes('lab') ? 'Lab' : 'Lecture',
                credit: fuzzyGet(s, ['credit', 'unit', 'hrs']) || '3',
                semester: fuzzyGet(s, ['sem', 'semester', 'term']) || ''
            };
        }).filter(s => s.code && s.name);

        const uniqueTeachers = Array.from(new Map(cleanTeachers.map(t => [t.name + t.subject, t])).values());
        const uniqueSubjects = Array.from(new Map(cleanSubjects.map(s => [s.code, s])).values());

        setPendingTeachers(uniqueTeachers);
        setPendingSubjects(uniqueSubjects);
        setValidationReport({
            validTeachers: uniqueTeachers.length,
            validSubjects: uniqueSubjects.length,
            badRows: [],
            headerErrors: [],
            mode: 'Master Data',
            preview: uniqueTeachers.slice(0, 3)
        });
        setValidationStatus(uniqueTeachers.length > 0 || uniqueSubjects.length > 0 ? 'success' : 'error');
    };

    const downloadSampleFile = () => {
        const header = [
            "S.No", "Sem. No", "Code", "Sem - Subj Code & Name", "No of section", "CREDIT", "A", "B", "C", "D", "E"
        ];

        const theoryData = [
            ["Theory Subjects", "", "", "", "", "", "", "", "", "", ""],
            header,
            ["1", "IV", "CS2411", "CS2411 Theory of Computation", "4", "3", "NU", "DS", "ND", "CS", ""],
            ["2", "IV", "CS2C12", "CS2C12 Database Management Systems", "4", "3", "GM", "SSP", "SMR", "KU", ""],
            ["", "", "", "", "", "", "", "", "", "", ""],
            ["Laboratory Subjects", "", "", "", "", "", "", "", "", "", ""],
            header,
            ["1", "IV", "CS2481", "CS2481 Database Management Systems Laboratory", "4", "2", "GM", "SSP", "ND", "KU", ""]
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(theoryData);

        // Add some styling hints (merges)
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Theory Header
            { s: { r: 5, c: 0 }, e: { r: 5, c: 10 } }  // Lab Header
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Allocation");

        // Faculty Map Sheet
        const facultyData = [
            ["Initial", "Name of Faculty"],
            ["NU", "Dr.N.Uma"],
            ["DS", "Mr.D.Suresh"],
            ["ND", "Ms.N.Deepa"]
        ];
        const wsFaculty = XLSX.utils.aoa_to_sheet(facultyData);
        XLSX.utils.book_append_sheet(wb, wsFaculty, "Faculty Map");

        XLSX.writeFile(wb, "PSNA_Timetable_Template.xlsx");
    };

    const finalizeImport = async () => {
        if (clearBeforeImport) {
            await clearTeachers();
            await clearSubjects();
        }
        if (pendingTeachers.length > 0) await addTeachers(pendingTeachers);
        if (pendingSubjects.length > 0) {
            console.log("Parsed Subjects:", pendingSubjects);
            console.log("Saving subjects to Supabase...");
            const result = await addSubjects(pendingSubjects);
            if (result && result.error) {
                console.error("Subject save failed:", result.error);
            } else {
                console.log("Subjects saved:", result);
            }
        }
        setIsUploadModalOpen(false);
        resetImporter();
        console.log(`[Task 7 Log] ${pendingSubjects.length} subjects saved.`);
        alert(`Successfully imported ${pendingTeachers.length} load assignments and ${pendingSubjects.length} unique subjects.`);
    };

    return (
        <>
            <button
                className="btn btn-primary"
                onClick={() => setIsUploadModalOpen(true)}
                style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', padding: '0.75rem 1.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <Upload size={20} /> <span>Import Excel</span>
            </button>

            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Import Data" footer={null}>
                <div style={{ textAlign: 'center', padding: '1rem' }}>

                    {/* MODE TOGGLE */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => { setImportMode('strict'); resetImporter(); }}
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', fontWeight: '500', border: 'none', background: importMode === 'strict' ? '#fff' : 'transparent', boxShadow: importMode === 'strict' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
                        >
                            Strict (Assignments)
                        </button>
                        <button
                            onClick={() => { setImportMode('master'); resetImporter(); }}
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', fontWeight: '500', border: 'none', background: importMode === 'master' ? '#fff' : 'transparent', boxShadow: importMode === 'master' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
                        >
                            Master Data (Flexible)
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <input
                            type="checkbox"
                            id="clearData"
                            checked={clearBeforeImport}
                            onChange={(e) => setClearBeforeImport(e.target.checked)}
                        />
                        <label htmlFor="clearData" style={{ cursor: 'pointer', color: clearBeforeImport ? 'var(--danger)' : 'inherit', fontWeight: clearBeforeImport ? '600' : 'normal' }}>
                            Clear existing data before import
                        </label>
                    </div>

                    {validationStatus === 'idle' && (
                        <div style={{ padding: '2rem', border: '2px dashed var(--border)', borderRadius: '8px' }}>
                            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                            <div onClick={() => fileInputRef.current.click()} style={{ cursor: 'pointer' }}>
                                <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                                <p style={{ fontWeight: 600 }}>Click to Upload Excel File</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                                    {importMode === 'strict' ? 'Requires Single Sheet with: Name, Dept, Subject, Class' : 'Supports Multi-sheet Catalog (Faculty, Subjects)'}
                                </p>
                            </div>
                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>Don't have a file?</p>
                                <button
                                    onClick={downloadSampleFile}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
                                >
                                    Download Excel Template
                                </button>
                            </div>
                        </div>
                    )}

                    {validationReport && (
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 'bold' }}>{fileName}</span>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '4px' }} onClick={resetImporter}>Change File</button>
                            </div>

                            {validationReport.headerErrors && validationReport.headerErrors.length > 0 ? (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <AlertCircle size={20} /> Import Error ({importMode})
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#b91c1c', fontSize: '0.9rem' }}>
                                        {validationReport.headerErrors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>{validationReport.validTeachers}</div>
                                            <div style={{ fontSize: '0.8rem' }}>Teachers</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>{validationReport.validSubjects}</div>
                                            <div style={{ fontSize: '0.8rem' }}>Subjects</div>
                                        </div>
                                    </div>

                                    {validationReport.preview && validationReport.preview.length > 0 && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-light)', marginBottom: '0.5rem' }}>Data Preview (First 3 rows):</p>
                                            <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', width: '40px' }}>Sem</th>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', width: '80px' }}>Code</th>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Teacher</th>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Section</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {validationReport.preview.map((row, i) => (
                                                            <tr key={i}>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.semester}</td>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.subject.split(' - ')[0]}</td>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.name}</td>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.assignedClass}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {(validationReport.preview.some(r => r.subject === '-' || r.assignedClass === '-')) && (
                                                <p style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <AlertCircle size={12} /> Note: Some fields are empty. Check your Excel column headers.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={finalizeImport}>
                                        Confirm Import
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
};

export default DataImporter;
