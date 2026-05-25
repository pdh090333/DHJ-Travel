import React, { useState } from 'react';
import { Plus, Trash2, ListChecks, Plane, Calendar, ChevronRight, ChevronsLeft } from 'lucide-react';
import { saveChecklistItem, deleteChecklistItem, generateId } from '../db';
import './ChecklistView.css';

export default function ChecklistView({ dbData, selectedTripId, refreshDb, onSelectTrip }) {
    const currentTrip = dbData.trips.find(t => t.id === selectedTripId);
    const items = dbData.checklists
        .filter(c => c.tripId === selectedTripId)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const handleAdd = async () => {
        const title = draft.trim();
        if (!title || busy) return;
        const newItem = {
            id: generateId(),
            tripId: selectedTripId,
            title,
            completed: false,
            createdAt: Date.now()
        };
        setBusy(true);
        try {
            await saveChecklistItem(newItem);
            setDraft('');
            await refreshDb();
        } catch (e) {
            alert('항목 추가 실패: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleToggle = async (item) => {
        try {
            await saveChecklistItem({ ...item, completed: !item.completed });
            await refreshDb();
        } catch (e) {
            alert('상태 변경 실패: ' + e.message);
        }
    };

    const handleDelete = async (itemId) => {
        try {
            await deleteChecklistItem(itemId);
            await refreshDb();
        } catch (e) {
            alert('항목 삭제 실패: ' + e.message);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    // selectedTripId 없으면 — 여행 선택 화면을 체크리스트 페이지 안에서 직접 노출.
    // App.jsx에서 onSelectTrip = setSelectedTripId 로 raw setter를 받아 현재 view('checklist') 유지.
    if (!selectedTripId) {
        return (
            <div className="checklist-page">
                <div className="checklist-intro">
                    <div className="checklist-title-row">
                        <ListChecks size={22} color="var(--primary)" />
                        <h2 className="checklist-title">체크리스트</h2>
                    </div>
                    <p className="checklist-intro-desc">
                        체크리스트를 볼 여행을 선택하세요.
                    </p>
                </div>

                {dbData.trips.length === 0 ? (
                    <div className="checklist-empty">
                        먼저 여행을 만들어주세요. 상단 로고를 눌러 메인으로 이동 → "새로운 여행 추가".
                    </div>
                ) : (
                    <div className="trip-grid">
                        {dbData.trips.map(trip => {
                            const tripItemCount = dbData.checklists.filter(c => c.tripId === trip.id).length;
                            const tripDoneCount = dbData.checklists.filter(c => c.tripId === trip.id && c.completed).length;
                            return (
                                <div key={trip.id} className="trip-card" onClick={() => onSelectTrip(trip.id)}>
                                    <div className="trip-card-icon">
                                        <Plane size={32} />
                                    </div>
                                    <div className="trip-card-content">
                                        <h3>{trip.title}</h3>
                                        <div className="trip-card-date">
                                            <Calendar size={14} />
                                            <span>{trip.startDate || '날짜 미정'} - {trip.endDate || '날짜 미정'}</span>
                                        </div>
                                        {tripItemCount > 0 && (
                                            <div className="trip-card-checklist-count">
                                                체크리스트 {tripDoneCount} / {tripItemCount} 완료
                                            </div>
                                        )}
                                    </div>
                                    <div className="trip-card-arrow">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    const totalCount = items.length;
    const doneCount = items.filter(i => i.completed).length;

    return (
        <div className="checklist-page">
            <div className="checklist-header">
                <div className="checklist-title-row">
                    <ListChecks size={22} color="var(--primary)" />
                    <h2 className="checklist-title">{currentTrip?.title || '여행'} 체크리스트</h2>
                </div>
                <div className="checklist-header-right">
                    {totalCount > 0 && (
                        <div className="checklist-progress">
                            {doneCount} / {totalCount} 완료
                        </div>
                    )}
                    <button
                        className="btn btn-ghost checklist-change-trip"
                        onClick={() => onSelectTrip(null)}
                        title="다른 여행 선택"
                    >
                        <ChevronsLeft size={16} />
                        <span className="hidden-mobile">다른 여행</span>
                    </button>
                </div>
            </div>

            <div className="checklist-add-row">
                <input
                    type="text"
                    className="checklist-input"
                    placeholder="항목을 입력하고 Enter (예: 여권, 충전기)"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={busy}
                />
                <button
                    className="btn btn-primary checklist-add-btn"
                    onClick={handleAdd}
                    disabled={busy || !draft.trim()}
                    aria-label="추가"
                >
                    <Plus size={18} />
                    <span className="hidden-mobile">추가</span>
                </button>
            </div>

            {items.length === 0 ? (
                <div className="checklist-empty">
                    체크리스트가 비어있습니다. 첫 항목을 추가해보세요.
                </div>
            ) : (
                <ul className="checklist-list">
                    {items.map(item => (
                        <li
                            key={item.id}
                            className={`checklist-item ${item.completed ? 'is-done' : ''}`}
                        >
                            <label className="checklist-item-label">
                                <input
                                    type="checkbox"
                                    checked={!!item.completed}
                                    onChange={() => handleToggle(item)}
                                />
                                <span className="checklist-item-title">{item.title}</span>
                            </label>
                            <button
                                className="btn btn-ghost checklist-item-delete"
                                onClick={() => handleDelete(item.id)}
                                aria-label="삭제"
                                title="삭제"
                            >
                                <Trash2 size={16} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
