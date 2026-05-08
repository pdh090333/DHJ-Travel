import React, { useState, useEffect, useRef } from 'react';
import { replaceTripActivities, exportToCSV, parseCSV, generateId, saveTrip, deleteTrip, saveCandidate, deleteCandidate } from '../db';
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

    // Was useState — but toggling state on every wishlist boundary crossing
    // forced an AdminView+CalendarView re-render mid-drag, which rebuilt
    // FullCalendar's events array and snapped the drag mirror away from
    // the cursor. Direct DOM toggling sidesteps React entirely.
    const sidebarRef = useRef(null);
    const fcMirrorCleanupRef = useRef([]);

    // FullCalendar's drag mirror is positioned in the calendar grid's
    // local coordinate frame. Once the cursor leaves the calendar and
    // enters the wishlist the mirror lands ~500px off-cursor and can't
    // be coaxed back. Hide it while over the wishlist — the sidebar's
    // own drop-placeholder + outline give enough feedback, and the drop
    // position is read from the cursor in handleEventDragStop anyway.
    //
    // We hide via inline style (stronger than any FC inline positioning)
    // and cast a wide net on selectors because FC versions name the
    // mirror element differently. If our selector misses, we log every
    // floating element in the calendar so we can pin it down.
    const hideFCMirror = () => {
        const els = document.querySelectorAll(
            '.fc-event-dragging, [class*="fc-event-mirror"], .fc-helper'
        );
        if (!els.length) {
            const seen = new Set();
            document.querySelectorAll('.fc *').forEach(el => {
                const cs = window.getComputedStyle(el);
                if (cs.position === 'absolute' || cs.position === 'fixed') {
                    seen.add(el.className || el.tagName);
                }
            });
            console.warn('[wishlist] FC mirror not matched. Floating .fc descendants:', [...seen]);
            return;
        }
        els.forEach(el => {
            if (el.style.display === 'none') return;
            fcMirrorCleanupRef.current.push([el, el.style.display]);
            el.style.display = 'none';
        });
    };

    const showFCMirror = () => {
        fcMirrorCleanupRef.current.forEach(([el, prev]) => {
            el.style.display = prev || '';
        });
        fcMirrorCleanupRef.current = [];
    };

    const setSidebarDragOver = (over) => {
        sidebarRef.current?.classList.toggle('is-dragging-over', !!over);
        document.body.classList.toggle('hide-fc-mirror', !!over);
        if (over) hideFCMirror();
        else showFCMirror();
    };

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

    // Track when user is dragging FROM wishlist (vs INTO it). The hover-lift
    // on .candidate-item triggers a paint storm as the drag mirror passes
    // over each sibling. Killing the lift while a candidate is being
    // dragged restores 60fps inside the wishlist.
    useEffect(() => {
        const sidebar = sidebarRef.current;
        if (!sidebar) return;
        let active = false;
        const onDown = (e) => {
            if (!e.target.closest('.candidate-item-draggable')) return;
            active = true;
            sidebar.classList.add('is-dragging-from-wishlist');
        };
        const onUp = () => {
            if (!active) return;
            active = false;
            sidebar.classList.remove('is-dragging-from-wishlist');
        };
        sidebar.addEventListener('pointerdown', onDown);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            sidebar.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, []);

    const extractDirectImageUrl = (url) => {
        if (!url) return '';
        if (url.includes('lh3.googleusercontent.com') && !url.includes('google.com/maps')) return url;
        const match = url.match(/!6s(https[:%][^!&]+lh3\.googleusercontent\.com[^!&]+)/);
        if (match) {
            try {
                let decoded = decodeURIComponent(match[1]);
                if (decoded.includes('%')) decoded = decodeURIComponent(decoded);
                return decoded;
            } catch (e) { return match[1]; }
        }
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
                await replaceTripActivities(selectedTripId, parsed);
                await refreshDb();
                alert('일정을 성공적으로 불러왔습니다!');
            } catch {
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
                            onDragOverWishlist={setSidebarDragOver}
                            onUnschedule={onUnschedule}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            위에서 여행을 선택하거나 추가해 주세요.
                        </div>
                    )}
                </div>

                <div ref={sidebarRef} className="candidates-sidebar">
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
                        {/* Always render — CSS visibility is toggled via the
                            sidebar's `is-dragging-over` class so we don't
                            mount/unmount during drag (would force a React
                            render and shake the FullCalendar drag mirror). */}
                        <div className="drop-placeholder">
                            <Plus size={24} />
                            <span>이곳에 놓으면 후보지로 이동합니다</span>
                        </div>
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
