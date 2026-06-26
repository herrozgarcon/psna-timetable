export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const hasIntersection = (code1, code2) => {
    if (!code1 || !code2) return false;
    if (code1 === code2) return true;
    const c1 = String(code1).split('/').map(c => c.trim());
    const c2 = String(code2).split('/').map(c => c.trim());
    return c1.some(c => c2.includes(c));
};
export const isBlockSubject = (subject) => {
    if (!subject) return false;
    const name = String(subject.name || '').toUpperCase();
    const type = String(subject.type || '').toUpperCase();
    const isLabName = name.includes('LAB') || name.includes('PRACTICAL') || name.includes('PROJECT');
    if ((type === 'THEORY' || type === 'LECTURE') && !isLabName) return false;
    return isLabName ||
        type.includes('LAB') ||
        type.includes('PRACTICAL') ||
        name.includes('INTEGRATED') ||
        type.includes('INTEGRATED') ||
        name.includes('GRAPHICS');
};
export const generateClassTimetable = (semester, section, rawSubjects, reservedSlots = {}, syncElectives = {}, relaxed = false, globalLabUsage = {}, slotsCount = 7, globalFacultyLoad = {}, semesterLabSlots = {}) => {
    const SLOTS = slotsCount;
    const grid = Array(6).fill(null).map(() => Array(SLOTS).fill(null));
    const isElective = (s) => ((s.type && s.type.toUpperCase().includes('ELECTIVE')) || (s.name && s.name.toUpperCase().includes('ELECTIVE')) || (s.name && /[-\s–—]+(VIII|VII|VI|IV|V|I{1,3})\s*\*?\s*$/i.test(s.name)) || (s.name && s.name.toUpperCase().includes('VALUE ADDED'))) && !(s.code && s.code.includes('GE2731'));
    const isStrictlyRestrictedFromFirstPeriod = (s) => String(s.name || '').toUpperCase().includes('VALUE ADDED') || String(s.type || '').toUpperCase().includes('VALUE ADDED') || String(s.name || '').toUpperCase().includes('MANDATORY') || String(s.type || '').toUpperCase().includes('MANDATORY');
    const isRestrictedFromFirstPeriod = (s) => isStrictlyRestrictedFromFirstPeriod(s) || String(s.name || '').toUpperCase().includes('SPOKEN TUTORIAL');
    const isAdjacent = (grid, d, s, code) => {
        if (s > 0 && grid[d][s-1] && hasIntersection(grid[d][s-1].code, code)) return true;
        if (s < grid[d].length - 1 && grid[d][s+1] && hasIntersection(grid[d][s+1].code, code)) return true;
        return false;
    };

    const isSlotBlocked = (slotSet, teachers, currentSection) => {
        if (!slotSet) return false;
        if (teachers.some(t => slotSet.has(String(t).trim().toUpperCase()))) return true;
        if (Array.from(slotSet).some(r => typeof r === 'string' && r === `BLOCK_ELECTIVE_${currentSection}`)) return true;
        return false;
    };

    const filteredSubjects = rawSubjects.filter(s => {
        return true;
    });

    const counts = filteredSubjects.map((s, idx) => {
        const wk = parseInt(s.credit) || 0;
        const sat = parseInt(s.satCount) || 0;
        const isLab = isBlockSubject(s);
        return {
            ...s,
            subIdx: idx,
            remWk: wk,
            remSat: sat,
            totalReq: wk + sat,
            labPart: isLab ? (wk + sat) : 0
        };
    });
    counts.forEach(sub => {
        let targets = (sub.fixedSlots && (Array.isArray(sub.fixedSlots) ? sub.fixedSlots : sub.fixedSlots[section] || sub.fixedSlots['_ALL'])) || [];
        const isSubLab = isBlockSubject(sub);
        targets.forEach(slot => {
            const d = slot.d, s = slot.s, duration = slot.duration || 1;
            const isSlotLab = duration > 1;
            if (!isSubLab && isSlotLab) return;
            for (let k = 0; k < duration; k++) {
                if (s + k < SLOTS && d < 6) {
                    const isIntegrated = String(sub.type || '').toUpperCase().includes('INTEGRATED') || String(sub.name || '').toUpperCase().includes('INTEGRATED');
                    const isLab = duration > 1;
                    if (grid[d][s + k]) {
                        const existing = grid[d][s + k];
                        const bothLabs = isLab && (existing.isLab || existing.duration > 1);
                        if (bothLabs) {
                            if (!String(existing.code).includes(sub.code)) {
                                existing.code = `${existing.code} / ${sub.code}`;
                                if (existing.teacherName && sub.teacherName) {
                                    if (!String(existing.teacherName).includes(sub.teacherName)) {
                                        existing.teacherName = `${existing.teacherName} / ${sub.teacherName}`;
                                    }
                                } else if (sub.teacherName) {
                                    existing.teacherName = existing.teacherName ? `${existing.teacherName} / ${sub.teacherName}` : sub.teacherName;
                                }
                                const suffix = (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '');
                                existing.displayCode = existing.code + suffix;
                            }
                        } else {
                            if (!existing.isLab && !existing.duration > 1) {
                                grid[d][s + k] = {
                                    ...sub,
                                    isFixedFromWord: true,
                                    isStart: k === 0,
                                    duration,
                                    isLab: isLab,
                                    displayCode: isLab ? sub.code + (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '') : sub.code
                                };
                            }
                        }
                    } else {
                        grid[d][s + k] = {
                            ...sub,
                            isFixedFromWord: true,
                            isStart: k === 0,
                            duration,
                            isLab: isLab,
                            displayCode: isLab ? sub.code + (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '') : sub.code
                        };
                    }
                    if (d === 5) sub.remSat--; else sub.remWk--;
                    if (isElective(sub)) {
                        if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                        syncElectives[sub.code].push({ d, s: s + k });
                    }
                }
            }
        });
    });
    counts.filter(s => isElective(s)).forEach(sub => {
        if (syncElectives[sub.code] && Array.isArray(syncElectives[sub.code])) {
            syncElectives[sub.code].forEach(slot => {
                const { d, s } = slot;
                const currentSub = counts.find(c => c.code === sub.code);
                if (currentSub && (d === 5 ? currentSub.remSat > 0 : currentSub.remWk > 0)) {
                    if (d < 6 && s < SLOTS && !grid[d][s]) {
                        grid[d][s] = { ...currentSub, duration: 1, isStart: true, isSync: true };
                        if (d === 5) currentSub.remSat--; else currentSub.remWk--;
                    }
                }
            });
        }
    });
    const sectionChar = String(section).replace(/[^A-Za-z]/g, '').toUpperCase();
    const sectionIndex = (sectionChar.charCodeAt(0) || 65) - 65;
    const baseDays = [0, 1, 2, 3, 4];
    const rotatedDays = [...baseDays.slice(sectionIndex % 5), ...baseDays.slice(0, sectionIndex % 5)];
    const preferredFreeDay = (sectionIndex + 2) % 5;
    const dayOrder = rotatedDays.filter(d => d !== preferredFreeDay);
    dayOrder.push(preferredFreeDay);
    const labBlocksToPlace = [];
    counts.filter(isBlockSubject).forEach(lab => {
        const isIntegrated = String(lab.type || '').toUpperCase().includes('INTEGRATED') || String(lab.name || '').toUpperCase().includes('INTEGRATED');
        let blocksFound = 0;
        for (let d = 0; d < 5; d++) {
            if (grid[d].some(c => c && String(c.code).includes(lab.code) && (c.isLab || (c.duration && c.duration >= 2)))) blocksFound++;
        }
        let maxBlocks = isIntegrated ? 1 : 10;
        
        while (lab.remWk >= 2 && blocksFound < maxBlocks) {
            const theoryPart = lab.totalReq - (lab.labPart || 0);
            if (lab.remWk <= theoryPart) break;
            
            let duration = isIntegrated ? (lab.remWk >= 3 ? 3 : 2) : (lab.remWk >= 4 ? 4 : (lab.remWk >= 3 ? 3 : 2));
            if (String(lab.code || '').toUpperCase().includes('GE2C81')) duration = 4;
            if (duration > lab.remWk) duration = lab.remWk;
            if (duration < 2) break;
            
            labBlocksToPlace.push({ lab, duration });
            lab.remWk -= duration;
            blocksFound++;
        }
    });

    let attemptCounter = 0;
    let deepestFail = { blockIdx: -1, candidates: 0, reason: '' };

    const placeLabBlocksRecursive = (blockIdx) => {
        if (blockIdx >= labBlocksToPlace.length) return true;
        attemptCounter++;
        if (attemptCounter > 50000) {
            if (blockIdx > deepestFail.blockIdx) deepestFail = { blockIdx, candidates: 0, reason: 'Max recursive attempts (50000) exceeded for section.' };
            return false;
        }

        const { lab, duration } = labBlocksToPlace[blockIdx];

        const candidates = [];
        const maxPass = relaxed ? 4 : 2;
        let conflictReasons = { faculty: 0, room: 0, duration: 0 };

        for (let pass = 0; pass < maxPass; pass++) {
            for (const d of dayOrder) {
                if (globalLabUsage[`${d}-${lab.code}`]) continue;
                if (grid[d].some(c => c && (c.isLab || isBlockSubject(c)))) continue;
                if (grid[d].some(c => c && c.code === lab.code)) continue;
                
                let validStarts = [1, 4];
                if (pass === 1 || pass === 2) validStarts = [1, 2, 4, 5];
                if (pass >= 3) validStarts = [0, 1, 2, 3, 4, 5];
                if (duration === 4 && pass < 3) validStarts = [1];
                if (duration === 4 && pass >= 3) validStarts = [0, 1];
                validStarts.sort(() => Math.random() - 0.5);
                
                for (let s of validStarts) {
                    if (s + duration > SLOTS) { conflictReasons.duration++; continue; }
                    if (pass === 0 && semesterLabSlots && semesterLabSlots[`${d}-${s}`]) { conflictReasons.room++; continue; }
                    if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has('LAB_START') && pass < 2) { conflictReasons.room++; continue; }
                    if (duration < 4 && s <= 3 && s + duration > 4 && pass < 3) { conflictReasons.duration++; continue; }

                    let free = true;
                    for (let k = 0; k < duration; k++) {
                        const slotKey = `${d}-${s + k}`;
                        if (reservedSlots[slotKey]) {
                            const teachers = lab.allTeachers || (lab.teacherName !== 'TBA' ? String(lab.teacherName).split('/') : []);
                            if (isSlotBlocked(reservedSlots[slotKey], teachers, section)) {
                                free = false;
                                conflictReasons.faculty++;
                                break;
                            }
                        }
                    }
                    if (!free) continue;

                    let displaceable = true;
                    let subjectsToDisplace = [];
                    for (let k = 0; k < duration; k++) {
                        const existing = grid[d][s + k];
                        if (existing) {
                            if (existing.isLab || existing.duration > 1 || existing.isSync || existing.isFixedFromWord) {
                                displaceable = false;
                                break;
                            }
                            if (pass === 0) {
                                displaceable = false;
                                break;
                            }
                            subjectsToDisplace.push({ subject: existing, slot: s + k });
                        }
                    }
                    if (!displaceable) { conflictReasons.room++; continue; }

                    candidates.push({ d, s, pass, subjectsToDisplace });
                }
            }
        }

        if (candidates.length === 0) {
            if (blockIdx > deepestFail.blockIdx) deepestFail = { blockIdx, candidates: 0, reason: `Conflicts: Faculty=${conflictReasons.faculty}, Room=${conflictReasons.room}, Duration=${conflictReasons.duration}` };
            return false;
        }

        candidates.sort(() => Math.random() - 0.5);

        for (const candidate of candidates) {
            const { d, s, subjectsToDisplace } = candidate;
            const oldGridCells = [];
            const isIntegrated = String(lab.type || '').toUpperCase().includes('INTEGRATED') || String(lab.name || '').toUpperCase().includes('INTEGRATED');
            const suffix = isIntegrated ? ' (Int.)' : ' (Lab)';

            for (let k = 0; k < duration; k++) {
                oldGridCells.push({ d, s: s + k, val: grid[d][s + k] });
                grid[d][s + k] = {
                    ...lab,
                    isStart: k === 0,
                    duration,
                    isLab: true,
                    displayCode: lab.code + (k === 0 ? suffix : '')
                };
                if (semesterLabSlots) semesterLabSlots[`${d}-${s + k}`] = true;
            }

            subjectsToDisplace.forEach(item => {
                const isItemLab = item.subject.isLab || item.subject.duration > 1;
                const original = counts.find(c =>
                    (item.subject.subIdx !== undefined ? c.subIdx === item.subject.subIdx : c.code === item.subject.code) &&
                    isBlockSubject(c) === isItemLab
                );
                if (original) {
                    if (d === 5) original.remSat++; else original.remWk++;
                }
            });

            if (placeLabBlocksRecursive(blockIdx + 1)) return true;

            for (let k = 0; k < duration; k++) {
                if (semesterLabSlots) delete semesterLabSlots[`${d}-${s + k}`];
                grid[d][s + k] = oldGridCells[k].val;
            }

            subjectsToDisplace.forEach(item => {
                const isItemLab = item.subject.isLab || item.subject.duration > 1;
                const original = counts.find(c =>
                    (item.subject.subIdx !== undefined ? c.subIdx === item.subject.subIdx : c.code === item.subject.code) &&
                    isBlockSubject(c) === isItemLab
                );
                if (original) {
                    if (d === 5) original.remSat--; else original.remWk--;
                }
            });
        }

        if (blockIdx > deepestFail.blockIdx) deepestFail = { blockIdx, candidates: candidates.length, reason: `All ${candidates.length} candidates exhausted and failed in recursive branches.` };
        return false;
    };

    if (labBlocksToPlace.length > 0) {
        console.log(`[Generator] Starting placeLabBlocksRecursive for ${section}. Total blocks: ${labBlocksToPlace.length}`);
        const success = placeLabBlocksRecursive(0);
        console.log(`[Generator] Finished placeLabBlocksRecursive for ${section}. Success: ${success}`);
        if (!success) {
            const failedBlock = labBlocksToPlace[deepestFail.blockIdx] || labBlocksToPlace[0];
            console.warn(`[Generator] FAILURE DIAGNOSTICS: Semester: ${semester}`);
            if (typeof window !== 'undefined') {
                window.failReason = `Phase 2 (Labs) failed for section ${section}. Lab: ${failedBlock.lab.code} - ${deepestFail.reason}`;
                console.error("[Generator] FAILURE:", window.failReason);
                alert("DEBUG PHASE 2 FAIL: " + window.failReason);
            }
            return null;
        }
    }
    let theoryPoolWk = [];
    let theoryPoolSat = [];
    counts.forEach(sub => {
        const toWk = Math.max(0, sub.remWk);
        const toSat = Math.max(0, sub.remSat);
        for (let i = 0; i < toWk; i++) theoryPoolWk.push({ ...sub, isLab: false });
        for (let i = 0; i < toSat; i++) theoryPoolSat.push({ ...sub, isLab: false });
    });
    const usedSlotsBySubject = {};
    const totalReqByCode = {};
    counts.forEach(s => {
        usedSlotsBySubject[s.code] = new Set();
        totalReqByCode[s.code] = (totalReqByCode[s.code] || 0) + s.totalReq;
    });
    grid.forEach((day, d) => {
        day.forEach((cell, s) => {
            if (cell && cell.code) {
                Object.keys(usedSlotsBySubject).forEach(key => {
                    if (hasIntersection(cell.code, key)) {
                        usedSlotsBySubject[key].add(s);
                    }
                });
            }
        });
    });
    let pool = [...theoryPoolWk];
    pool.sort((a, b) => {
        const aEl = isElective(a);
        const bEl = isElective(b);
        if (!aEl && bEl) return -1;
        if (aEl && !bEl) return 1;
        return 0;
    });
    theoryPoolWk = [];

    const uniqueSubjects = [...new Set(pool.map(s => s.code))];
    uniqueSubjects.forEach(code => {
        const subIdx = pool.findIndex(s => s.code === code);
        if (subIdx === -1) return;
        const sub = pool[subIdx];
        if (isRestrictedFromFirstPeriod(sub)) return;

        const hasFirstPeriod = grid.some(day => day[0] && day[0].code && hasIntersection(day[0].code, sub.code));
        if (hasFirstPeriod) return;

        const dOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        for (const d of dOrder) {
            if (grid[d][0]) continue;
            
            const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
            if (isSlotBlocked(reservedSlots[`${d}-0`], teachers, section)) continue;
            
            grid[d][0] = { ...sub, duration: 1, isStart: true };
            if (usedSlotsBySubject[sub.code]) usedSlotsBySubject[sub.code].add(0);
            if (isElective(sub)) {
                if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                syncElectives[sub.code].push({ d, s: 0 });
            }
            pool.splice(subIdx, 1);
            break;
        }
    });

    const labSlotsArray = Object.keys(semesterLabSlots).map(k => {
        const [d, s] = k.split('-').map(Number);
        return { d, s };
    }).sort(() => Math.random() - 0.5);
    labSlotsArray.forEach(({ d, s }) => {
        if (d >= 5 || s >= SLOTS || grid[d][s]) return;
        const bestIdx = pool.findIndex(sub => {
            if (isElective(sub)) return false;
            if (grid[d].some(c => {
                if (!c || !c.code) return false;
                return hasIntersection(c.code, sub.code);
            })) return false;

            const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
            if (isSlotBlocked(reservedSlots[`${d}-${s}`], teachers, section)) return false;

            return true;
        });
        if (bestIdx > -1) {
            const sub = pool.splice(bestIdx, 1)[0];
            grid[d][s] = { ...sub, duration: 1, isStart: true };
            if (usedSlotsBySubject[sub.code]) usedSlotsBySubject[sub.code].add(s);
        }
    });

    while (pool.length > 0) {
        const sub = pool.shift();
        let placed = false;
        const dOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        const sOrder = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
        const overallTotal = totalReqByCode[sub.code] || 0;
        for (const d of dOrder) {
            const isSubElective = isElective(sub);
            const existingInDay = grid[d].map((c, i) => {
                if (!c || !c.code) return -1;
                const codes = String(c.code).split('/').map(code => code.trim());
                return hasIntersection(c.code, sub.code) ? i : -1;
            }).filter(idx => idx !== -1);
            if (overallTotal <= 6) {
                if (existingInDay.length > 0) continue;
            } else {
                if (existingInDay.length >= 2) continue;
            }
            for (const s of sOrder) {
                if (grid[d][s]) continue;
                if (isSubElective && semesterLabSlots[`${d}-${s}`]) continue;
                if (usedSlotsBySubject[sub.code]?.has(s)) continue;
                if (s === 0 && isRestrictedFromFirstPeriod(sub)) continue;
                if (s === 0 && grid.some(day => day[0] && day[0].code && hasIntersection(day[0].code, sub.code))) continue;
                if (overallTotal > 6 && existingInDay.length === 1) {
                    const firstWasBeforeLunch = existingInDay[0] < 4;
                    const currentIsBeforeLunch = s < 4;
                    if (firstWasBeforeLunch === currentIsBeforeLunch) continue;
                }

                const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
                if (isSlotBlocked(reservedSlots[`${d}-${s}`], teachers, section)) continue;

                grid[d][s] = { ...sub, duration: 1, isStart: true };
                if (usedSlotsBySubject[sub.code]) usedSlotsBySubject[sub.code].add(s);
                if (isSubElective) {
                    if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                    syncElectives[sub.code].push({ d, s });
                }
                placed = true;
                break;
            }
            if (placed) break;
        }
        if (!placed) theoryPoolWk.push(sub);
    }
    let theoryAttempt = 0;
    while (theoryPoolWk.length > 0 && theoryAttempt < 500) {
        theoryAttempt++;
        const sub = theoryPoolWk[0];
        let placed = false;
        const overallTotal = totalReqByCode[sub.code] || 0;
        const dOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        for (const d of dOrder) {
            const existingInDay = grid[d].filter(c => {
                if (!c || !c.code) return false;
                return hasIntersection(c.code, sub.code);
            }).length;
            if (overallTotal <= 6 && existingInDay > 0) continue;
            if (overallTotal > 6 && existingInDay >= 2) continue;
            const sOrder = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const s of sOrder) {
                if (grid[d][s]) continue;
                if (isElective(sub) && semesterLabSlots[`${d}-${s}`]) continue;
                if (s === 0 && isRestrictedFromFirstPeriod(sub)) continue;
                if (s === 0 && grid.some(day => day[0] && day[0].code && hasIntersection(day[0].code, sub.code))) continue;

                const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
                if (isSlotBlocked(reservedSlots[`${d}-${s}`], teachers, section)) continue;

                const shiftedSub = theoryPoolWk.shift();
                grid[d][s] = { ...shiftedSub, duration: 1, isStart: true };
                if (isElective(shiftedSub)) {
                    if (!syncElectives[shiftedSub.code]) syncElectives[shiftedSub.code] = [];
                    syncElectives[shiftedSub.code].push({ d, s });
                }
                placed = true;
                break;
            }
            if (placed) break;
        }
        if (!placed) theoryPoolWk.push(theoryPoolWk.shift());
    }
    if (theoryPoolSat.length > 0) {
        theoryPoolSat.sort(() => Math.random() - 0.5);
        const d = 5;
        const sOrderSat = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
        for (const s of sOrderSat) {
            if (!grid[d][s] && theoryPoolSat.length > 0) {
                let bestIdx = theoryPoolSat.findIndex(sub => {
                    if (grid[d].some(c => c && hasIntersection(c.code, sub.code))) return false;
                    if (s === 0 && isRestrictedFromFirstPeriod(sub)) return false;
                    if (s === 0 && grid.some(day => day[0] && day[0].code && hasIntersection(day[0].code, sub.code))) return false;
                    if (isAdjacent(grid, d, s, sub.code)) return false;
                    return true;
                });
                if (bestIdx === -1) {
                    bestIdx = theoryPoolSat.findIndex(sub => {
                        if (s === 0 && isRestrictedFromFirstPeriod(sub)) return false;
                        if (isAdjacent(grid, d, s, sub.code)) return false;
                        return true;
                    });
                    if (bestIdx === -1) {
                        bestIdx = theoryPoolSat.findIndex(sub => {
                            if (s === 0 && isRestrictedFromFirstPeriod(sub)) return false;
                            return true;
                        });
                        if (bestIdx === -1) {
                            bestIdx = theoryPoolSat.findIndex(sub => {
                                if (s === 0 && isStrictlyRestrictedFromFirstPeriod(sub)) return false;
                                return true;
                            });
                            if (bestIdx === -1) {
                                if (s === 0) continue;
                                bestIdx = 0;
                            }
                        }
                    }
                }
                const sub = theoryPoolSat.splice(bestIdx, 1)[0];
                grid[d][s] = { ...sub, duration: 1, isStart: true };
                if (isElective(sub)) {
                    if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                    syncElectives[sub.code].push({ d, s });
                }
            }
        }
    }
    if (theoryPoolSat.length > 0) {
        theoryPoolWk.push(...theoryPoolSat);
        theoryPoolSat = [];
    }
    if (theoryPoolWk.length > 0) {
        let dayIndices = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        for (const d of dayIndices) {
            const sOrderFallback = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const s of sOrderFallback) {
                if (!grid[d][s] && theoryPoolWk.length > 0) {
                    let bestIdx = theoryPoolWk.findIndex(sub => {
                        if (s === 0 && isRestrictedFromFirstPeriod(sub)) return false;
                        if (s === 0 && grid.some(day => day[0] && day[0].code && hasIntersection(day[0].code, sub.code))) return false;
                        if (isAdjacent(grid, d, s, sub.code)) return false;
                        return true;
                    });
                    if (bestIdx === -1) {
                        bestIdx = theoryPoolWk.findIndex(sub => {
                            if (s === 0 && isRestrictedFromFirstPeriod(sub)) return false;
                            if (isAdjacent(grid, d, s, sub.code)) return false;
                            return true;
                        });
                        if (bestIdx === -1) {
                            bestIdx = theoryPoolWk.findIndex(sub => {
                                if (s === 0 && isRestrictedFromFirstPeriod(sub)) return false;
                                return true;
                            });
                            if (bestIdx === -1) {
                                bestIdx = theoryPoolWk.findIndex(sub => {
                                    if (s === 0 && isStrictlyRestrictedFromFirstPeriod(sub)) return false;
                                    return true;
                                });
                                if (bestIdx === -1) {
                                    if (s === 0) continue;
                                    bestIdx = 0;
                                }
                            }
                        }
                    }
                    const sub = theoryPoolWk.splice(bestIdx, 1)[0];
                    grid[d][s] = { ...sub, duration: 1, isStart: true };
                    if (isElective(sub)) {
                        if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                        syncElectives[sub.code].push({ d, s });
                    }
                }
            }
        }
    }
    // Final Brute-Force Check for Lost Subjects
    let totalPlaced = {};
    grid.forEach(day => day.forEach(cell => {
        if (cell) {
            totalPlaced[cell.code] = (totalPlaced[cell.code] || 0) + 1;
        }
    }));

    let lostSubjects = [];
    counts.forEach(sub => {
        const required = (parseInt(sub.credit) || 0) + (parseInt(sub.satCount) || 0);
        const placed = totalPlaced[sub.code] || 0;
        if (placed < required) {
            for (let i = 0; i < required - placed; i++) {
                lostSubjects.push({ ...sub, isLab: false });
            }
        }
    });

    if (lostSubjects.length > 0) {
        let dayIndices = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
        for (const d of dayIndices) {
            const sOrderFallback = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const s of sOrderFallback) {
                if (!grid[d][s] && lostSubjects.length > 0) {
                    const sub = lostSubjects.splice(0, 1)[0];
                    grid[d][s] = { ...sub, duration: 1, isStart: true };
                }
            }
        }
    }

    return grid;
};