import React, { useState } from 'react';
import { saveActivities, exportToCSV, parseCSV, generateId } from '../db';
import { Download, Upload, Plus, Trash2, Save } from 'lucide-react';
import './AdminView.css';

export default function AdminView({ dbData, refreshDb }) {
    const [activities, setActivities] = useState([...dbData.activities]);
    const [saving, setSaving] = useState(false);

    const handleFieldChange = (index, field, value) => {
        const updated = [...activities];
        updated[index][field] = value;
        setActivities(updated);
    };

    const handleAdd = () => {
        setActivities([
            ...activities,
            { id: generateId(), tripId: dbData.trips[0]?.id || 'trip-1', date: '', startTime: '', endTime: '', title: '', departure: '', arrival: '', departureUrl: '', arrivalUrl: '', notes: '' }
        ]);
    };

    const handleDelete = (index) => {
        const updated = [...activities];
        updated.splice(index, 1);
        setActivities(updated);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveActivities(activities);
            await refreshDb();
            alert('저장 완료!');
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        exportToCSV(activities);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseCSV(evt.target.result, dbData.trips[0]?.id || 'trip-1');
            setActivities(parsed);
        };
        reader.readAsText(file);
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h2>Data Management (Spreadsheet)</h2>
                <div className="admin-actions">
                    <label className="btn btn-ghost file-upload">
                        <Upload size={16} /> <span className="hidden-mobile">Import CSV</span>
                        <input type="file" accept=".csv" onChange={handleImport} hidden />
                    </label>
                    <button className="btn btn-ghost" onClick={handleExport}>
                        <Download size={16} /> <span className="hidden-mobile">Export CSV</span>
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
                            <th>Date (YYYY-MM-DD)</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Title</th>
                            <th>Departure (출발지)</th>
                            <th>Departure Link</th>
                            <th>Arrival (도착지)</th>
                            <th>Arrival Link</th>
                            <th>Notes</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {activities.map((act, index) => (
                            <tr key={act.id}>
                                <td><input type="text" value={act.date} onChange={(e) => handleFieldChange(index, 'date', e.target.value)} placeholder="2026-05-01" /></td>
                                <td><input type="time" value={act.startTime} onChange={(e) => handleFieldChange(index, 'startTime', e.target.value)} /></td>
                                <td><input type="time" value={act.endTime} onChange={(e) => handleFieldChange(index, 'endTime', e.target.value)} /></td>
                                <td><input type="text" value={act.title} onChange={(e) => handleFieldChange(index, 'title', e.target.value)} placeholder="Event Title" /></td>
                                <td><input type="text" value={act.departure} onChange={(e) => handleFieldChange(index, 'departure', e.target.value)} placeholder="Departure" /></td>
                                <td><input type="text" value={act.departureUrl} onChange={(e) => handleFieldChange(index, 'departureUrl', e.target.value)} placeholder="Google Maps URL" /></td>
                                <td><input type="text" value={act.arrival} onChange={(e) => handleFieldChange(index, 'arrival', e.target.value)} placeholder="Arrival" /></td>
                                <td><input type="text" value={act.arrivalUrl} onChange={(e) => handleFieldChange(index, 'arrivalUrl', e.target.value)} placeholder="Google Maps URL" /></td>
                                <td><input type="text" value={act.notes} onChange={(e) => handleFieldChange(index, 'notes', e.target.value)} placeholder="Extra Info" /></td>
                                <td>
                                    <button className="btn-icon danger" onClick={() => handleDelete(index)} title="Delete Row">
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
