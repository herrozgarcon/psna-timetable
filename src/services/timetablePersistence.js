import { supabase } from '../supabase';

export const getCurrentAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Assuming academic year starts around June (month 5)
    if (month < 5) {
        return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
};

export const hasExistingTimetable = async (departmentId, academicYear, semester) => {
    try {
        const { count, error } = await supabase
            .from('general_timetable')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', departmentId)
            .eq('academic_year', academicYear)
            .eq('semester', semester);
            
        if (error) {
            console.error('[Persistence] Error checking existing timetable:', error);
            return false;
        }
        return count > 0;
    } catch (err) {
        console.error('[Persistence] Exception in hasExistingTimetable:', err);
        return false;
    }
};

export const loadGeneralTimetable = async (departmentId, academicYear, semester) => {
    try {
        const { data, error } = await supabase
            .from('general_timetable')
            .select('*')
            .eq('department_id', departmentId)
            .eq('academic_year', academicYear)
            .eq('semester', semester);
            
        if (error) throw error;
        
        const grids = {};
        data.forEach(row => {
            if (!grids[row.section]) {
                grids[row.section] = Array(6).fill(null).map(() => Array(8).fill(null));
            }
            if (grids[row.section][row.day]) {
                let cell = grids[row.section][row.day][row.period];
                if (cell && cell.code === row.course_code) {
                    if (!cell.teacherName.includes(row.faculty_name)) {
                        cell.teacherName += ' / ' + row.faculty_name;
                    }
                } else {
                    grids[row.section][row.day][row.period] = {
                        code: row.course_code,
                        name: row.course_name,
                        teacherName: row.faculty_name,
                        isLab: row.is_lab,
                        duration: 1, 
                        isStart: true,
                        room: row.room_name
                    };
                }
            }
        });
        
        // Re-calculate lab block durations
        Object.keys(grids).forEach(sec => {
            for (let d = 0; d < 5; d++) {
                let p = 0;
                while (p < 8) {
                    const cell = grids[sec][d][p];
                    if (cell && cell.isLab) {
                        let dur = 1;
                        while (p + dur < 8 && grids[sec][d][p + dur] && grids[sec][d][p + dur].code === cell.code) {
                            dur++;
                        }
                        for (let k = 0; k < dur; k++) {
                            grids[sec][d][p + k].duration = dur;
                            grids[sec][d][p + k].isStart = (k === 0);
                        }
                        p += dur;
                    } else {
                        p++;
                    }
                }
            }
        });

        return grids;
    } catch (err) {
        console.error('[Persistence] Error loading general timetable:', err);
        return null;
    }
};

export const loadFacultyTimetable = async (facultyId) => {
    try {
        const { data, error } = await supabase
            .from('general_timetable')
            .select('*')
            .eq('faculty_id', facultyId)
            .order('day', { ascending: true })
            .order('period', { ascending: true });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[Persistence] Error loading faculty timetable:', err);
        return [];
    }
};

export const loadAllFacultyTimetables = async () => {
    try {
        const { data, error } = await supabase
            .from('general_timetable')
            .select('*')
            .not('faculty_id', 'is', null)
            .order('day', { ascending: true })
            .order('period', { ascending: true });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[Persistence] Error loading all faculty timetables:', err);
        return [];
    }
};

export const deleteExistingTimetable = async (departmentId, academicYear, semester) => {
    try {
        const { error: genError } = await supabase
            .from('general_timetable')
            .delete()
            .eq('department_id', departmentId)
            .eq('academic_year', academicYear)
            .eq('semester', semester);

        if (genError) throw genError;

        const { error: facError } = await supabase
            .from('faculty_timetable')
            .delete()
            .eq('department_id', departmentId);

        if (facError) throw facError;

        return true;
    } catch (err) {
        console.error('[Persistence] Error deleting existing timetable:', err);
        throw err;
    }
};

export const saveGeneralTimetable = async (rows) => {
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.from('general_timetable').insert(batch).select();
        console.log("general_timetable insert result data count:", data ? data.length : 0);
        
        if (error) {
            console.log("general_timetable insert result error:", error);
            console.error("========== SUPABASE ERROR ==========");
            console.error(error);
            console.error("Message:", error?.message);
            console.error("Details:", error?.details);
            console.error("Hint:", error?.hint);
            console.error("Code:", error?.code);
            console.error("===================================");
            throw error;
        }
    }
};

export const saveFacultyTimetable = async (rows) => {
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.from('faculty_timetable').insert(batch).select();
        console.log("faculty_timetable insert result data count:", data ? data.length : 0);
        
        if (error) {
            console.log("faculty_timetable insert result error:", error);
            console.error("========== SUPABASE ERROR ==========");
            console.error(error);
            console.error("Message:", error?.message);
            console.error("Details:", error?.details);
            console.error("Hint:", error?.hint);
            console.error("Code:", error?.code);
            console.error("===================================");
            throw error;
        }
    }
};

