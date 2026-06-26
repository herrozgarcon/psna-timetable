import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
const Classes = () => {
    const { classes, addClass, updateClass, deleteClass, teachers } = useData();
    const rooms = [];
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentClass, setCurrentClass] = useState({
        id: null,
        name: '',
        students: '',
        advisor: '',
        room: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const openAddModal = () => {
        setIsEditing(false);
        setCurrentClass({ id: null, name: '', students: '', advisor: '', room: '' });
        setIsModalOpen(true);
    };
    const handleEdit = (cls) => {
        setIsEditing(true);
        setCurrentClass(cls);
        setIsModalOpen(true);
    };
    const handleDelete = (id) => {
        deleteClass(id);
    };
    const handleSaveClass = () => {
        if (isEditing) {
            updateClass(currentClass);
        } else {
            addClass(currentClass);
        }
        setIsModalOpen(false);
    };
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Classes</h1>
                    <p style={{ color: 'var(--text-light)' }}>Manage student groups and sections.</p>
                </div>
                <div className="input-group">
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input type="text" placeholder="Search classes..." className="input-field" style={{ paddingLeft: '36px' }} />
                    </div>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={18} style={{ marginRight: '0.5rem' }} />
                        Add Class
                    </button>
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>No. of Students</th>
                            <th>Class Advisor</th>
                            <th>Home Room</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classes.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                                    No classes found. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            classes.map((cls) => (
                                <tr key={cls.id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{cls.name}</div>
                                    </td>
                                    <td>{cls.students}</td>
                                    <td>{cls.advisor}</td>
                                    <td>{cls.room}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => handleEdit(cls)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn btn-outline" style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(cls.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={isEditing ? "Edit Class" : "Add New Class"}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveClass}>{isEditing ? "Save Changes" : "Add Class"}</button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Class Name</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. CS - Year 1 - Section A"
                            value={currentClass.name}
                            onChange={(e) => setCurrentClass({ ...currentClass, name: e.target.value })}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Number of Students</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            placeholder="e.g. 45"
                            value={currentClass.students}
                            onChange={(e) => setCurrentClass({ ...currentClass, students: e.target.value })}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Class Advisor</label>
                        <select
                            className="form-select"
                            value={currentClass.advisor}
                            onChange={(e) => setCurrentClass({ ...currentClass, advisor: e.target.value })}>
                            <option value="">Select Advisor...</option>
                            {teachers.map(teacher => (
                                <option key={teacher.id} value={teacher.name}>
                                    {teacher.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Home Room</label>
                        <select
                            className="form-select"
                            value={currentClass.room}
                            onChange={(e) => setCurrentClass({ ...currentClass, room: e.target.value })}>
                            <option value="">Select Room...</option>
                            {rooms.map(room => (
                                <option key={room.id} value={room.name}>
                                    {room.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
export default Classes;