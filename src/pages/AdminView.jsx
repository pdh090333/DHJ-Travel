import React, { useState, useEffect } from 'react';
import { saveActivities, exportToCSV, parseCSV, generateId, saveTrip, deleteTrip, saveCandidate, deleteCandidate } from '../db';
import { Download, Upload, Plus, Trash2, Save, Trash, MapPin, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Draggable } from '@fullcalendar/interaction';
import CalendarView from './CalendarView';
import './AdminView.css';

export default function AdminView({ dbData, refreshDb, selectedTripId: initialTripId, onUnschedule }) {
    const [selectedTripId, setSelectedTripId] = useState(initialTripId || dbData.trips[0]?.id || '');
    const [selectedTripTitle, setSelectedTripTitle] = useState(
        dbData.trips.find(t => t.id === (initialTripId || dbData.trips[0]?.id))?.title || ''
    );

    const [newCandidate, setNewCandidate] = useState({ title: '', url: '', notes: '', imageUrl: '' });
    const [isDraggingOverWishlist, setIsDraggingOverWishlist] = useState(false);

    // Initialize Draggable for candidates
    useEffect(() => {
        const draggableEl = document.getElementById('external-candidates');
        if (draggableEl) {
            const draggable = new Draggable(draggableEl, {
                itemSelector: '.candidate-item-draggable',
                eventData: function (eventEl) {
                    const data = JSON.parse(eventEl.getAttribute('data-event'));
                    return {
                        title: data.title,
                        create: true,
                        extendedProps: { ...data, isFromCandidate: true }
                    };
                }
            });
            return () => draggable.destroy();
        }
    }, [dbData.candidates]); // Re-init when list changes

    const extractDirectImageUrl = (url) => {
        if (!url) return '';
        if (url.includes('lh3.googleusercontent.com')) return url;
        const encodedMatch = url.match(/!6s(https%3A%2F%2Flh3\.googleusercontent\.com%2F[^!&]+)/);
        if (encodedMatch) return decodeURIComponent(encodedMatch[1]);
        return url;
    };

    // Auto-save title
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

    const handleAddCandidate = async () => {
        if (!newCandidate.title) return;
        const candidate = {
            id: generateId(),
            tripId: selectedTripId,
            ...newCandidate
        };
        await saveCandidate(candidate);
        await refreshDb();
        setNewCandidate({ title: '', url: '', notes: '' });
    };

    const handleDeleteCandidate = async (id) => {
        await deleteCandidate(id);
        await refreshDb();
    };

    const currentCandidates = (dbData.candidates || []).filter(c => c.tripId === selectedTripId);

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

            <div className="admin-content-layout">
                <div className="calendar-integration-wrapper">
                    {selectedTripId ? (
                        <CalendarView
                            dbData={dbData}
                            selectedTripId={selectedTripId}
                            refreshDb={refreshDb}
                            onDragOverWishlist={setIsDraggingOverWishlist}
                            onUnschedule={onUnschedule}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            위에서 여행을 선택하거나 추가해 주세요.
                        </div>
                    )}
                </div>

                <div className={`candidates-sidebar ${isDraggingOverWishlist ? 'is-dragging-over' : ''}`}>
                    <div className="sidebar-header">
                        <MapPin size={18} />
                        <h3>가고 싶은 곳 (Wishlist)</h3>
                    </div>

                    <div className="candidate-add-form">
                        <input
                            type="text"
                            placeholder="장소 이름"
                            value={newCandidate.title}
                            onChange={(e) => setNewCandidate({ ...newCandidate, title: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="구글맵 링크 (선택)"
                            value={newCandidate.url}
                            onChange={(e) => setNewCandidate({ ...newCandidate, url: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="이미지 URL (선택)"
                            value={newCandidate.imageUrl}
                            onChange={(e) => setNewCandidate({ ...newCandidate, imageUrl: extractDirectImageUrl(e.target.value) })}
                        />
                        <textarea
                            placeholder="메모 (선택)"
                            value={newCandidate.notes}
                            onChange={(e) => setNewCandidate({ ...newCandidate, notes: e.target.value })}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleAddCandidate}>
                            <Plus size={16} /> 추가하기
                        </button>
                    </div>

                    <div id="external-candidates" className="candidates-list">
                        {isDraggingOverWishlist && (
                            <div className="drop-placeholder">
                                <Plus size={24} />
                                <span>이곳에 놓으면 후보지로 이동합니다</span>
                            </div>
                        )}
                        <p className="hint">💡 아래 항목을 달력으로 끌어다 놓으세요!</p>
                        {currentCandidates.map(c => (
                            <div
                                key={c.id}
                                className="candidate-item candidate-item-draggable"
                                data-event={JSON.stringify({
                                    ...c,
                                    imageUrl: c.imageUrl || ''
                                })}
                            >
                                {c.imageUrl && (
                                    <div className="candidate-thumbnail">
                                        <img src={c.imageUrl} alt={c.title} />
                                    </div>
                                )}
                                <div className="candidate-info">
                                    <span className="candidate-title">{c.title}</span>
                                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a>}
                                </div>
                                <button className="delete-candidate-btn" onClick={() => handleDeleteCandidate(c.id)}>
                                    <Trash size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