export const saveTimetable = async ({ departmentId, departmentName, semester, grids, teachers, timeSlots }) => {
    const startTimeMs = Date.now();
    const academicYear = getCurrentAcademicYear();
    const scheduleVersion = crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    console.log(`[Persistence] Starting save process for Dept: ${departmentId}, Sem: ${semester}, Year: ${academicYear}`);

    let totalFacultyFound = 0;
    let facultyGenerated = 0;
    let facultySkipped = 0;

    try {
        await deleteExistingTimetable(departmentId, academicYear, semester);
        console.log(`[Persistence] Deleted existing timetable rows.`);

        const generalRows = [];
        const facultyRows = [];

        const teachingSlots = timeSlots ? timeSlots.filter(s => s.type === 'teaching') : [];

        Object.keys(grids).forEach(section => {
            const sectionGrid = grids[section];
            sectionGrid.forEach((dayRow, dayIdx) => {
                let currentLabCell = null;
                let labDurationLeft = 0;

                dayRow.forEach((cell, periodIdx) => {
                    let activeCell = cell;

                    if (cell && cell.duration > 1) {
                        currentLabCell = cell;
                        labDurationLeft = cell.duration;
                    }

                    if (!activeCell && labDurationLeft > 0) {
                        activeCell = currentLabCell;
                    }

                    if (labDurationLeft > 0) {
                        labDurationLeft--;
                        if (labDurationLeft === 0) {
                            currentLabCell = null;
                        }
                    }

                    if (activeCell && activeCell.teacherName && activeCell.teacherName !== 'TBA') {
                        const teacherNames = activeCell.teacherName.split('/').map(t => t.trim());

                        const slot = teachingSlots.length > periodIdx ? teachingSlots[periodIdx] : null;
                        const startTime = slot ? slot.startTime : null;
                        const endTime = slot ? slot.endTime : null;
                        const isLab = activeCell.isLab || activeCell.duration > 1;

                        teacherNames.forEach(tName => {
                            totalFacultyFound++;
                            const faculty = teachers.find(t => String(t.name).trim().toUpperCase() === tName.toUpperCase());
                            const facultyId = faculty ? faculty.id : tName;

                            console.log(`[Debug] Faculty detected: ${tName} | Subject Code: ${activeCell.code} | Section: ${section} | Day: ${dayIdx} | Period: ${periodIdx} | Faculty ID: ${facultyId} | Faculty Name: ${tName}`);

                            // Validation - verify no undefined fields and UUID is used properly
                            if (!departmentId || !facultyId || dayIdx === undefined || periodIdx === undefined || !scheduleVersion) {
                                console.warn("[Persistence] Skipping invalid row for faculty:", tName, "day:", dayIdx, "period:", periodIdx);
                                facultySkipped++;
                                return;
                            }
                            
                            facultyGenerated++;

                            const generalRowData = {
                                department_id: departmentId,
                                department_name: departmentName,
                                academic_year: academicYear,
                                semester: semester,
                                section: section,
                                day: dayIdx,
                                period: periodIdx,
                                start_time: startTime,
                                end_time: endTime,
                                course_code: activeCell.code || '',
                                course_name: activeCell.name || '',
                                faculty_id: facultyId,
                                faculty_name: tName,
                                room_id: null,
                                room_name: activeCell.room || '',
                                is_lab: isLab,
                                batch: null,
                                generated_at: generatedAt,
                                schedule_version: scheduleVersion
                            };

                            const facultyRowData = {
                                faculty_id: facultyId,
                                faculty_name: tName,
                                department_id: departmentId,
                                department_name: departmentName,
                                day: dayIdx,
                                period: periodIdx,
                                start_time: startTime,
                                end_time: endTime,
                                course_code: activeCell.code || '',
                                course_name: activeCell.name || '',
                                section: section,
                                room_name: activeCell.room || '',
                                is_lab: isLab,
                                batch: null,
                                generated_at: generatedAt,
                                schedule_version: scheduleVersion
                            };

                            generalRows.push(generalRowData);
                            facultyRows.push(facultyRowData);
                        });
                    }
                });
            });
        });

        console.log(`[Persistence] Scheduler returned timetable. Processed grid elements.`);
        console.log(`[Persistence] Total faculty found: ${totalFacultyFound} | Faculty actually generated: ${facultyGenerated} | Faculty skipped: ${facultySkipped}`);
        console.log(`[Persistence] Generated ${generalRows.length} general rows and ${facultyRows.length} faculty rows.`);
        console.log("First General Row:");
        if(generalRows.length > 0) console.log(generalRows[0]);
        console.log("First Faculty Row:");
        if(facultyRows.length > 0) console.log(facultyRows[0]);
        
        await saveGeneralTimetable(generalRows);
        console.log(`[Persistence] Successfully inserted general timetable rows.`);
        
        await saveFacultyTimetable(facultyRows);
        console.log(`[Persistence] Successfully inserted faculty timetable rows.`);

        const executionTime = Date.now() - startTimeMs;
        console.log(`[Persistence] Timetable generation persistence completed in ${executionTime}ms.`);

        return { success: true, scheduleVersion, generalCount: generalRows.length, facultyCount: facultyRows.length };
    } catch (err) {
        console.error("========== SUPABASE ERROR ==========");
        console.error(err);
        console.error("Message:", err?.message);
        console.error("Details:", err?.details);
        console.error("Hint:", err?.hint);
        console.error("Code:", err?.code);

        console.error("===================================");
        return { success: false, error: err };
    }
};
