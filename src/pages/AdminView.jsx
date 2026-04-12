import React, { useState, useEffect } from 'react';
import { saveActivities, exportToCSV, parseCSV, generateId, saveTrip, deleteTrip } from '../db';
import { Download, Upload, Plus, Trash2, Save, Trash } from 'lucide-react';
import CalendarView from './CalendarView';
import './AdminView.css';

export default function AdminView({ dbData, refreshDb, selectedTripId: initialTripId }) {
    const [selectedTripId, setSelectedTripId] = useState(initialTripId || dbData.trips[0]?.id || '');
    const [selectedTripTitle, setSelectedTripTitle] = useState(
        dbData.trips.find(t => t.id === (initialTripId || dbData.trips[0]?.id))?.title || ''
    );

    // Auto-save title if it is blurred (debounced/event-driven)
    useEffect(() => {
        const timeout = setTimeout(() => {
            const currentTrip = dbData.trips.find(t => t.id === selectedTripId);
            if (currentTrip && currentTrip.title !== selectedTripTitle) {
                saveTrip({ ...currentTrip, title: selectedTripTitle }).then(() => refreshDb());
            }
        }, 800);
        return () => clearTimeout(timeout);
    }, [selectedTripTitle, selectedTripId, dbData.trips, refreshDb]);

    const handleTripSelect = (id) => {
        setSelectedTripId(id);
        const trip = dbData.trips.find(t => t.id === id);
        setSelectedTripTitle(trip?.title || '');
    };

    const handleExport = () => {
        const activitiesToExport = dbData.activities.filter(a => a.tripId === selectedTripId);
        if (activitiesToExport.length === 0) {
            alert("내보낼 일정이 없습니다.");
            return;
        }
        exportToCSV(activitiesToExport);
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedTripId) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const parsed = parseCSV(evt.target.result, selectedTripId);
                // The newly parsed CSV replaces only the activities for the current trip.
                const otherTripActivities = dbData.activities.filter(a => a.tripId !== selectedTripId);
                await saveActivities(selectedTripId, [...otherTripActivities, ...parsed]);
                await refreshDb();
                alert('일정을 성공적으로 불러왔습니다!');
            } catch (err) {
                alert('CSV 불러오기 실패: 올바른 형식인지 확인하세요.');
            }
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
        setSelectedTripTitle(title);
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
                        onChange={(e) => handleTripSelect(e.target.value)}
                        className="trip-selector-admin"
                    >
                        {dbData.trips.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={selectedTripTitle}
                        onChange={(e) => setSelectedTripTitle(e.target.value)}
                        placeholder="여행 이름 수정"
                        className="trip-title-input"
                    />
                    <button className="btn btn-ghost" onClick={handleAddNewTrip} title="New Trip">
                        <Plus size={16} />
                    </button>
                    <button className="btn btn-ghost danger" onClick={handleDeleteTrip} title="Delete Trip">
                        <Trash size={16} />
                    </button>
                </div>

                <div className="admin-actions">
                    <label className="btn btn-ghost file-upload">
                        <Upload size={16} /> <span className="hidden-mobile">CSV 덮어쓰기</span>
                        <input type="file" accept=".csv" onChange={handleImport} hidden />
                    </label>
                    <button className="btn btn-ghost" onClick={handleExport}>
                        <Download size={16} /> <span className="hidden-mobile">CSV 내보내기</span>
                    </button>
                </div>
            </div>

            <div className="calendar-integration-wrapper" style={{ flex: 1, marginTop: '1rem', minHeight: 0 }}>
                {selectedTripId ? (
                    <CalendarView dbData={dbData} selectedTripId={selectedTripId} refreshDb={refreshDb} />
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        위에서 여행을 선택하거나 추가해 주세요.
                    </div>
                )}
            </div>
        </div>
    );
}
