import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { generateClassTimetable, DAYS, isBlockSubject } from '../utils/TimetableGenerator';
import { Printer, Play, Calendar, Clock, Layers, Save, FileSpreadsheet, Download, X, Lock, FileText, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { hasExistingTimetable, loadGeneralTimetable, saveTimetable, getCurrentAcademicYear } from '../services/timetablePersistence';
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const getCleanLabCode = (c) => norm(c).replace(/_LAB|_\d+/g, '');
const isLabNode = (cell) => {
    if (!cell) return false;
    const type = String(cell.type || '').toUpperCase();
    const name = String(cell.name || '').toUpperCase();
    const code = String(cell.code || '').toUpperCase();
    if (type.includes('INTEGRATED') || name.includes('INTEGRATED') || name.includes('GRAPHICS')) return true;
    if (type.includes('LAB') || type.includes('PRACTICAL') || type.includes('LABORATORY') || type.includes('WORKSHOP') || type.includes('PROJECT')) return true;
    if (name.includes('LAB') || name.includes('PRACTICAL') || code.includes('LAB') || name.includes('PROJECT')) return true;
    return false;
};
const Timetable = () => {
    const { subjects, teachers, schedule, updateSchedule, facultyAccounts, department, timeSlots } = useData();
    const [semester, setSemester] = useState('');
    const [grids, setGrids] = useState({});
    const [selectedSectionView, setSelectedSectionView] = useState('A');
    const [isGenerated, setIsGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLockMode, setIsLockMode] = useState(false);
    const [lockedCells, setLockedCells] = useState({});
    const [isPrintingAll, setIsPrintingAll] = useState(false);
    const teachingSlotsCount = timeSlots ? timeSlots.filter(s => s.type !== 'break').length : 7;
    const availableSemesters = Array.from(new Set(subjects.map(s => s.semester))).filter(Boolean).sort();
    useEffect(() => {
        const semesterList = Array.from(new Set(subjects.map(s => s.semester))).filter(Boolean).sort();
        if (semesterList.length > 0 && (!semester || !semesterList.includes(semester))) {
            setSemester(semesterList[0]);
        }
    }, [subjects, semester]);
    useEffect(() => {
        let isMounted = true;
        const checkPersistence = async () => {
            if (!semester) return;
            
            try {
                const academicYear = getCurrentAcademicYear();
                const exists = await hasExistingTimetable(department, academicYear, semester);
                
                if (!isMounted) return;
                
                if (exists) {
                    const loadedGrids = await loadGeneralTimetable(department, academicYear, semester);
                    if (loadedGrids && Object.keys(loadedGrids).length > 0) {
                        setGrids(loadedGrids);
                        setIsGenerated(true);
                        const sections = Object.keys(loadedGrids).sort();
                        if (sections.length > 0 && !sections.includes(selectedSectionView)) {
                            // Only set if not already present to avoid infinite re-renders
                            setSelectedSectionView(prev => sections.includes(prev) ? prev : sections[0]);
                        }
                        return;
                    }
                }
            } catch (err) {
                console.error("Error loading timetable from persistence:", err);
            }
            
            if (!isMounted) return;

            if (schedule && schedule[semester] && Object.keys(schedule[semester]).length > 0) {
                setGrids(schedule[semester]);
                setIsGenerated(true);
                const sections = Object.keys(schedule[semester]).sort();
                if (!sections.includes(selectedSectionView)) {
                    setSelectedSectionView(prev => sections.includes(prev) ? prev : sections[0]);
                }
            } else {
                setGrids({});
                setIsGenerated(false);
            }
        };
        checkPersistence();
        return () => { isMounted = false; };
    }, [semester, schedule, department]);
    const getSectionsForSemester = (sem) => {
        return Array.from(new Set(
            subjects.filter(s => s.semester === sem)
                .flatMap(s => teachers.filter(t => t.subjectCode === s.code && t.semester === sem).map(t => t.section))
        )).filter(Boolean).sort();
    };
    const handleGenerate = () => {
        if (!subjects || subjects.length === 0) return;
        setIsGenerating(true);
        setTimeout(async () => {
            try {
                const sections = getSectionsForSemester(semester);
                console.log(`[Timetable] Generating for Semester: ${semester}, Sections: ${sections}`);
                const allSubjects = subjects.filter(s => s.semester === semester);
                console.log(`[Timetable] Subjects count: ${allSubjects.length}`);
                allSubjects.forEach(s => console.log(`  - ${s.code}: ${s.credit} credits, type: ${s.type}`));
                const sectionsToGenerate = sections.length > 0 ? sections : ['A'];
                const semTeachers = teachers.filter(t => t.semester === semester);
                console.log(`[Timetable] Teachers count for this semester: ${semTeachers.length}`);
                const teacherFrequency = {};
                semTeachers.forEach(t => {
                    teacherFrequency[t.name] = (teacherFrequency[t.name] || 0) + 1;
                });
                console.log(`[Timetable] Teacher loads (subject count):`, teacherFrequency);
                const globalReservedSlots = {};
                const globalLabUsage = {};
                const globalFacultyLoad = {};
                Object.keys(schedule).forEach(sem => {
                    const semGrids = schedule[sem] || {};
                    Object.values(semGrids).forEach(grid => {
                        if (grid && Array.isArray(grid)) {
                            grid.forEach((dayRow, d) => {
                                dayRow.forEach((cell, s) => {
                                    if (cell && cell.teacherName && cell.teacherName !== 'TBA') {
                                        const tName = cell.teacherName.toUpperCase();
                                        if (!globalFacultyLoad[tName]) globalFacultyLoad[tName] = { total: 0 };
                                        if (!globalFacultyLoad[tName][d]) globalFacultyLoad[tName][d] = 0;
                                        globalFacultyLoad[tName][d]++;
                                        globalFacultyLoad[tName].total++;
                                    }
                                });
                            });
                        }
                    });
                });
                let finalGrids = null;
                const preReservedFromOtherSemesters = {};
                Object.keys(schedule).forEach(sem => {
                    if (sem === semester) return; // Skip current semester
                    const semGrids = schedule[sem] || {};
                    Object.values(semGrids).forEach(grid => {
                        if (grid && Array.isArray(grid)) {
                            grid.forEach((dayRow, d) => {
                                dayRow.forEach((cell, s) => {
                                    if (cell && cell.teacherName && cell.teacherName !== 'TBA') {
                                        const key = `${d}-${s}`;
                                        if (!preReservedFromOtherSemesters[key]) preReservedFromOtherSemesters[key] = new Set();
                                        const names = cell.teacherName.split('/').map(n => n.trim().toUpperCase());
                                        names.forEach(n => preReservedFromOtherSemesters[key].add(n));
                                        if (isLabNode(cell) && cell.isStart) preReservedFromOtherSemesters[key].add('LAB_START');
                                    }
                                });
                            });
                        }
                    });
                });

                const userFixedSlots = {};
                Object.keys(lockedCells).forEach(key => {
                    const [sec, dStr, sStr] = key.split('-');
                    const d = parseInt(dStr);
                    const slot = parseInt(sStr);
                    if (grids[sec] && grids[sec][d] && grids[sec][d][slot]) {
                        const cell = grids[sec][d][slot];
                        if (!cell.isStart && (cell.isLab || cell.duration > 1)) return; 
                        if (!userFixedSlots[sec]) userFixedSlots[sec] = {};
                        const codes = String(cell.code).split('/').map(c => c.trim());
                        codes.forEach(c => {
                            if (!userFixedSlots[sec][c]) userFixedSlots[sec][c] = [];
                            if (!userFixedSlots[sec][c].some(f => f.d === d && f.s === slot)) {
                                userFixedSlots[sec][c].push({ d, s: slot, duration: cell.duration || 1 });
                            }
                        });
                    }
                });

                for (let attempt = 0; attempt < 200; attempt++) {
                    const dayClusters = Array.from({length: 6}, () => Math.random() > 0.5);
                    const currentGrids = {};
                    const currentGlobalFacultyLoad = JSON.parse(JSON.stringify(globalFacultyLoad));
                    const semesterLabSlots = {};
                    const sectionFixedLabs = {};
                    const globalReservedSlots = {};
                    // Copy pre-reserved from other semesters
                    Object.keys(preReservedFromOtherSemesters).forEach(key => {
                        globalReservedSlots[key] = new Set(preReservedFromOtherSemesters[key]);
                    });
                    const globalLabUsage = {};
                    
                    // --- PHASE 1: ELECTIVES (NEW) ---
                    let electivePhaseSuccess = true;
                    const semesterElectives = {};
                    
                    for (const section of sectionsToGenerate) {
                        const sectionSubjects = subjects.filter(s => s.semester === semester);
                        sectionSubjects.forEach(sub => {
                            const nameUpper = String(sub.name || '').toUpperCase();
                            const typeUpper = String(sub.type || '').toUpperCase();
                            const isElective = (
                                typeUpper.includes('ELECTIVE') || 
                                typeUpper.includes('MANDATORY') || 
                                typeUpper.includes('OPEN') || 
                                typeUpper.includes('PROFESSIONAL') || 
                                nameUpper.includes('ELECTIVE') || 
                                nameUpper.includes('MANDATORY') || 
                                nameUpper.includes('VALUE ADDED') || 
                                /[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*\*?\s*$/i.test(sub.name)
                            ) && !(sub.code && sub.code.includes('GE2731'));
                            
                            if (isElective) {
                                let match = nameUpper.match(/(OPEN|PROFESSIONAL|FREE|DEPT|DEPARTMENT)?[\s-]*ELECTIVE[\s-–—]*([IVX]+|\d+)\s*(\*?)/);
                                if (!match) {
                                    const romanMatch = nameUpper.trim().match(/[-\s–—]+([IVX]+|\d+)\s*(\*?)$/);
                                    if (romanMatch) {
                                        match = [null, '', romanMatch[1], romanMatch[2]];
                                    }
                                }
                                let groupKey = match ? `${match[1] || ''}ELECTIVE - ${match[2]}${match[3] || ''}` : `SyncGroup - ${nameUpper} - ${sub.code}`;
                                if (nameUpper.includes('VALUE ADDED')) {
                                    groupKey = `VALUE ADDED COURSE - ${nameUpper} - ${sub.code}`;
                                } else if (nameUpper.includes('MANDATORY') || typeUpper.includes('MANDATORY')) {
                                    groupKey = `MANDATORY COURSE - ${nameUpper} - ${sub.code}`;
                                }
                                if (groupKey) {
                                    if (!semesterElectives[groupKey]) {
                                        semesterElectives[groupKey] = {
                                            sections: new Set(),
                                            credits: 0,
                                            satCount: 0,
                                            subjects: []
                                        };
                                    }
                                    semesterElectives[groupKey].sections.add(section);
                                    const wk = parseInt(sub.credit) || 0;
                                    const sat = parseInt(sub.satCount) || 0;
                                    if (wk > semesterElectives[groupKey].credits) semesterElectives[groupKey].credits = wk;
                                    if (sat > semesterElectives[groupKey].satCount) semesterElectives[groupKey].satCount = sat;
                                    
                                    const subjectTeachers = teachers.filter(t => t.subjectCode === sub.code && t.section === section);
                                    const names = subjectTeachers.map(t => t.name);
                                    semesterElectives[groupKey].subjects.push({ ...sub, section, allTeachers: names, teacherName: names.length > 0 ? names.join(' / ') : 'TBA' });
                                }
                            }
                        });
                    }

                    Object.keys(semesterElectives).forEach(groupKey => {
                        if (!electivePhaseSuccess) return;
                        const electiveInfo = semesterElectives[groupKey];
                        const participatingSections = Array.from(electiveInfo.sections);
                        let remWk = electiveInfo.credits;
                        let remSat = electiveInfo.satCount;
                        let electiveUsedS0 = false;
                        const isElectiveRestricted = electiveInfo.subjects.some(sub => {
                            const name = String(sub.name || '').toUpperCase();
                            const type = String(sub.type || '').toUpperCase();
                            return name.includes('VALUE ADDED') || type.includes('VALUE ADDED') || 
                                   name.includes('MANDATORY') || type.includes('MANDATORY') ||
                                   name.includes('SPOKEN TUTORIAL');
                        });
                        
                        const allocateElectiveSlots = (count, availableDays) => {
                            let dayPool = [...availableDays].sort(() => Math.random() - 0.5);
                            for (let i = 0; i < count; i++) {
                                let placed = false;
                                if (dayPool.length === 0) dayPool = [...availableDays].sort(() => Math.random() - 0.5); // Refill if needed
                                
                                for (let dIdx = 0; dIdx < dayPool.length; dIdx++) {
                                    const d = dayPool[dIdx];
                                    const baseOrder = Array.from({ length: teachingSlotsCount }, (_, k) => k);
                                    // Randomize Morning/Afternoon clustering per day, PER ATTEMPT!
                                    // This prevents catastrophic "pincer" blocks and 4-hour lab failures.
                                    const isMorning = dayClusters[d];
                                    const sOrder = isMorning ? baseOrder : [...baseOrder].reverse();
                                    for (const s of sOrder) {
                                        if (s === 0 && (electiveUsedS0 || isElectiveRestricted)) continue;
                                        const slotKey = `${d}-${s}`;
                                        let slotUsed = false;
                                        for (const sec of participatingSections) {
                                           if (sectionFixedLabs[sec]) {
                                              Object.values(sectionFixedLabs[sec]).forEach(fixedArr => {
                                                  if(fixedArr.some(f => f.d === d && f.s === s)) slotUsed = true;
                                              });
                                           }
                                           allSubjects.forEach(sub => {
                                               if (sub.fixedSlots && sub.fixedSlots[sec]) {
                                                   sub.fixedSlots[sec].forEach(f => {
                                                       if (f.d === d && s >= f.s && s < f.s + (f.duration || 1)) {
                                                           slotUsed = true;
                                                       }
                                                   });
                                               }
                                           });
                                        }
                                        if (slotUsed) continue;
                                        let teacherConflict = false;
                                        electiveInfo.subjects.forEach(sub => {
                                            sub.allTeachers.forEach(t => {
                                                if (globalReservedSlots[slotKey] && globalReservedSlots[slotKey].has(t.toUpperCase())) {
                                                    teacherConflict = true;
                                                }
                                            });
                                        });
                                        if (teacherConflict) continue;
                                        
                                        // Valid Slot!
                                        if (!globalReservedSlots[slotKey]) globalReservedSlots[slotKey] = new Set();
                                        participatingSections.forEach(sec => {
                                            if (!sectionFixedLabs[sec]) sectionFixedLabs[sec] = {};
                                            const secSubjects = electiveInfo.subjects.filter(sub => sub.section === sec);
                                            secSubjects.forEach(sub => {
                                                if (!sectionFixedLabs[sec][sub.code]) sectionFixedLabs[sec][sub.code] = [];
                                                sectionFixedLabs[sec][sub.code].push({ d, s, duration: 1 });
                                            });
                                            // CRITICAL: Block Labs for THIS section from overwriting this slot!
                                            globalReservedSlots[slotKey].add(`BLOCK_ELECTIVE_${sec}`);
                                        });
                                        
                                        electiveInfo.subjects.forEach(sub => {
                                            sub.allTeachers.forEach(t => globalReservedSlots[slotKey].add(t.toUpperCase()));
                                        });
                                        
                                        placed = true;
                                        if (s === 0) electiveUsedS0 = true;
                                        dayPool.splice(dIdx, 1); // Remove this day so we don't pick it again for this elective
                                        break;
                                    }
                                    if (placed) break;
                                }
                                if (!placed) {
                                    console.warn(`[Phase 1] Could not sync all slots for group ${groupKey}. Handing remaining slots to Phase 3.`);
                                    break;
                                }
                            }
                        };
                        allocateElectiveSlots(remWk, [0, 1, 2, 3, 4]);
                        if (electivePhaseSuccess && remSat > 0) allocateElectiveSlots(remSat, [5]);
                    });
                    
                    if (!electivePhaseSuccess) continue;
                    
                    let labPhaseSuccess = true;
                    const globalFacultyDemand = {};
                    subjects.filter(s => s.semester === semester && isBlockSubject(s)).forEach(sub => {
                        const subjectTeachers = teachers.filter(t => t.subjectCode === sub.code);
                        subjectTeachers.forEach(t => {
                            globalFacultyDemand[String(t.name).trim().toUpperCase()] = (globalFacultyDemand[String(t.name).trim().toUpperCase()] || 0) + (sub.remWk || 0);
                        });
                    });

                    const sectionCandidateScores = sectionsToGenerate.map(section => {
                        const sectionLabSubjects = subjects.filter(s => s.semester === semester && isBlockSubject(s)).map(sub => {
                            const subjectTeachers = teachers.filter(t => t.subjectCode === sub.code && t.section === section);
                            const names = subjectTeachers.map(t => t.name);
                            return {
                                ...sub,
                                allTeachers: [...names, `BLOCK_ELECTIVE_${section}`]
                            };
                        });
                        
                        let candidateCount = 0;
                        let facultyLoadScore = 0;
                        sectionLabSubjects.forEach(lab => {
                            lab.allTeachers.forEach(t => {
                                facultyLoadScore += (globalFacultyDemand[String(t).trim().toUpperCase()] || 0);
                            });
                            for (let d = 0; d < 5; d++) {
                                for (let s = 1; s <= 5; s++) {
                                    if (s + 2 > teachingSlotsCount) continue;
                                    let free = true;
                                    for (let k = 0; k < 2; k++) {
                                        const slotKey = `${d}-${s+k}`;
                                        if (globalReservedSlots[slotKey] && lab.allTeachers.some(t => globalReservedSlots[slotKey].has(String(t).trim().toUpperCase()))) {
                                            free = false;
                                        }
                                    }
                                    if (free) candidateCount++;
                                }
                            }
                        });
                        return { section, candidateCount, facultyLoadScore };
                    });
                    if (attempt > 0) {
                        sectionCandidateScores.sort(() => Math.random() - 0.5);
                    } else {
                        sectionCandidateScores.sort((a, b) => {
                            if (a.candidateCount !== b.candidateCount) return a.candidateCount - b.candidateCount;
                            return b.facultyLoadScore - a.facultyLoadScore;
                        });
                    }
                    const sortedSectionsForLabs = sectionCandidateScores.map(sc => sc.section);
                    
                    for (const section of sortedSectionsForLabs) {
                        const allSectionSubjects = subjects.filter(s => s.semester === semester);
                        const labSubjects = allSectionSubjects.filter(sub => {
                            return isBlockSubject(sub);
                        }).map(sub => {
                            const subjectTeachers = teachers.filter(t => t.subjectCode === sub.code && t.section === section);
                            const names = subjectTeachers.map(t => t.name);
                            const s = {
                                ...sub,
                                teacherName: names.length > 0 ? names.join(' / ') : 'TBA',
                                // Inject per-section block so this lab strictly avoids THIS section's elective slots
                                allTeachers: [...names, `BLOCK_ELECTIVE_${section}`]
                            };
                            if (userFixedSlots[section] && userFixedSlots[section][s.code]) {
                                s.fixedSlots = userFixedSlots[section][s.code];
                            }
                            return s;
                        });
                        if (labSubjects.length === 0) continue;
                        const labSyncElectives = {};
                        const labGrid = generateClassTimetable(
                            semester,
                            section,
                            labSubjects,
                            globalReservedSlots,
                            labSyncElectives,
                            true,
                            globalLabUsage,
                            teachingSlotsCount,
                            currentGlobalFacultyLoad,
                            {}
                        );
                        if (!labGrid) {
                            if (!window.failReason || (!window.failReason.includes('Unplaced') && !window.failReason.includes('Phase 2'))) {
                                window.failReason = `Phase 2 (Labs) failed for section ${section}`;
                            }
                            labPhaseSuccess = false;
                            break;
                        }
                        if (!sectionFixedLabs[section]) sectionFixedLabs[section] = {};
                        labGrid.forEach((dayRow, d) => {
                            dayRow.forEach((cell, s) => {
                                if (cell && (cell.isLab || cell.duration > 1)) {
                                    semesterLabSlots[`${d}-${s}`] = true;
                                    globalLabUsage[`${d}-${s}-${cell.code}`] = true;
                                    const key = `${d}-${s}`;
                                    if (!globalReservedSlots[key]) globalReservedSlots[key] = new Set();

                                    if (cell.allTeachers && cell.allTeachers.length > 0) {
                                        cell.allTeachers.forEach(t => globalReservedSlots[key].add(t.toUpperCase()));
                                    } else if (cell.teacherName && cell.teacherName !== 'TBA') {
                                        globalReservedSlots[key].add(cell.teacherName.toUpperCase());
                                    }

                                    if (cell.isStart) globalReservedSlots[key].add('LAB_START');
                                    if (cell.isStart) {
                                        const codes = String(cell.code).split('/').map(c => c.trim());
                                        codes.forEach(code => {
                                            if (!sectionFixedLabs[section][code]) sectionFixedLabs[section][code] = [];
                                            sectionFixedLabs[section][code].push({ d, s, duration: cell.duration || 1 });
                                        });
                                    }
                                }
                            });
                        });
                    }
                    if (!labPhaseSuccess) continue;
                    let fullPhaseSuccess = true;
                    const phase2FacultyLoad = JSON.parse(JSON.stringify(globalFacultyLoad));
                    const phase2Reserved = {};
                    // Copy global reserved (which includes other semesters AND findings from Phase 1 Labs)
                    Object.keys(globalReservedSlots).forEach(key => {
                        phase2Reserved[key] = new Set(globalReservedSlots[key]);
                    });
                    const phase2SyncElectives = {};
                    const shuffledSections = [...sectionsToGenerate].sort(() => Math.random() - 0.5);
                    for (const section of shuffledSections) {
                        const mappedSubjects = subjects
                            .filter(s => s.semester === semester)
                            .map(sub => {
                                const subjectTeachers = teachers.filter(t => t.subjectCode === sub.code && t.section === section);
                                const names = subjectTeachers.map(t => t.name);
                                let s = {
                                    ...sub,
                                    teacherName: names.length > 0 ? names.join(' / ') : 'TBA',
                                    allTeachers: names
                                };
                                if (sectionFixedLabs[section] && sectionFixedLabs[section][s.code]) {
                                    s.fixedSlots = sectionFixedLabs[section][s.code];
                                }
                                if (userFixedSlots[section] && userFixedSlots[section][s.code]) {
                                    s.fixedSlots = [...(s.fixedSlots || []), ...userFixedSlots[section][s.code]];
                                }
                                return s;
                            });
                        const sectionSubjects = [];
                        const electiveGroups = {};
                        mappedSubjects.forEach(sub => {
                            const nameUpper = sub.name.toUpperCase();
                            const isElective = ((sub.type === 'Elective') || nameUpper.includes('ELECTIVE') || /[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*\*?\s*$/i.test(sub.name) || nameUpper.includes('VALUE ADDED')) && !(sub.code && sub.code.includes('GE2731'));
                            if (isElective) {
                                let match = nameUpper.match(/(OPEN|PROFESSIONAL|FREE|DEPT|DEPARTMENT)?[\s-]*ELECTIVE[\s-–—]*(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)/);
                                if (!match) {
                                    const romanMatch = nameUpper.trim().match(/[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)$/);
                                    if (romanMatch) {
                                        match = [null, '', romanMatch[1], romanMatch[2]];
                                    }
                                }
                                let groupKey = match ? `${match[1] || ''}ELECTIVE - ${match[2]}${match[3] || ''}` : (sub.type === 'Elective' ? 'GeneralElective' : null);
                                if (nameUpper.includes('VALUE ADDED')) {
                                    groupKey = 'VALUE ADDED COURSE';
                                }
                                if (groupKey) {
                                    if (!electiveGroups[groupKey]) electiveGroups[groupKey] = [];
                                    electiveGroups[groupKey].push(sub);
                                    return;
                                }
                            }
                            sectionSubjects.push(sub);
                        });
                        Object.values(electiveGroups).forEach(group => {
                            if (group.length === 1) sectionSubjects.push(group[0]);
                            else if (group.length > 1) {
                                const uniqueCodes = Array.from(new Set(group.map(s => s.code)));
                                const uniqueTeachers = Array.from(new Set(group.flatMap(s => s.allTeachers || [s.teacherName])));
                                const merged = {
                                    ...group[0],
                                    code: uniqueCodes.join(' / '),
                                    teacherName: uniqueTeachers.filter(t => t && t !== 'TBA').join(' / '),
                                    allTeachers: uniqueTeachers.filter(t => t && t !== 'TBA'),
                                    type: 'Elective'
                                };
                                merged.credit = Math.max(...group.map(s => parseInt(s.credit) || 0));
                                merged.satCount = Math.max(...group.map(s => parseInt(s.satCount) || 0));
                                
                                let mergedFixedSlots = [];
                                group.forEach(s => {
                                    if (s.fixedSlots) {
                                        if (Array.isArray(s.fixedSlots)) {
                                            mergedFixedSlots.push(...s.fixedSlots);
                                        } else {
                                            Object.values(s.fixedSlots).forEach(arr => {
                                                if (Array.isArray(arr)) mergedFixedSlots.push(...arr);
                                            });
                                        }
                                    }
                                });
                                const uniqueFixed = [];
                                const seenFixed = new Set();
                                mergedFixedSlots.forEach(f => {
                                    const key = `${f.d}-${f.s}`;
                                    if (!seenFixed.has(key)) {
                                        seenFixed.add(key);
                                        uniqueFixed.push(f);
                                    }
                                });
                                if (uniqueFixed.length > 0) merged.fixedSlots = uniqueFixed;
                                
                                sectionSubjects.push(merged);
                            }
                        });
                        const isRelaxed = attempt > 10;
                        let sectionGrid = generateClassTimetable(
                            semester,
                            section,
                            sectionSubjects,
                            phase2Reserved,
                            phase2SyncElectives,
                            isRelaxed,
                            globalLabUsage,
                            teachingSlotsCount,
                            phase2FacultyLoad,
                            semesterLabSlots
                        );
                        if (!sectionGrid) {
                            console.warn(`[Timetable] Theory Phase failed for Section ${section}`);
                            window.failReason = `Phase 3 (Theory) failed for section ${section}`;
                            fullPhaseSuccess = false;
                            break;
                        }
                        currentGrids[section] = sectionGrid;
                        sectionGrid.forEach((dayRow, d) => {
                            dayRow.forEach((cell, s) => {
                                if (cell) {
                                    const key = `${d}-${s}`;
                                    if (!phase2Reserved[key]) phase2Reserved[key] = new Set();

                                    if (cell.allTeachers && cell.allTeachers.length > 0) {
                                        cell.allTeachers.forEach(t => phase2Reserved[key].add(t.toUpperCase()));
                                    } else if (cell.teacherName && cell.teacherName !== 'TBA') {
                                        const tName = cell.teacherName.toUpperCase();
                                        phase2Reserved[key].add(tName);
                                    }

                                    if (isLabNode(cell) && cell.isStart) phase2Reserved[key].add('LAB_START');
                                }
                            });
                        });
                    }
                    if (fullPhaseSuccess) {
                        finalGrids = currentGrids;
                        break;
                    }
                }
                if (finalGrids) {
                    updateSchedule(semester, finalGrids);
                    setGrids(finalGrids);
                    setIsGenerated(true);
                    
                    const saveRes = await saveTimetable({
                        departmentId: department,
                        departmentName: department,
                        semester: semester,
                        grids: finalGrids,
                        teachers: teachers,
                        timeSlots: timeSlots
                    });
                    if (saveRes.success) {
                        console.log("General timetable rows saved:", saveRes.generalCount || 'Success');
                        console.log("Faculty timetable rows saved:", saveRes.facultyCount || 'Success');
                        console.log("Schedule updated: successfully updated in DataContext");
                    }
                    if (!saveRes.success) {
                        alert("Timetable generated successfully.\nFailed to save timetable.");
                    }
                } else {
                    alert("Generation Failed: " + (window.failReason || "Could not generate a complete timetable satisfying all lab constraints."));
                }
            } catch (error) {
                console.error(error); alert("Crash: " + error.message + " | " + error.stack);
            } finally {
                setIsGenerating(false);
            }
        }, 500);
    };
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [isSemDropdownOpen, setIsSemDropdownOpen] = useState(false);
    const dropdownRef = React.useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsSemDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const handleCellClick = (dIdx, sIdx, cell) => {
        if (isLockMode) {
            const key = `${selectedSectionView}-${dIdx}-${sIdx}`;
            setLockedCells(prev => {
                const newLocked = { ...prev };
                if (newLocked[key]) delete newLocked[key];
                else newLocked[key] = true;
                return newLocked;
            });
            return;
        }
        setEditingCell({ day: dIdx, slot: sIdx, section: selectedSectionView, cell });
        setEditValue(cell ? cell.code : '');
    };
    const handleSaveEdit = () => {
        if (!editingCell) return;
        const { day, slot, section } = editingCell;
        const newGrids = { ...grids };
        if (editValue === '' || editValue.toUpperCase() === 'FREE') {
            newGrids[section][day][slot] = null;
        } else if (editValue.startsWith('GROUP:')) {
            const groupName = editValue.substring(6);
            const currentSemesterSubjects = subjects.filter(s => s.semester === semester);
            const groupMembers = currentSemesterSubjects.filter(sub => {
                const nameUpper = sub.name.toUpperCase();
                const isElective = ((sub.type === 'Elective') || nameUpper.includes('ELECTIVE') || /[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*\*?\s*$/i.test(sub.name) || nameUpper.includes('VALUE ADDED')) && !(sub.code && sub.code.includes('GE2731'));
                if (!isElective) return false;
                let match = nameUpper.match(/(OPEN|PROFESSIONAL|FREE|DEPT|DEPARTMENT)?[\s-]*ELECTIVE[\s-–—]*(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)/);
                if (!match) {
                    const romanMatch = nameUpper.trim().match(/[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)$/);
                    if (romanMatch) {
                        match = [null, '', romanMatch[1], romanMatch[2]];
                    }
                }
                let key = match ? `${match[1] || ''}ELECTIVE - ${match[2]}${match[3] || ''}` : (sub.type === 'Elective' ? 'GeneralElective' : null);
                if (nameUpper.includes('VALUE ADDED')) {
                    key = 'VALUE ADDED COURSE';
                }
                return key === groupName;
            });
            if (groupMembers.length > 0) {
                const uniqueCodes = Array.from(new Set(groupMembers.map(s => s.code)));
                const teacherNames = groupMembers.map(sub => {
                    const t = teachers.find(t => t.subjectCode === sub.code && t.section === section);
                    return t ? t.name : 'TBA';
                });
                const merged = {
                    ...groupMembers[0],
                    code: uniqueCodes.join(' / '),
                    teacherName: teacherNames.join('/'),
                    type: 'Elective',
                    duration: 1,
                    isStart: true
                };
                merged.credit = Math.max(...groupMembers.map(s => parseInt(s.credit) || 0));
                merged.satCount = Math.max(...groupMembers.map(s => parseInt(s.satCount) || 0));
                newGrids[section][day][slot] = merged;
            }
        } else {
            const sub = subjects.find(s => s.code === editValue && s.semester === semester);
            const teacher = teachers.find(t => t.subjectCode === editValue && t.section === section);
            if (sub) {
                newGrids[section][day][slot] = {
                    ...sub, teacherName: teacher ? teacher.name : 'TBA', duration: 1, isStart: true
                };
            }
        }
        updateSchedule(semester, newGrids);
        setGrids(newGrids);
        setEditingCell(null);
    };
    const handleExportExcel = () => {
        if (!grids[selectedSectionView]) return;
        const currentGrid = grids[selectedSectionView];
        const rows = [
            ['PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY'],
            ['DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING'],
            [`CLASS TIME TABLE - SEMESTER ${semester} - SECTION ${selectedSectionView}`],
            [''],
            ['DAY', 'P1', 'P2', 'BRK', 'P3', 'P4', 'LUN', 'P5', 'P6', 'P7']
        ];
        DAYS.forEach((day, dIdx) => {
            const row = [day];
            currentGrid[dIdx].forEach((cell, sIdx) => {
                row.push(cell ? `${cell.code} (${cell.teacherName})` : '');
                if (sIdx === 1) row.push('BREAK');
                if (sIdx === 3) row.push('LUNCH');
            });
            rows.push(row);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Timetable");
        XLSX.writeFile(wb, `Timetable_${semester}_${selectedSectionView}.xlsx`);
    };
    const handleExportWord = () => {
        const printContent = document.querySelector('.print-container');
        if (!printContent) return;
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><style>" +
            "table { border-collapse: collapse; width: 100%; } " +
            "th, td { border: 1px solid black; padding: 5px; text-align: center; } " +
            ".print-header { text-align: center; border-bottom: 2px solid black; } " +
            "</style></head><body>";
        const footer = "</body></html>";
        const html = header + printContent.innerHTML + footer;
        const blob = new Blob(['\ufeff', html], {
            type: 'application/msword'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Timetable_${semester}_${selectedSectionView}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintAll = () => {
        setIsPrintingAll(true);
        setTimeout(() => {
            window.print();
            setIsPrintingAll(false);
        }, 800);
    };

    const renderPrintContent = (currentGrid, currentSemester, sectionKey, printIdx) => {
        const placedCodes = new Set();
        currentGrid.flat().forEach(c => {
            if (c) {
                if (c.code.includes('/')) c.code.split('/').forEach(p => placedCodes.add(p.trim()));
                else placedCodes.add(c.code);
            }
        });
        const sectionSubjects = subjects.filter(s => s.semester === currentSemester);
        const uniqueSubjectList = sectionSubjects.map(sub => {
            const sectionTeachers = teachers.filter(t => t.subjectCode === sub.code && t.section === sectionKey);
            const teacherNames = sectionTeachers.length > 0 ? sectionTeachers.map(t => t.name).join(', ') : '';
            const dept = sectionTeachers.length > 0 ? sectionTeachers[0].dept : 'CSE';
            const acronym = sub.name.split(/[\s-]+/)
                .filter(w => w.length > 0 && w !== 'and' && w !== 'of')
                .map(w => w[0].toUpperCase())
                .join('')
                .substring(0, 6);
            return {
                code: sub.code,
                name: sub.name,
                acronym: acronym,
                staff: teacherNames || '',
                dept: dept || 'CSE',
                hoursW: sub.credit || 0,
                hoursS: sub.satCount || 0
            };
        });
        uniqueSubjectList.sort((a, b) => a.code.localeCompare(b.code));
        const renderPrintCell = (cell) => {
            if (!cell) return '';
            if (cell.code.includes('/')) {
                const codes = cell.code.split('/');
                return codes.map((c, i) => (
                    <div key={i} style={{ borderBottom: i < codes.length - 1 ? '1px solid black' : 'none', fontSize: '10pt', fontWeight: 'bold' }}>
                        {c.trim()}
                    </div>
                ));
            }
            return <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{cell.code}</div>;
        };
        const parseSemesterNumber = (semStr) => {
            const s = String(semStr).toUpperCase();
            if (s.includes('VIII') || s.includes('8')) return 8;
            if (s.includes('VII') || s.includes('7')) return 7;
            if (s.includes('VI') || s.includes('6')) return 6;
            if (s.includes('IV') || s.includes('4')) return 4;
            if (s.includes('V') || s.includes('5')) return 5;
            if (s.includes('III') || s.includes('3')) return 3;
            if (s.includes('II') || s.includes('2')) return 2;
            if (s.includes('I') || s.includes('1')) return 1;
            return 1;
        };
        const semNum = parseSemesterNumber(currentSemester);
        let maxSlots = 7;
        if (currentGrid) {
            currentGrid.forEach(dayRow => {
                for (let i = dayRow.length - 1; i >= 0; i--) {
                    if (dayRow[i]) {
                        if (i + 1 > maxSlots) maxSlots = i + 1;
                        break;
                    }
                }
            });
        }
        if (maxSlots > 8) maxSlots = 8;
        
        return (
            <div key={sectionKey} style={{ pageBreakAfter: 'always', padding: '20px' }}>
                <div className="print-header">
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', marginBottom: '10px' }}>
                        <div><img src="https://upload.wikimedia.org/wikipedia/en/e/eb/Psna_cet_logo.png" alt="Logo" style={{ width: '80px', height: 'auto' }} /></div>
                        <div style={{ textAlign: 'center' }}>
                            <h1 style={{ fontSize: '18pt', fontWeight: '900', margin: '0', textTransform: 'uppercase', color: 'black' }}>PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY</h1>
                            <h2 style={{ fontSize: '10pt', fontWeight: 'normal', margin: '5px 0 0 0', fontStyle: 'italic', color: 'black' }}>(An Autonomous Institution, Affiliated to Anna University, Chennai)</h2>
                            <h3 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '10px 0 0 0', textDecoration: 'underline', textTransform: 'uppercase', color: 'black' }}>CLASS TIME TABLE</h3>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><img src="https://upload.wikimedia.org/wikipedia/en/e/eb/Psna_cet_logo.png" alt="IQAC" style={{ width: '60px', opacity: 0.5 }} /></div>
                    </div>
                </div>
                <div className="meta-grid" style={{ borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11pt', fontWeight: 'bold' }}>
                    <div style={{ flex: 1 }}>
                        <div>Dept.: {department || 'CSE'}</div>
                        <div>Sem & Sec.: {currentSemester} - {sectionKey}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div>Academic Year: 2025-2026 {semNum % 2 !== 0 ? 'ODD' : 'EVEN'}</div>
                        <div>Semester: {currentSemester}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                        <div>Course: B.E.</div>
                        <div>Hall No.: _____</div>
                    </div>
                </div>
                <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '10pt' }}>
                    <thead>
                        <tr>
                            <th rowSpan={2} style={{ width: '40px', border: '1px solid black' }}>
                                <div style={{ position: 'relative', height: '40px', width: '100%' }}>
                                    <span style={{ position: 'absolute', top: '2px', right: '2px' }}>Time</span>
                                    <span style={{ position: 'absolute', bottom: '2px', left: '2px' }}>Day</span>
                                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                                        <line x1="0" y1="0" x2="100%" y2="100%" stroke="black" strokeWidth="1" />
                                    </svg>
                                </div>
                            </th>
                            {maxSlots >= 1 && <th style={{ border: '1px solid black' }}>08.40 AM<br />-<br />09.30 AM</th>}
                            {maxSlots >= 2 && <th style={{ border: '1px solid black' }}>09.30 AM<br />-<br />10.20 AM</th>}
                            {maxSlots >= 3 && <th rowSpan={2} style={{ width: '20px', fontSize: '8pt', padding: 0, border: '1px solid black' }}>
                                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>TEA BREAK</div>
                            </th>}
                            {maxSlots >= 3 && <th style={{ border: '1px solid black' }}>10.40 AM<br />-<br />11.30 AM</th>}
                            {maxSlots >= 4 && <th style={{ border: '1px solid black' }}>11.30 AM<br />-<br />12.20 PM</th>}
                            {maxSlots >= 5 && <th rowSpan={2} style={{ width: '30px', fontSize: '8pt', padding: 0, border: '1px solid black' }}>
                                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LUNCH BREAK</div>
                            </th>}
                            {maxSlots >= 5 && <th style={{ border: '1px solid black' }}>01.25 PM<br />-<br />02.10 PM</th>}
                            {maxSlots >= 6 && <th style={{ border: '1px solid black' }}>02.10 PM<br />-<br />02.55 PM</th>}
                            {maxSlots >= 7 && <th rowSpan={2} style={{ width: '20px', fontSize: '8pt', padding: 0, border: '1px solid black' }}>
                                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>TEA BREAK</div>
                            </th>}
                            {maxSlots >= 7 && <th style={{ border: '1px solid black' }}>03.10 PM<br />-<br />03.55 PM</th>}
                            {maxSlots >= 8 && <th style={{ border: '1px solid black' }}>03.55 PM<br />-<br />04.40 PM</th>}
                        </tr>
                        <tr>
                            {maxSlots >= 1 && <th style={{ border: '1px solid black' }}>1</th>}
                            {maxSlots >= 2 && <th style={{ border: '1px solid black' }}>2</th>}
                            {maxSlots >= 3 && <th style={{ border: '1px solid black' }}>3</th>}
                            {maxSlots >= 4 && <th style={{ border: '1px solid black' }}>4</th>}
                            {maxSlots >= 5 && <th style={{ border: '1px solid black' }}>5</th>}
                            {maxSlots >= 6 && <th style={{ border: '1px solid black' }}>6</th>}
                            {maxSlots >= 7 && <th style={{ border: '1px solid black' }}>7</th>}
                            {maxSlots >= 8 && <th style={{ border: '1px solid black' }}>8</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {DAYS.map((day, dIdx) => (
                            <tr key={dIdx}>
                                <td style={{ fontWeight: 'bold', border: '1px solid black', textAlign: 'center' }}>{day.substring(0, 3)}</td>
                                {maxSlots >= 1 && <td style={{ height: '50px', border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][0])}</td>}
                                {maxSlots >= 2 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][1])}</td>}
                                {maxSlots >= 3 && dIdx === 0 && <td rowSpan={6} style={{ background: '#f0f0f0', fontSize: '8pt', textAlign: 'center', border: '1px solid black', verticalAlign: 'middle', padding: 0 }}><div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Tea Break</div></td>}
                                {maxSlots >= 3 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][2])}</td>}
                                {maxSlots >= 4 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][3])}</td>}
                                {maxSlots >= 5 && dIdx === 0 && <td rowSpan={6} style={{ background: '#f0f0f0', fontSize: '8pt', textAlign: 'center', border: '1px solid black', verticalAlign: 'middle', padding: 0 }}><div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Lunch Break</div></td>}
                                {maxSlots >= 5 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][4])}</td>}
                                {maxSlots >= 6 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][5])}</td>}
                                {maxSlots >= 7 && dIdx === 0 && <td rowSpan={6} style={{ background: '#f0f0f0', fontSize: '8pt', textAlign: 'center', border: '1px solid black', verticalAlign: 'middle', padding: 0 }}><div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Tea Break</div></td>}
                                {maxSlots >= 7 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][6])}</td>}
                                {maxSlots >= 8 && <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderPrintCell(currentGrid[dIdx][7])}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <table className="print-footer-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '10pt' }}>
                    <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                            <th style={{ border: '1px solid black', width: '40px', padding: '5px' }}>Sl.No</th>
                            <th style={{ border: '1px solid black', padding: '5px' }}>Sub. Code</th>
                            <th style={{ border: '1px solid black', padding: '5px' }}>Sub. Acronym</th>
                            <th style={{ border: '1px solid black', padding: '5px' }}>Sub. Name</th>
                            <th style={{ border: '1px solid black', width: '40px', padding: '5px', textAlign: 'center' }}>
                                Hours<br /><div style={{ display: 'flex', borderTop: '1px solid black', marginTop: '2px' }}><div style={{ flex: 1, borderRight: '1px solid black' }}>W</div><div style={{ flex: 1 }}>S</div></div>
                            </th>
                            <th style={{ border: '1px solid black', padding: '5px' }}>Faculty Name</th>
                            <th style={{ border: '1px solid black', width: '50px', padding: '5px' }}>Dept.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {uniqueSubjectList.map((item, idx) => (
                            <tr key={idx}>
                                <td style={{ border: '1px solid black', textAlign: 'center', padding: '4px' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid black', fontWeight: 'bold', padding: '4px', textAlign: 'center' }}>{item.code}</td>
                                <td style={{ border: '1px solid black', textAlign: 'center', padding: '4px' }}>{item.acronym}</td>
                                <td style={{ border: '1px solid black', padding: '4px' }}>{item.name}</td>
                                <td style={{ border: '1px solid black', padding: '0' }}>
                                    <div style={{ display: 'flex', height: '100%' }}>
                                        <div style={{ flex: 1, borderRight: '1px solid black', textAlign: 'center', padding: '4px' }}>{item.hoursW}</div>
                                        <div style={{ flex: 1, textAlign: 'center', padding: '4px' }}>{item.hoursS}</div>
                                    </div>
                                </td>
                                <td style={{ border: '1px solid black', padding: '4px' }}>{item.staff}</td>
                                <td style={{ border: '1px solid black', textAlign: 'center', padding: '4px' }}>{item.dept}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', padding: '0 20px', fontWeight: 'bold', fontSize: '11pt' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div>Dept. TT I/C</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div>HOD</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div>TT Convener</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div>PRINCIPAL</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="timetable-page">
            <style>{`
                .timetable-page { 
                    padding: 1.5rem 2.5rem; 
                    background: #f1f5f9; 
                    min-height: 100vh;
                }
                .header-card { 
                    background: #0f172a; 
                    border-radius: 20px; 
                    padding: 1.25rem 2.5rem; 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    margin-bottom: 2rem; 
                    color: white; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    z-index: 100;
                }
                .header-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 0;
                    height: 100%;
                    background: linear-gradient(90deg, rgba(56, 189, 248, 0.15), rgba(56, 189, 248, 0.05));
                    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: -1;
                }
                .header-card:hover::before {
                    width: 100%;
                }
                .header-info { display: flex; align-items: center; gap: 1.25rem; z-index: 2; }
                .header-icon { 
                    background: linear-gradient(135deg, #4f46e5, #8b5cf6); 
                    padding: 0.8rem; 
                    border-radius: 12px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4); 
                    transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 2;
                }
                .header-card:hover .header-icon {
                    transform: rotate(12deg) scale(1.1);
                }
                .header-text h2 { margin: 0; font-weight: 800; font-size: 1.4rem; letter-spacing: -0.01em; }
                .header-text p { margin: 2px 0 0; font-size: 0.75rem; opacity: 0.6; font-weight: 500; }
                .header-actions { display: flex; align-items: center; gap: 0.75rem; z-index: 2; }
                .custom-select-container {
                    position: relative;
                    min-width: 150px;
                }
                .custom-select-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.6rem 1.2rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .custom-select-trigger:hover {
                    background: rgba(255,255,255,0.2) !important;
                }
                .custom-select-menu {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    padding: 8px;
                    z-index: 1000;
                    animation: dropdownFade 0.2s ease-out;
                    max-height: 250px;
                    overflow-y: auto;
                }
                @keyframes dropdownFade {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .custom-select-item {
                    padding: 10px 15px;
                    border-radius: 8px;
                    color: #1e293b;
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .custom-select-item:hover {
                    background: #f1f5f9;
                    color: #3b82f6;
                }
                .custom-select-item.selected {
                    background: #3b82f6;
                    color: white;
                }
                .btn-gen { 
                    background: #3b82f6; 
                    color: white; 
                    border: none; 
                    padding: 0.6rem 1.4rem; 
                    border-radius: 10px; 
                    font-weight: 800; 
                    font-size: 0.75rem; 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .btn-gen:hover { 
                    background: #2563eb; 
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                }
                .btn-gen:active { transform: translateY(0); }
                .icon-btn { 
                    background: white; 
                    border: none; 
                    padding: 0.65rem; 
                    border-radius: 10px; 
                    color: #0f172a; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    transition: all 0.2s;
                }
                .icon-btn:hover { background: #f1f5f9; transform: scale(1.1); }
                .btn-print {
                    background: white;
                    color: #0f172a;
                    border: none;
                    padding: 0.6rem 1.2rem;
                    border-radius: 10px;
                    font-weight: 800;
                    font-size: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-print:hover { background: #f8fafc; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .tabs-container { display: flex; gap: 10px; margin-bottom: 2rem; animation: fadeIn 0.8s ease-out; }
                .tab-btn { 
                    background: white; 
                    border: none; 
                    color: #64748b; 
                    padding: 0.5rem 1.6rem; 
                    border-radius: 50px; 
                    font-weight: 800; 
                    font-size: 0.75rem; 
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .tab-btn.active { 
                    background: #3b82f6; 
                    color: white; 
                    box-shadow: 0 8px 15px rgba(59, 130, 246, 0.3); 
                    transform: scale(1.05);
                }
                .table-glass { 
                    background: white; 
                    border-radius: 24px; 
                    padding: 2.5rem; 
                    box-shadow: 0 4px 25px rgba(0,0,0,0.02); 
                    border: 1px solid #eef2f6; 
                    animation: fadeIn 1s ease-out;
                    z-index: 1;
                    position: relative;
                }
                .grid-table { 
                    width: 100%; 
                    border-collapse: separate; 
                    border-spacing: 0; 
                    table-layout: fixed;
                }
                .grid-table th { 
                    padding: 0 0.5rem 1.5rem 0.5rem; 
                    color: #94a3b8; 
                    font-size: 0.65rem; 
                    font-weight: 900; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em; 
                    text-align: center; 
                }
                .grid-table th span { 
                    font-size: 0.55rem; 
                    font-weight: 700; 
                    opacity: 0.5; 
                    display: block; 
                    margin-top: 4px; 
                }
                .grid-table tbody tr {
                    vertical-align: top;
                }
                .day-label { 
                    font-weight: 900; 
                    color: #1e293b; 
                    font-size: 1rem; 
                    width: 110px; 
                    text-align: left;
                    padding-top: 32px;
                }
                .cell-container { 
                    padding: 10px; 
                    height: auto;
                }
                .subject-card { 
                    min-height: 85px; 
                    width: 100%;
                    max-width: 140px;
                    margin: 0 auto;
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    cursor: pointer; 
                    position: relative;
                    border-radius: 18px;
                    background: #ffffff;
                    border: 1.5px solid #f8fafc;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    animation: scaleUp 0.4s ease-out backwards;
                }
                .subject-card:hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 12px 24px rgba(0,0,0,0.08); border-color: #e2e8f0; }
                .theory-code { 
                    font-weight: 900; 
                    font-size: 1.2rem; 
                    color: #4f46e5; 
                    letter-spacing: -0.01em;
                }
                .lab-box { 
                    background: #f0fdf4; 
                    border-color: #dcfce7; 
                }
                .lab-locked {
                    border: 2px dashed #22c55e;
                    background: #ffffff;
                }
                .lab-code { 
                    font-weight: 900; 
                    font-size: 1.15rem; 
                    color: #166534; 
                }
                .lab-subtext { 
                    font-size: 0.55rem; 
                    color: #22c55e; 
                    font-weight: 900; 
                    margin-top: 2px; 
                }
                .lock-icon {
                    position: absolute;
                    top: 10px;
                    right: 12px;
                    opacity: 0.5;
                    color: #22c55e;
                }
                .divider-col { 
                    width: 50px; 
                    border: none; 
                    padding-top: 32px;
                }
                .vertical-label { 
                    writing-mode: vertical-rl; 
                    transform: rotate(180deg); 
                    font-weight: 900; 
                    font-size: 0.55rem; 
                    color: #94a3b8; 
                    height: 85px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    letter-spacing: 0.3em; 
                    opacity: 0.3; 
                }
                .action-icon { opacity: 0.1; font-weight: 900; font-size: 1.5rem; }
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 9999;
                    display: flex; align-items: center; justify-content: center;
                }
                .modal-box {
                    background: white; width: 90%; max-width: 500px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    animation: modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes modalSlide {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                /* PRINT STYLES */
                .print-container { display: none; font-family: 'Times New Roman', serif; color: black; }
                @media print {
                    .timetable-page { padding: 0; background: white; }
                    .header-card, .tabs-container, .modal-overlay, .table-glass, .btn-print, .header-actions, .header-info, .summary-card { display: none !important; }
                    .print-container { display: block !important; width: 100%; }
                    @page { margin: 0.5cm; size: landscape; }
                    .print-header { text-align: center; margin-bottom: 5px; border-bottom: 2px solid black; padding-bottom: 5px; }
                    .print-header h1 { font-size: 16pt; font-weight: bold; margin: 0; text-transform: uppercase; }
                    .print-header h2 { font-size: 11pt; font-weight: normal; margin: 0; font-style: italic; }
                    .print-header h3 { font-size: 12pt; font-weight: bold; margin: 5px 0 0 0; text-decoration: underline; }
                    .meta-grid { display: flex; justify-content: space-between; font-weight: bold; font-size: 10pt; margin: 5px 0; }
                    .print-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                    .print-table th, .print-table td { border: 1px solid black; padding: 4px; text-align: center; font-size: 10pt; vertical-align: middle; }
                    .print-table th { background: #eee !important; -webkit-print-color-adjust: exact; }
                    .print-table td { height: 45px; }
                    .print-footer-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                    .print-footer-table th, .print-footer-table td { border: 1px solid black; padding: 4px; text-align: left; }
                    .print-footer-table th { text-align: center; background: #eee !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
            <div className="header-card">
                <div className="header-info">
                    <div className="header-icon">
                        <Layers size={28} color="white" />
                    </div>
                    <div className="header-text">
                        <h2>Smart Timetable</h2>
                    </div>
                </div>
                <div className="header-actions">
                    <div className="custom-select-container" ref={dropdownRef}>
                        <div
                            className={`custom-select-trigger ${isSemDropdownOpen ? 'active' : ''}`}
                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white' }}
                            onClick={() => setIsSemDropdownOpen(!isSemDropdownOpen)}
                        >
                            <Calendar size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: '8px' }} />
                            <span>{semester || 'Select Sem'}</span>
                            <Layers size={14} style={{ opacity: 0.5, transform: isSemDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', marginLeft: '8px' }} />
                        </div>
                        {isSemDropdownOpen && (
                            <div className="custom-select-menu">
                                {availableSemesters.map(s => (
                                    <div
                                        key={s}
                                        className={`custom-select-item ${semester === s ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSemester(s);
                                            setIsSemDropdownOpen(false);
                                        }}
                                    >
                                        {s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button className="btn-gen" onClick={handleGenerate} disabled={isGenerating}>
                        <Play size={16} fill="white" /> {isGenerating ? 'GENERATING...' : 'Generate Schedule'}
                    </button>
                    <button className="icon-btn" title="Download Word" onClick={handleExportWord}><Download size={20} /></button>
                    <button className="icon-btn" title="Download Excel" onClick={handleExportExcel}><FileSpreadsheet size={20} /></button>
                    <button className="btn-print" onClick={() => window.print()}><Printer size={18} /> Print Official</button>
                    <button className="btn-print" onClick={handlePrintAll} style={{ marginLeft: '10px', background: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}><Printer size={18} /> Print All</button>
                </div>
            </div>
            <div className="tabs-container" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {getSectionsForSemester(semester).map(sec => (
                        <button
                            key={sec}
                            className={`tab-btn ${selectedSectionView === sec ? 'active' : ''}`}
                            onClick={() => setSelectedSectionView(sec)}
                        >
                            Section {sec}
                        </button>
                    ))}
                </div>
                
                <button 
                    style={{
                        marginLeft: 'auto',
                        background: isLockMode ? '#ef4444' : 'rgba(15, 23, 42, 0.05)',
                        color: isLockMode ? 'white' : '#475569', border: isLockMode ? 'none' : '1px solid #cbd5e1', 
                        padding: '0 16px', height: '38px', borderRadius: '8px',
                        fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                    }}
                    onClick={() => {
                        const newMode = !isLockMode;
                        setIsLockMode(newMode);
                        if (!newMode) setLockedCells({});
                    }}
                >
                    <Lock size={16} />
                    {isLockMode ? 'Lock Mode: ON' : 'Lock Mode: OFF'}
                </button>
            </div>
            {grids[selectedSectionView] ? (
                <>
                    <div className="table-glass">
                        <table className="grid-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '110px', textAlign: 'left' }}>DAY</th>
                                    {timeSlots && timeSlots.map((slot, index) => {
                                        if (slot.type === 'break') {
                                            return (
                                                <th key={slot.id} className="divider-col">
                                                    <div className="vertical-label" style={{ height: '40px', opacity: 0.5, fontSize: '0.5rem' }}>
                                                        {slot.label}
                                                    </div>
                                                </th>
                                            );
                                        }
                                        return (
                                            <th key={slot.id}>
                                                {slot.label}
                                                <span style={{ fontSize: '0.65rem', display: 'block', marginTop: '2px', opacity: 0.8 }}>
                                                    {(() => {
                                                        const format = (t) => {
                                                            if (!t) return '';
                                                            const [h, m] = t.split(':');
                                                            const hr = parseInt(h, 10);
                                                            const amp = hr >= 12 ? 'PM' : 'AM';
                                                            const hr12 = hr % 12 || 12;
                                                            return `${hr12}:${m} ${amp}`;
                                                        };
                                                        return `${format(slot.startTime)} - ${format(slot.endTime)}`;
                                                    })()}
                                                </span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map((day, dIdx) => {
                                    let teachingSlotIndex = 0;
                                    return (
                                        <tr key={day}>
                                            <td className="day-label">{day}</td>
                                            {timeSlots && timeSlots.map((slot, sIdx) => {
                                                if (slot.type === 'break') {
                                                    return (
                                                        <td key={`brk-${dIdx}-${sIdx}`} className="divider-col">
                                                            <div className="vertical-label">{slot.label}</div>
                                                        </td>
                                                    );
                                                }
                                                const cell = grids[selectedSectionView][dIdx] ? grids[selectedSectionView][dIdx][teachingSlotIndex] : null;
                                                teachingSlotIndex++;
                                                const isLab = isLabNode(cell);
                                                const isInt = cell && (String(cell.type || '').toUpperCase().includes('INTEGRATED') || String(cell.name || '').toUpperCase().includes('INTEGRATED') || String(cell.name || '').toUpperCase().includes('GRAPHICS'));
                                                const isIntLab = isInt && cell && cell.isLab;
                                                const isNormalLab = isLab && !isInt;
                                                const shouldShowGreen = isNormalLab || isIntLab;
                                                const isActuallyLab = isLab && !isInt;
                                                const showDashed = isActuallyLab && cell && cell.isFixedFromWord;
                                                const currentGridIndex = teachingSlotIndex - 1;
                                                const cellKey = `${selectedSectionView}-${dIdx}-${currentGridIndex}`;
                                                const isUserLocked = lockedCells[cellKey];
                                                return (
                                                    <td key={`${dIdx}-${sIdx}`} className="cell-container">
                                                        <div
                                                            className={`subject-card ${shouldShowGreen ? 'lab-box' : ''} ${showDashed ? 'lab-locked' : ''} ${isUserLocked ? 'user-locked' : ''}`}
                                                            style={isUserLocked ? { border: '2px solid #ef4444' } : {}}
                                                            onClick={() => handleCellClick(dIdx, currentGridIndex, cell)}
                                                        >
                                                            {cell ? (
                                                                <>
                                                                    <div style={{ position: 'absolute', top: '8px', left: '8px', opacity: 0.3 }} title="Edit">
                                                                        <Edit2 size={12} />
                                                                    </div>
                                                                    {cell.isFixedFromWord && <Lock className="lock-icon" size={12} style={{ color: shouldShowGreen ? '#15803d' : '#4f46e5', opacity: 0.6 }} title="Word Locked" />}
                                                                    <div
                                                                        className={shouldShowGreen ? 'lab-code' : 'theory-code'}
                                                                        style={cell.code.includes('/') ? { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', lineHeight: '1.1', padding: '4px 0' } : {}}
                                                                    >
                                                                        {cell.code.includes('/') ? cell.code.split('/').map((c, i) => <div key={i}>{c.trim()}</div>) : cell.code}
                                                                    </div>
                                                                    {isLab && (
                                                                        <div className="lab-subtext" style={isInt ? { color: shouldShowGreen ? '#15803d' : '#6366f1' } : {}}>
                                                                            {isInt ? (shouldShowGreen ? '(INT_LAB)' : '(INT.)') : '(LAB)'}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : <div className="action-icon">+</div>}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Subject Allocation Summary */}
                    <div className="summary-card" style={{ marginTop: '2rem', background: 'white', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 25px rgba(0,0,0,0.02)', animation: 'fadeIn 1s ease-out' }}>
                        <h3 style={{ fontWeight: 900, marginBottom: '1.5rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '24px', background: '#3b82f6', borderRadius: '4px' }}></div>
                            Subject Allocation Summary
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {(() => {
                                const currentGrid = grids[selectedSectionView];
                                const allocationCounts = {};
                                currentGrid.flat().forEach(cell => {
                                    if (cell && cell.code) {
                                        const codes = cell.code.split('/').map(c => c.trim()).filter(Boolean);
                                        const uniqueCodesInSlot = new Set(codes);
                                        uniqueCodesInSlot.forEach(c => {
                                            allocationCounts[c] = (allocationCounts[c] || 0) + 1;
                                        });
                                    }
                                });
                                const summaryGroups = new Map();
                                subjects
                                    .filter(s => s.semester === semester)
                                    .forEach(sub => {
                                        const nameUpper = sub.name.toUpperCase();
                                        const teacher = teachers.find(t => t.subjectCode === sub.code && t.section === selectedSectionView);
                                        const req = (parseInt(sub.credit) || 0) + (parseInt(sub.satCount) || 0);
                                        const isElective = ((sub.type === 'Elective') || nameUpper.includes('ELECTIVE') || /[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*\*?\s*$/i.test(sub.name) || nameUpper.includes('VALUE ADDED')) && !(sub.code && sub.code.includes('GE2731'));
                                        let groupID = sub.code;
                                        if (isElective) {
                                            let match = nameUpper.match(/(OPEN|PROFESSIONAL|FREE|DEPT|DEPARTMENT)?[\s-]*ELECTIVE[\s-–—]*(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)/);
                                            if (!match) {
                                                const romanMatch = nameUpper.trim().match(/[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)$/);
                                                if (romanMatch) {
                                                    match = [null, '', romanMatch[1], romanMatch[2]];
                                                }
                                            }
                                            groupID = match ? `${match[1] || ''}ELECTIVE - ${match[2]}${match[3] || ''}` : `ELECTIVE - ${sub.code}`;
                                            if (nameUpper.includes('VALUE ADDED')) {
                                                groupID = 'VALUE ADDED COURSE';
                                            }
                                        }

                                        if (!summaryGroups.has(groupID)) {
                                            summaryGroups.set(groupID, {
                                                codes: new Set([sub.code.trim()]),
                                                names: new Set([sub.name]),
                                                staff: new Set(teacher ? [teacher.name] : []),
                                                required: req,
                                                allocated: allocationCounts[sub.code.trim()] || 0,
                                                isElective: isElective,
                                                groupID: groupID
                                            });
                                        } else {
                                            const g = summaryGroups.get(groupID);
                                            g.codes.add(sub.code.trim());
                                            g.names.add(sub.name);
                                            if (teacher) g.staff.add(teacher.name);

                                            if (isElective) {
                                                g.required = Math.max(g.required, req);
                                                // For elective groups, allocated is any member's count (they share slots)
                                                g.allocated = Math.max(g.allocated, allocationCounts[sub.code.trim()] || 0);
                                            } else {
                                                // For subject-code groups (like Lec + Lab), sum requirements
                                                g.required += req;
                                                // Allocated should be the total count for this code
                                                // (Since it's the same code for Lec and Lab, allocationCounts[sub.code] already has the total)
                                                g.allocated = allocationCounts[sub.code.trim()] || 0;
                                            }
                                        }
                                    });

                                const summaryListFinal = Array.from(summaryGroups.values());
                                const totalPhysicalTarget = summaryListFinal.reduce((acc, s) => acc + s.required, 0);
                                const totalAvailableSlots = (timeSlots ? timeSlots.filter(s => s.type !== 'break').length : 7) * 6;
                                const totalPhysicalOccupied = currentGrid.flat().filter(cell => cell !== null).length;

                                return (
                                    <>
                                        <div style={{ gridColumn: '1 / -1', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ padding: '0.8rem 1.5rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', color: '#1e40af', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                Total Subjects: <span style={{ fontSize: '1.2rem', marginLeft: '5px' }}>{summaryListFinal.length}</span>
                                            </div>
                                            <div style={{ padding: '0.8rem 1.5rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', color: '#1e40af', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                Physical Slots Filled: <span style={{ fontSize: '1.2rem', marginLeft: '5px' }}>{totalPhysicalOccupied}</span> / {totalAvailableSlots}
                                            </div>
                                            <div style={{ padding: '0.8rem 1.5rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                Slots Needed (Target): <span style={{ fontSize: '1.2rem', marginLeft: '5px' }}>{totalPhysicalTarget}</span>
                                            </div>
                                            {totalPhysicalTarget < totalAvailableSlots && (
                                                <div style={{ padding: '0.8rem 1.5rem', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5', color: '#9a3412', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                    Expected Gaps: <span style={{ fontSize: '1.2rem', marginLeft: '5px' }}>{totalAvailableSlots - totalPhysicalTarget}</span>
                                                </div>
                                            )}
                                            {totalPhysicalTarget > totalAvailableSlots && (
                                                <div style={{ padding: '0.8rem 1.5rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2', color: '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                    Missing Slots: <span style={{ fontSize: '1.2rem', marginLeft: '5px' }}>{totalPhysicalTarget - totalAvailableSlots}</span> (Need more periods per day)
                                                </div>
                                            )}
                                        </div>
                                        {summaryListFinal.map(stat => {
                                            const isMet = stat.allocated >= stat.required;
                                            const difference = stat.allocated - stat.required;
                                            const statusColor = isMet ? '#10b981' : '#f59e0b';
                                            const statusBg = isMet ? '#d1fae5' : '#fef3c7';
                                            const displayCode = Array.from(stat.codes).join(' / ');
                                            const displayNames = Array.from(stat.names);
                                            const displayStaff = Array.from(stat.staff).join(' / ') || 'TBA';

                                            return (
                                                <div key={stat.groupID} style={{
                                                    padding: '1.2rem',
                                                    borderRadius: '16px',
                                                    background: stat.isElective ? 'linear-gradient(135deg, #f8fafc, #eff6ff)' : '#f8fafc',
                                                    border: stat.isElective ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                                    transition: 'transform 0.2s',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    {stat.isElective && (
                                                        <div style={{ position: 'absolute', top: '0', right: '0', background: '#3b82f6', color: 'white', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '0 0 0 8px', fontWeight: '900' }}>ELECTIVE GROUP</div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                                                        <span style={{ fontWeight: 900, color: '#3b82f6', fontSize: displayCode.length > 20 ? '0.8rem' : '1rem' }}>{displayCode}</span>
                                                        <span style={{
                                                            fontWeight: 800,
                                                            color: statusColor,
                                                            background: statusBg,
                                                            padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem',
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                            minWidth: 'fit-content'
                                                        }}>
                                                            {stat.allocated} / {stat.required} Hrs
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700, marginBottom: '0.6rem', lineHeight: '1.4' }}>
                                                        {displayNames.map((name, idx) => (
                                                            <div key={idx} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                                                                {displayNames.length > 1 && <span>•</span>}
                                                                <span>{name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayStaff}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </div >
                    </div>
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '10rem 0', background: 'white', borderRadius: '28px', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ color: '#94a3b8', fontWeight: 900, fontSize: '1.2rem' }}>No Schedule Generated for Section {selectedSectionView}</h3>
                    <p style={{ color: '#cbd5e1', fontWeight: 600, marginTop: '0.5rem' }}>Change the semester or click Generate to start</p>
                </div>
            )}
            {editingCell && (
                <div className="modal-overlay">
                    <div className="modal-box" style={{ borderRadius: '28px', padding: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ fontWeight: 900, margin: 0, fontSize: '1.4rem' }}>Edit Schedule</h3>
                            <button onClick={() => setEditingCell(null)} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', color: '#64748b', padding: '8px', borderRadius: '10px' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem', fontWeight: 700 }}>Updating <b>{DAYS[editingCell.day]}</b> Period <b>{editingCell.slot + 1}</b></p>
                        {(() => {
                            const semSubjects = subjects.filter(s => s.semester === semester);
                            const groups = {};
                            const singles = [];
                            semSubjects.forEach(sub => {
                                const nameUpper = sub.name.toUpperCase();
                                const isElective = ((sub.type === 'Elective') || nameUpper.includes('ELECTIVE')) && !(sub.code && sub.code.includes('GE2731'));
                                let addedToGroup = false;
                                if (isElective) {
                                    const match = nameUpper.match(/(OPEN|PROFESSIONAL|FREE|DEPT|DEPARTMENT)?[\s-]*ELECTIVE[\s-–—]*(VIII|VII|VI|IV|V|I{1,3})\s*(\*?)/);
                                    const key = match ? `${match[1] || ''}ELECTIVE - ${match[2]}${match[3] || ''}` : (sub.type === 'Elective' ? 'GeneralElective' : null);
                                    if (key) {
                                        if (!groups[key]) groups[key] = [];
                                        groups[key].push(sub);
                                        addedToGroup = true;
                                    }
                                }
                                if (!addedToGroup) singles.push(sub);
                            });

                            return (
                                <select
                                    className="input-field"
                                    style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', fontWeight: 800, fontSize: '1rem', outline: 'none', appearance: 'none', background: '#f8fafc' }}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                >
                                    <option value="">Select Subject...</option>
                                    <option value="FREE">-- Free Period --</option>
                                    <optgroup label="Core Subjects">
                                        {singles.map(sub => (
                                            <option key={sub.code} value={sub.code}>
                                                {sub.code} - {sub.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                    {Object.keys(groups).map(gName => (
                                        <optgroup key={gName} label={gName}>
                                            <option value={`GROUP:${gName}`} style={{ fontWeight: 'bold', color: '#2563eb' }}>
                                                Assign Group: {gName}
                                            </option>
                                            {groups[gName].map(sub => (
                                                <option key={sub.code} value={sub.code}>
                                                    {sub.code} - {sub.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            );
                        })()}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '2.5rem' }}>
                            <button className="tab-btn" onClick={() => setEditingCell(null)} style={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>Cancel</button>
                            <button className="tab-btn active" onClick={handleSaveEdit} style={{ padding: '0.6rem 2.5rem' }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
            {/* PRINT OFFICIAL VIEW */}
            <div className="print-container">
                {isPrintingAll 
                    ? Object.keys(schedule || {}).sort().flatMap(semKey => 
                        Object.keys(schedule[semKey] || {}).sort().map(secKey => 
                            renderPrintContent(schedule[semKey][secKey], semKey, secKey, `${semKey}-${secKey}`)
                        )
                    )
                    : grids[selectedSectionView] && renderPrintContent(grids[selectedSectionView], semester, selectedSectionView, '0')
                }
            </div>
        </div>
    );
};
export default Timetable;