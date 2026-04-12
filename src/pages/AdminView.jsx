import React, { useState } from 'react';
import { saveActivities, exportToCSV, parseCSV, generateId, saveTrip, deleteTrip } from '../db';
import { Download, Upload, Plus, Trash2, Save, Trash } from 'lucide-react';
import './AdminView.css';

export default function AdminView({ dbData, refreshDb, selectedTripId: initialTripId }) {
    const [selectedTripId, setSelectedTripId] = useState(initialTripId || dbData.trips[0]?.id || '');
    const [activities, setActivities] = useState([...dbData.activities]);
    const [saving, setSaving] = useState(false);

    // Update local state when selectedTripId or dbData changes
    const currentTripActivities = activities.filter(a => a.tripId === selectedTripId);

    const handleFieldChange = (index, field, value) => {
        const activityId = currentTripActivities[index].id;
        const updated = activities.map(act =>
            act.id === activityId ? { ...act, [field]: value } : act
        );
        setActivities(updated);
    };

    const handleAdd = () => {
        if (!selectedTripId) {
            alert('먼저 여행을 선택하거나 생성하세요.');
            return;
        }
        setActivities([
            ...activities,
            { id: generateId(), tripId: selectedTripId, date: '', startTime: '', endTime: '', title: '', departure: '', arrival: '', departureUrl: '', arrivalUrl: '', notes: '' }
        ]);
    };

    const handleDelete = (index) => {
        const activityId = currentTripActivities[index].id;
        setActivities(activities.filter(act => act.id !== activityId));
    };

    const handleSave = async () => {
        if (!selectedTripId) return;
        setSaving(true);
        try {
            await saveActivities(selectedTripId, currentTripActivities);
            await refreshDb();
            alert('저장 완료!');
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        exportToCSV(currentTripActivities);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file || !selectedTripId) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseCSV(evt.target.result, selectedTripId);
            // Replace existing activities for this trip with parsed ones
            const otherTripActivities = activities.filter(a => a.tripId !== selectedTripId);
            setActivities([...otherTripActivities, ...parsed]);
        };
        reader.readAsText(file);
    };

    const handleAddNewTrip = async () => {
        const title = prompt('새로운 여행 이름을 입력하세요:', '2025 새로운 여행');
        if (!title) return;
        const newTrip = { id: generateId(), title, startDate: '', endDate: '' };
        await saveTrip(newTrip);
        await refreshDb();
        setSelectedTripId(newTrip.id);
    };

    const handleDeleteTrip = async () => {
        if (!selectedTripId) return;
        if (!confirm('정말로 이 여행과 관련된 모든 일정을 삭제하시겠습니까?')) return;
        await deleteTrip(selectedTripId);
        await refreshDb();
        setSelectedTripId(dbData.trips[0]?.id || '');
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div className="trip-manager">
                    <select
                        value={selectedTripId}
                        onChange={(e) => setSelectedTripId(e.target.value)}
                        className="trip-selector-admin"
                    >
                        {dbData.trips.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                    <button className="btn btn-ghost" onClick={handleAddNewTrip} title="New Trip">
                        <Plus size={16} />
                    </button>
                    <button className="btn btn-ghost danger" onClick={handleDeleteTrip} title="Delete Trip">
                        <Trash size={16} />
                    </button>
                </div>

                <div className="admin-actions">
                    <label className="btn btn-ghost file-upload">
                        <Upload size={16} /> <span className="hidden-mobile">Import</span>
                        <input type="file" accept=".csv" onChange={handleImport} hidden />
                    </label>
                    <button className="btn btn-ghost" onClick={handleExport}>
                        <Download size={16} /> <span className="hidden-mobile">Export</span>
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> <span className="hidden-mobile">{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Title</th>
                            <th>Departure</th>
                            <th>Dep Link</th>
                            <th>Arrival</th>
                            <th>Arr Link</th>
                            <th>Notes</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentTripActivities.map((act, index) => (
                            <tr key={act.id}>
                                <td><input type="text" value={act.date} onChange={(e) => handleFieldChange(index, 'date', e.target.value)} placeholder="YYYY-MM-DD" /></td>
                                <td><input type="time" value={act.startTime} onChange={(e) => handleFieldChange(index, 'startTime', e.target.value)} /></td>
                                <td><input type="time" value={act.endTime} onChange={(e) => handleFieldChange(index, 'endTime', e.target.value)} /></td>
                                <td><input type="text" value={act.title} onChange={(e) => handleFieldChange(index, 'title', e.target.value)} /></td>
                                <td><input type="text" value={act.departure} onChange={(e) => handleFieldChange(index, 'departure', e.target.value)} /></td>
                                <td><input type="text" value={act.departureUrl} onChange={(e) => handleFieldChange(index, 'departureUrl', e.target.value)} /></td>
                                <td><input type="text" value={act.arrival} onChange={(e) => handleFieldChange(index, 'arrival', e.target.value)} /></td>
                                <td><input type="text" value={act.arrivalUrl} onChange={(e) => handleFieldChange(index, 'arrivalUrl', e.target.value)} /></td>
                                <td><input type="text" value={act.notes} onChange={(e) => handleFieldChange(index, 'notes', e.target.value)} /></td>
                                <td>
                                    <button className="btn-icon danger" onClick={() => handleDelete(index)}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button className="btn btn-ghost add-row-btn" onClick={handleAdd}>
                <Plus size={16} /> Add New Row
            </button>
        </div>
    );
}
