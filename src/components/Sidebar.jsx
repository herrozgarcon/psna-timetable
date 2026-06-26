import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, BookOpen, Layers, FileSpreadsheet, FileText, Clock, Home, Lock, ClipboardList } from 'lucide-react';
import './Layout.css';
const Sidebar = ({ userRole }) => {
    const location = useLocation();
    const navItems = userRole === 'faculty'
        ? [
            { path: '/', icon: LayoutDashboard, label: 'My Timetable' }
        ]
        : [
            { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
            { path: '/timetable', icon: Calendar, label: 'Timetable' },
            { path: '/staff-timetable', icon: ClipboardList, label: 'Staff Timetable' },
            { path: '/allocations', icon: Layers, label: 'Allocations' },
            { path: '/time-slots', icon: Clock, label: 'Time Slots' },
            { path: '/rooms', icon: Home, label: 'Rooms' },
            { path: '/teachers', icon: Users, label: 'Teachers' },
            { path: '/subjects', icon: BookOpen, label: 'Subjects' },
            { path: '/excel-preview', icon: FileSpreadsheet, label: 'Excel Preview' },
            { path: '/word-preview', icon: FileText, label: 'Word Preview' },
            { path: '/admins', icon: Users, label: 'Manage Admins' },
            { path: '/faculty-permissions', icon: Lock, label: 'Permissions' },
        ];
    return (
        <aside className="app-sidebar">

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
};
export default Sidebar;