import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
const Rooms = () => {
    const [rooms, setRooms] = useState([]);
    
    const addRooms = (newRooms) => {
        setRooms(prev => [...prev, ...newRooms]);
    };
    
    const deleteRoom = (id) => {
        setRooms(prev => prev.filter(r => r.id !== id));
    };
    
    const updateRoom = (updated) => {
        setRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
    };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRoom, setCurrentRoom] = useState({
        id: null,
        name: '',
        capacity: '',
        type: 'Lecture Hall',
        building: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const openAddModal = () => {
        setIsEditing(false);
        setCurrentRoom({ id: null, name: '', capacity: '', type: 'Lecture Hall', building: '' });
        setIsModalOpen(true);
    };
    const handleEdit = (room) => {
        setIsEditing(true);
        setCurrentRoom(room);
        setIsModalOpen(true);
    };
    const handleDelete = (id) => {
        if (window.confirm("Delete this room?")) {
            deleteRoom(id);
        }
    };
    const handleSaveRoom = () => {
        if (isEditing) {
            updateRoom(currentRoom);
        } else {
            addRooms([{ ...currentRoom, id: Date.now() }]);
        }
        setIsModalOpen(false);
    };
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Rooms</h1>
                    <p style={{ color: 'var(--text-light)' }}>Manage classrooms, labs, and other facilities.</p>
                </div>
                <div className="input-group">
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input type="text" placeholder="Search rooms..." className="input-field" style={{ paddingLeft: '36px' }} />
                    </div>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={18} style={{ marginRight: '0.5rem' }} />
                        Add Room
                    </button>
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Room Name</th>
                            <th>Type</th>
                            <th>Capacity</th>
                            <th>Building</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                                    No rooms found. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            rooms.map((room) => (
                                <tr key={room.id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{room.name}</div>
                                    </td>
                                    <td>
                                        <span className="badge badge-info">{room.type}</span>
                                    </td>
                                    <td>{room.capacity} students</td>
                                    <td>{room.building}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => handleEdit(room)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn btn-outline" style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(room.id)}>
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
                title={isEditing ? "Edit Room" : "Add New Room"}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveRoom}>{isEditing ? "Save Changes" : "Add Room"}</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Room Name</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. Lecture Hall 101"
                            value={currentRoom.name}
                            onChange={(e) => setCurrentRoom({ ...currentRoom, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Room Type</label>
                        <select
                            className="form-select"
                            value={currentRoom.type}
                            onChange={(e) => setCurrentRoom({ ...currentRoom, type: e.target.value })}
                        >
                            <option value="Lecture Hall">Lecture Hall</option>
                            <option value="Computer Lab">Computer Lab</option>
                            <option value="Science Lab">Science Lab</option>
                            <option value="Seminar Room">Seminar Room</option>
                            <option value="Hall">Hall</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Capacity (Students)</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            placeholder="e.g. 60"
                            value={currentRoom.capacity}
                            onChange={(e) => setCurrentRoom({ ...currentRoom, capacity: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Building / Block</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. Block A"
                            value={currentRoom.building}
                            onChange={(e) => setCurrentRoom({ ...currentRoom, building: e.target.value })}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};
export default Rooms;