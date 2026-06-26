import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import bcrypt from 'bcryptjs';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    // Local state (optimistic UI)
    const [teachers, _setTeachers] = useState([]);
    const [subjects, _setSubjects] = useState([]);
    const [schedule, _setSchedule] = useState({});
    const [facultyAccounts, _setFacultyAccounts] = useState([]);
    const [adminAccounts, _setAdminAccounts] = useState([]);
    const [timeSlots, _setTimeSlots] = useState([]);
    const [preemptiveConstraints, _setPreemptiveConstraints] = useState({});
        const [department, _setDepartment] = useState('General');
    const [loading, setLoading] = useState(true);
    const sanitizeSubject = (sub) => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        semester: sub.semester,
        credit: sub.credit,
        satCount: sub.satCount || 0,
        type: sub.type
    });

    // Initial Data Fetch
    useEffect(() => {
        console.log("[DataContext] Initializing fetch useEffect");
        const fetchData = async () => {
            console.log("[DataContext] fetchData started on mount");
            setLoading(true);
            try {
                // Fetch basic tables
                const { data: tData, error: tError } = await supabase.from('teachers').select('*');
                if (tError) console.error("Error fetching teachers:", tError);
                if (tData) { console.log("[DataContext] Setting teachers:", tData.length); _setTeachers(tData); }

                const { data: sData, error: sError } = await supabase.from('subjects').select('*');
                if (sError) console.error("Error fetching subjects:", sError);
                if (sData) { console.log("[DataContext] Setting subjects:", sData.length); _setSubjects(sData); }

                const { data: fData, error: fError } = await supabase.from('faculty_accounts').select('*');
                if (fError) console.error("Error fetching faculty_accounts:", fError);
                if (fData) { console.log("[DataContext] Setting faculty_accounts:", fData.length); _setFacultyAccounts(fData); }

                const { data: aData, error: aError } = await supabase.from('admins').select('*');
                if (aError) console.error("Error fetching admins:", aError);
                if (aData) { console.log("[DataContext] Setting admin_accounts:", aData.length); _setAdminAccounts(aData); }

                
                // Fetch App Settings (JSON Blobs)
                const { data: settings, error: setError } = await supabase.from('app_settings').select('*');
                if (setError) console.error("Error fetching settings:", setError);
                const settingsMap = (settings || []).reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

                if (settingsMap.time_slots) _setTimeSlots(settingsMap.time_slots);
                else {
                    // Default Time Slots
                    _setTimeSlots([
                        { id: 'p1', startTime: '08:45', endTime: '09:40', label: 'P1', type: 'teaching' },
                        { id: 'p2', startTime: '09:40', endTime: '10:35', label: 'P2', type: 'teaching' },
                        { id: 'b1', startTime: '10:35', endTime: '10:55', label: 'BREAK', type: 'break' },
                        { id: 'p3', startTime: '10:55', endTime: '11:45', label: 'P3', type: 'teaching' },
                        { id: 'p4', startTime: '11:45', endTime: '12:35', label: 'P4', type: 'teaching' },
                        { id: 'l1', startTime: '12:35', endTime: '01:45', label: 'LUNCH', type: 'break' },
                        { id: 'p5', startTime: '01:45', endTime: '02:35', label: 'P5', type: 'teaching' },
                        { id: 'p6', startTime: '02:35', endTime: '03:25', label: 'P6', type: 'teaching' },
                        { id: 'p7', startTime: '03:25', endTime: '04:15', label: 'P7', type: 'teaching' },
                        { id: 'p8', startTime: '04:15', endTime: '05:00', label: 'P8', type: 'teaching' }
                    ]);
                }

                if (settingsMap.constraints) _setPreemptiveConstraints(settingsMap.constraints);
                if (settingsMap.department) _setDepartment(settingsMap.department);

                // Reconstruct React schedule state from general_timetable
                const { data: gtData, error: gtError } = await supabase.from('general_timetable').select('*');
                console.log("[DataContext] GT data length:", gtData ? gtData.length : 0);
                if (gtError) {
                    console.error("Error fetching general_timetable for reconstruction:", gtError);
                } else {
                    const reconstructedSchedule = {};
                    (gtData || []).forEach(row => {
                        const sem = row.semester;
                        const sec = row.section;
                        if (!reconstructedSchedule[sem]) reconstructedSchedule[sem] = {};
                        if (!reconstructedSchedule[sem][sec]) {
                            reconstructedSchedule[sem][sec] = Array(6).fill(null).map(() => Array(8).fill(null));
                        }
                        
                        let cell = reconstructedSchedule[sem][sec][row.day][row.period];
                        if (cell && cell.code === row.course_code) {
                            if (!cell.teacherName.includes(row.faculty_name)) {
                                cell.teacherName += ' / ' + row.faculty_name;
                            }
                        } else {
                            reconstructedSchedule[sem][sec][row.day][row.period] = {
                                code: row.course_code,
                                name: row.course_name,
                                teacherName: row.faculty_name,
                                isLab: row.is_lab,
                                duration: 1, 
                                isStart: true,
                                room: row.room_name
                            };
                        }
                    });
                    
                console.log("Loaded teachers count:", tData ? tData.length : 0);
                console.log("Loaded subjects count:", sData ? sData.length : 0);
                console.log("Loaded schedules count:", Object.keys(reconstructedSchedule).length);
                console.log("Loaded general timetable rows:", gtData ? gtData.length : 0);
                
                // Fetch faculty_timetable just for logs if needed, but not necessarily state
                const { data: ftData } = await supabase.from('faculty_timetable').select('id');
                console.log("Loaded faculty timetable rows:", ftData ? ftData.length : 0);

                    _setSchedule(reconstructedSchedule);
                    console.log("[Task 7 Log] Timetable restored from database.");
                }

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- Teachers ---
    const addTeachers = async (newTeachers) => {
        _setTeachers(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = newTeachers.filter(t => !existingIds.has(t.id));
            return [...prev, ...uniqueNew];
        });

        const safeData = newTeachers.map(t => JSON.parse(JSON.stringify(t)));
        const { error } = await supabase.from('teachers').upsert(safeData);
        if (error) console.error("Error adding teachers:", error);
    };

    const deleteTeachers = async (id) => {
        const teacherToDelete = teachers.find(t => t.id === id);
        _setTeachers(prev => prev.filter(t => t.id !== id));
        const { error } = await supabase.from('teachers').delete().eq('id', id);

        if (teacherToDelete) {
            _setFacultyAccounts(prev => prev.filter(a => a.name !== teacherToDelete.name));
            await supabase.from('faculty_accounts').delete().eq('name', teacherToDelete.name);
        }
        if (error) console.error("Error deleting teacher:", error);
    };

    const clearTeachers = async () => {
        _setTeachers([]);
        _setFacultyAccounts([]);
        await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('faculty_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    };

    const setTeachers = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(teachers) : newVal;
        _setTeachers(resolved);
        await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (resolved.length > 0) {
            const safeData = resolved.map(t => JSON.parse(JSON.stringify(t)));
            await supabase.from('teachers').insert(safeData);
        }
    };

    // --- Subjects ---
    const addSubjects = async (newSubjects) => {
        // Optimistic UI Update
        _setSubjects(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = newSubjects.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
        });

        if (newSubjects.length === 0) return;

        try {
            // 1. Try passing everything (including satCount)
            // JSON.parse/stringify strips undefineds which Supabase hates
            console.log("Subjects sent to Supabase:", newSubjects.length);
            const safeData = newSubjects.map(sanitizeSubject);
            if (safeData.length > 0) console.log("Sanitized subject object:", safeData[0], "No fixedSlots sent:", !safeData[0].hasOwnProperty('fixedSlots'));

            const { data, error } = await supabase.from('subjects').upsert(safeData).select();

            if (error) {
                console.error("SUPABASE ERROR (Full Insert):", error);

                // 2. Fallback: If 'satCount' column is missing, strip it and try again
                if (error.code === '42703' || error.message.includes('column')) {
                    console.warn("Retrying with essential columns only...");
                    const essentialData = newSubjects.map(s => ({
                        id: s.id,
                        code: s.code,
                        name: s.name,
                        semester: s.semester,
                        credit: s.credit,
                        type: s.type
                    }));
                    const { data: fallbackData, error: fallbackError } = await supabase.from('subjects').upsert(essentialData).select();
                    if (fallbackError) {
                        console.error("SUPABASE CRITICAL ERROR (Fallback Failed):", fallbackError);
                        alert("Failed to save subjects to database. Check console for details.");
                        return { error: fallbackError };
                    } else {
                        console.log("Fallback insert successful (satCount was ignored).");
                        return fallbackData;
                    }
                } else {
                    alert(`Database Error: ${error.message}`);
                    return { error };
                }
            } else {
                console.log("Subjects saved successfully to Supabase!");
                return data;
            }
        } catch (err) {
            console.error("UNEXPECTED ERROR:", err);
            return { error: err };
        }
    };

    const deleteSubjects = async (id) => {
        _setSubjects(prev => prev.filter(s => s.id !== id));
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) console.error("Error deleting subject:", error);
    };

    const clearSubjects = async () => {
        _setSubjects([]);
        await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    };

    const setSubjects = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(subjects) : newVal;
        _setSubjects(resolved);
        const { error: deleteError } = await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) console.error("Error deleting old subjects:", deleteError);

        if (resolved.length > 0) {
            console.log("Subjects sent to Supabase:", resolved.length);
            const safeData = resolved.map(sanitizeSubject);
            if (safeData.length > 0) console.log("Sanitized subject object:", safeData[0], "No fixedSlots sent:", !safeData[0].hasOwnProperty('fixedSlots'));
            const { error: insertError } = await supabase.from('subjects').insert(safeData);
            if (insertError) console.error("Error inserting subjects:", insertError);
        }
    };

    const updateSubjects = setSubjects;

    // --- Schedules ---
    const updateSchedule = async (semester, newSchedule) => {
        _setSchedule(prev => ({ ...prev, [semester]: newSchedule }));
        const { error } = await supabase.from('schedules').upsert({
            semester,
            data: newSchedule,
            updated_at: new Date()
        });
        if (error) console.error("Error updating schedule:", error);
    };

    const clearSchedules = async () => {
        _setSchedule({});
        await supabase.from('schedules').delete().neq('semester', 'invalid_value');
    };

    // --- Faculty Accounts ---
    const addFacultyAccounts = async (newAccounts) => {
        const hashedAccounts = newAccounts.map(acc => ({
            ...acc,
            password: (acc.password && !acc.password.toString().startsWith('$2'))
                ? bcrypt.hashSync(acc.password, 10)
                : acc.password
        }));

        _setFacultyAccounts(prev => {
            const accountMap = new Map(prev.map(a => [a.email, a]));
            hashedAccounts.forEach(acc => accountMap.set(acc.email, acc));
            return Array.from(accountMap.values());
        });

        const safeData = hashedAccounts.map(a => JSON.parse(JSON.stringify(a)));
        await supabase.from('faculty_accounts').upsert(safeData);
    };

    const deleteFacultyAccount = async (id) => {
        _setFacultyAccounts(prev => prev.filter(a => a.id !== id));
        await supabase.from('faculty_accounts').delete().eq('id', id);
    };

    const updateFacultyPermission = async (id, canGenerate) => {
        _setFacultyAccounts(prev => prev.map(a => a.id === id ? { ...a, can_generate: canGenerate } : a));
        await supabase.from('faculty_accounts').update({ can_generate: canGenerate }).eq('id', id);
    };

    const updateFacultyPassword = async (id, newPassword) => {
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        _setFacultyAccounts(prev => prev.map(a => a.id === id ? { ...a, password: hashedPassword } : a));
        const { error } = await supabase.from('faculty_accounts').update({ password: hashedPassword }).eq('id', id);
        return error;
    };
    const clearFacultyAccounts = async () => {
        _setFacultyAccounts([]);
        await supabase.from('faculty_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    };
    const setFacultyAccounts = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(facultyAccounts) : newVal;
        const hashedResolved = resolved.map(acc => ({
            ...acc,
            password: (acc.password && !acc.password.toString().startsWith('$2'))
                ? bcrypt.hashSync(acc.password, 10)
                : acc.password
        }));
        _setFacultyAccounts(hashedResolved);
        await supabase.from('faculty_accounts').delete().neq('id', '0');
        if (hashedResolved.length > 0) {
            const safe = hashedResolved.map(x => JSON.parse(JSON.stringify(x)));
            await supabase.from('faculty_accounts').insert(safe);
        }
    };

    // --- Admin Accounts ---
    const addAdminAccount = async (newAdmin) => {
        const hashedAdmin = {
            ...newAdmin,
            password: (newAdmin.password && !newAdmin.password.toString().startsWith('$2'))
                ? bcrypt.hashSync(newAdmin.password, 10)
                : newAdmin.password
        };
        const { data, error } = await supabase.from('admins').insert(hashedAdmin).select().single();
        if (data) _setAdminAccounts(prev => [...prev, data]);
        if (error) console.error("Error adding admin:", error);
    };

    const deleteAdminAccount = async (id) => {
        _setAdminAccounts(prev => prev.filter(a => a.id !== id));
        await supabase.from('admins').delete().eq('id', id);
    };

    // --- Reset All ---
    const clearAllData = async () => {
        console.log("Starting Reset All Data...");

        const deletions = [
            { table: 'general_timetable', col: 'department_id', val: 'invalid_value' },
            { table: 'faculty_timetable', col: 'faculty_id', val: 'invalid_value' },
            { table: 'schedules', col: 'semester', val: 'invalid_value' },
            { table: 'teachers', col: 'id', val: '00000000-0000-0000-0000-000000000000' },
            { table: 'subjects', col: 'id', val: '00000000-0000-0000-0000-000000000000' },
            { table: 'faculty_accounts', col: 'id', val: '00000000-0000-0000-0000-000000000000' },
            { table: 'faculty_availability', col: 'faculty_id', val: 'invalid_value' },
            { table: 'preemptive_constraints', col: 'id', val: '00000000-0000-0000-0000-000000000000' }
        ];

        for (const del of deletions) {
            console.log(`Clearing ${del.table}...`);
            const { error } = await supabase.from(del.table).delete().neq(del.col, del.val);
            if (error) {
                console.error(`========== SUPABASE ERROR FOR TABLE ${del.table} ==========`);
                console.error(error);
            } else {
                console.log(`${del.table} cleared.`);
            }
        }
        
        // Also clear from app_settings for constraints
        console.log(`Clearing preemptive_constraints from app_settings...`);
        const { error: appSettingsError } = await supabase.from('app_settings').delete().eq('key', 'constraints');
        if (appSettingsError) {
             console.error(`========== SUPABASE ERROR FOR app_settings ==========`);
             console.error(appSettingsError);
        } else {
             console.log(`preemptive_constraints cleared from app_settings.`);
        }

        // Clear local state
        _setTeachers([]);
        _setSubjects([]);
        _setSchedule({});
        _setFacultyAccounts([]);
        _setPreemptiveConstraints({});
        console.log("[Task 7 Log] Reset completed.");
    };

    // --- Settings ---
    const setTimeSlots = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(timeSlots) : newVal;
        _setTimeSlots(resolved);
        await supabase.from('app_settings').upsert({ key: 'time_slots', value: resolved });
    };

    const setPreemptiveConstraints = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(preemptiveConstraints) : newVal;
        _setPreemptiveConstraints(resolved);
        await supabase.from('app_settings').upsert({ key: 'constraints', value: resolved });
    };

    const clearPreemptiveConstraints = async () => {
        _setPreemptiveConstraints({});
        await supabase.from('app_settings').delete().eq('key', 'constraints');
    };

    const setDepartment = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(department) : newVal;
        _setDepartment(resolved);
        await supabase.from('app_settings').upsert({ key: 'department', value: resolved });
    };
    return (
        <DataContext.Provider value={{
            teachers, subjects, schedule, facultyAccounts, adminAccounts, timeSlots,
            preemptiveConstraints, department, loading, clearAllData,
            addTeachers, deleteTeachers, clearTeachers, setTeachers,
            addSubjects, updateSubjects, deleteSubjects, clearSubjects, setSubjects,
            updateSchedule, clearSchedules,
            addFacultyAccounts, deleteFacultyAccount, updateFacultyPermission, updateFacultyPassword, clearFacultyAccounts, setFacultyAccounts,
            addAdminAccount, deleteAdminAccount,
                        setTimeSlots, setPreemptiveConstraints, clearPreemptiveConstraints, setDepartment
        }}>
            {children}
        </DataContext.Provider>
    );
};