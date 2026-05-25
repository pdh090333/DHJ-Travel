import React, { useState } from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';
import { saveChecklistItem, deleteChecklistItem, generateId } from '../db';
import './ChecklistView.css';

export default function ChecklistView({ dbData, selectedTripId, refreshDb }) {
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

    const totalCount = items.length;
    const doneCount = items.filter(i => i.completed).length;

    return (
        <div className="checklist-page">
            <div className="checklist-header">
                <div className="checklist-title-row">
                    <ListChecks size={22} color="var(--primary)" />
                    <h2 className="checklist-title">{currentTrip?.title || '여행'} 체크리스트</h2>
                </div>
                {totalCount > 0 && (
                    <div className="checklist-progress">
                        {doneCount} / {totalCount} 완료
                    </div>
                )}
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
