import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ActivityModal from '../components/ActivityModal';
import { saveActivity, deleteActivity, generateId, normalizeTags, resolveActivityColor } from '../db';
import './CalendarView.css';

const BUILD_TAG = 'wishlist-drag v18 — hands off the mirror, ghost-only feedback';

const computeTripDuration = (start, end) => {
    if (!start || !end) return 0;
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const startMs = Date.UTC(sy, sm - 1, sd);
    const endMs = Date.UTC(ey, em - 1, ed);
    if (endMs < startMs) return 0;
    return Math.floor((endMs - startMs) / 86400000) + 1;
};

const addOneDay = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d) + 86400000);
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

export default function CalendarView({ dbData, selectedTripId, refreshDb, onDragOverWishlist, onUnschedule }) {
    useEffect(() => { console.log('[Travel]', BUILD_TAG); }, []);

    const [selectedActivity, setSelectedActivity] = useState(null);
    // Default to 'trip' (여행 기간) when the trip has dates set,
    // otherwise fall back to 'week'. Lazy init avoids a 'week' → 'trip'
    // flicker on mount.
    const [viewMode, setViewMode] = useState(() => {
        const tr = dbData.trips.find(t => t.id === selectedTripId);
        return computeTripDuration(tr?.startDate, tr?.endDate) > 0 ? 'trip' : 'week';
    });
    const wishlistRectRef = useRef(null);
    const wasInsideWishlistRef = useRef(false);
    const ghostElRef = useRef(null);
    const moveListenerRef = useRef(null);
    const upListenerRef = useRef(null);
    const lastPointerRef = useRef({ x: 0, y: 0 });

    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const activities = dbData.activities
        .filter(a => a.tripId === selectedTripId)
        .filter(a => !a.date || ISO_DATE.test(a.date));
    const currentTrip = dbData.trips.find(t => t.id === selectedTripId);

    const tripDuration = computeTripDuration(currentTrip?.startDate, currentTrip?.endDate);
    const hasTripPeriod = tripDuration > 0;

    useEffect(() => {
        if (viewMode === 'trip' && !hasTripPeriod) setViewMode('week');
    }, [viewMode, hasTripPeriod]);

    const firstDate = currentTrip?.startDate
        || activities.map(a => a.date).filter(Boolean).sort()[0]
        || new Date().toLocaleDateString('en-CA');

    const isTripView = viewMode === 'trip' && hasTripPeriod;
    const calendarConfig = isTripView ? {
        initialView: 'timeGridTrip',
        initialDate: currentTrip.startDate,
        views: {
            timeGridTrip: {
                type: 'timeGrid',
                duration: { days: tripDuration }
            }
        },
        validRange: {
            start: currentTrip.startDate,
            end: addOneDay(currentTrip.endDate)
        },
        headerToolbar: { left: '', center: 'title', right: '' }
    } : {
        initialView: 'timeGridWeek',
        initialDate: firstDate,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }
    };

    const events = activities.map(act => {
        const startStr = act.date && act.startTime ? `${act.date}T${act.startTime}:00` : act.date ? `${act.date}T00:00:00` : null;
        let endStr = act.date && act.endTime ? `${act.date}T${act.endTime}:00` : null;

        if (startStr && !endStr) {
            const startObj = new Date(startStr);
            startObj.setHours(startObj.getHours() + 1);
            endStr = startObj.toISOString().slice(0, 16) + ':00';
        }

        const color = resolveActivityColor(act, currentTrip?.tags) || 'var(--primary)';
        const baseTitle = act.title || '새 일정';
        const titleWithTag = act.tag ? `[${act.tag}] ${baseTitle}` : baseTitle;
        return {
            id: act.id,
            title: titleWithTag,
            start: startStr,
            end: endStr,
            backgroundColor: color,
            borderColor: color,
            extendedProps: act
        };
    }).filter(e => e.start);

    const handleEventChange = async (changeInfo) => {
        const { event } = changeInfo;
        const original = activities.find(a => a.id === event.id);
        if (!original) return;
        const newStart = event.start;
        const newEnd = event.end || new Date(newStart.getTime() + 60 * 60 * 1000);
        const offset = newStart.getTimezoneOffset() * 60000;
        const localStart = new Date(newStart.getTime() - offset);
        const localEnd = new Date(newEnd.getTime() - offset);
        const updated = {
            ...original,
            date: localStart.toISOString().split('T')[0],
            startTime: localStart.toISOString().slice(11, 16),
            endTime: localEnd.toISOString().slice(11, 16)
        };
        try {
            await saveActivity(updated);
            await refreshDb();
        } catch {
            alert('저장 실패');
            changeInfo.revert();
        }
    };

    const handleEventClick = (clickInfo) => setSelectedActivity(clickInfo.event.extendedProps);

    const handleDateSelect = (selectInfo) => {
        const calendarApi = selectInfo.view.calendar;
        calendarApi.unselect();
        const start = selectInfo.start;
        const offset = start.getTimezoneOffset() * 60000;
        const local = new Date(start.getTime() - offset);
        setSelectedActivity({
            id: `new_${generateId()}`,
            tripId: selectedTripId,
            date: local.toISOString().split('T')[0],
            startTime: local.toISOString().slice(11, 16),
            endTime: new Date(local.getTime() + 3600000).toISOString().slice(11, 16),
            title: '', departure: '', arrival: '', departureUrl: '', arrivalUrl: '', notes: ''
        });
    };

    const handleSaveModal = async (editedActivity) => {
        const toSave = editedActivity.id.startsWith('new_')
            ? { ...editedActivity, id: editedActivity.id.replace('new_', ''), tripId: selectedTripId }
            : { ...editedActivity, tripId: selectedTripId };
        try {
            await saveActivity(toSave);
            await refreshDb();
            setSelectedActivity(null);
        } catch { alert('실패'); }
    };

    const handleDeleteModal = async (id) => {
        if (!confirm('삭제?')) return;
        try {
            await deleteActivity(id);
            await refreshDb();
            setSelectedActivity(null);
        } catch { alert('실패'); }
    };

    const handleEventReceive = async (info) => {
        const candidateData = info.event.extendedProps;
        const start = info.event.start;
        const offset = start.getTimezoneOffset() * 60000;
        const local = new Date(start.getTime() - offset);
        const newAct = {
            id: generateId(), tripId: selectedTripId, title: candidateData.title,
            date: local.toISOString().split('T')[0], startTime: local.toISOString().slice(11, 16),
            endTime: new Date(local.getTime() + 3600000).toISOString().slice(11, 16),
            departure: '', arrival: candidateData.title, departureUrl: '',
            arrivalUrl: candidateData.url || '', notes: candidateData.notes || ''
        };
        try {
            const { deleteCandidate } = await import('../db');
            await Promise.all([
                saveActivity(newAct),
                deleteCandidate(candidateData.id)
            ]);
            await refreshDb();
        } catch { info.event.remove(); }
    };

    // ─── Wishlist drag-out ────────────────────────────────────
    //
    // Lessons from v8–v17: every attempt to manipulate FC's mirror DOM
    // (capture via MutationObserver, hide via inline style, .remove())
    // ended up either grabbing a source event by mistake or breaking
    // FC's internal cleanup so the next drag wouldn't start. v18 keeps
    // hands off FC's mirror entirely. We add three things and that's it:
    //
    //  1. A cursor-following ghost (<div> in <body>, position:fixed) that
    //     gives unambiguous visual feedback at the actual cursor — FC's
    //     own mirror sometimes lands at the snap-target slot rather than
    //     the cursor, which is confusing in a maximized window. The ghost
    //     is the source of truth; users look at the ghost.
    //
    //  2. A wishlist-rect boundary check on every mousemove → toggles
    //     the sidebar's `is-dragging-over` class for outline + drop
    //     placeholder.
    //
    //  3. A window-level mouseup that, if the cursor is over the
    //     wishlist, calls event.remove() + onUnschedule(). FC's
    //     `eventDragStop` is unreliable in this flow so we don't rely
    //     on it.
    //
    // We let FC do whatever it wants with its own mirror DOM. There may
    // be a brief snap-back flash when releasing — accept it. The
    // alternative (touching the mirror) keeps breaking subsequent drags.

    const handleEventDragStart = (info) => {
        const sidebar = document.querySelector('.candidates-sidebar');
        if (sidebar) wishlistRectRef.current = sidebar.getBoundingClientRect();
        wasInsideWishlistRef.current = false;

        // Cursor-following ghost. Position with the start cursor coords
        // so it appears immediately, no first-frame flash.
        const ghost = document.createElement('div');
        const sx = info?.jsEvent?.clientX || 0;
        const sy = info?.jsEvent?.clientY || 0;
        ghost.style.cssText = [
            'position:fixed', 'z-index:99998', 'pointer-events:none',
            'background:var(--primary,#4f46e5)', 'color:white',
            'padding:6px 12px', 'border-radius:6px',
            'font-size:0.85rem', 'font-weight:600', 'opacity:0.92',
            'box-shadow:0 4px 12px rgba(0,0,0,0.25)',
            'white-space:nowrap',
            `left:${sx + 12}px`, `top:${sy + 12}px`,
        ].join(';');
        ghost.textContent = info?.event?.title || '';
        document.body.appendChild(ghost);
        ghostElRef.current = ghost;
        if (sx && sy) lastPointerRef.current = { x: sx, y: sy };

        // FC 6.x has no `eventDrag` callback option — has to be a
        // window listener.
        const onMove = (e) => {
            const t = e.touches?.[0] || e.changedTouches?.[0];
            const x = e.clientX || (t ? t.clientX : 0);
            const y = e.clientY || (t ? t.clientY : 0);
            if (!x || !y) return;
            lastPointerRef.current = { x, y };

            const g = ghostElRef.current;
            if (g) {
                g.style.left = (x + 12) + 'px';
                g.style.top = (y + 12) + 'px';
            }

            const wr = wishlistRectRef.current;
            if (wr) {
                const inside = x >= wr.left && x <= wr.right && y >= wr.top && y <= wr.bottom;
                if (inside !== wasInsideWishlistRef.current) {
                    wasInsideWishlistRef.current = inside;
                    onDragOverWishlist(inside);
                }
            }
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        moveListenerRef.current = onMove;

        // Drop handler — window mouseup. Capture phase so ordering
        // doesn't matter. We do NOT stopPropagation: FC needs the
        // mouseup to clean up its own state (otherwise next drag
        // is silently ignored).
        const eventRef = info.event;
        const eventId = info.event.id;
        const onUp = (e) => {
            const t = e.changedTouches?.[0] || e.touches?.[0];
            const lp = lastPointerRef.current;
            const x = e.clientX || (t ? t.clientX : 0) || lp.x;
            const y = e.clientY || (t ? t.clientY : 0) || lp.y;
            const wr = wishlistRectRef.current;
            const droppedOnWishlist = !!wr && x && y &&
                x >= wr.left && x <= wr.right && y >= wr.top && y <= wr.bottom;
            console.log('[wishlist] drop check', { x, y, droppedOnWishlist });

            if (droppedOnWishlist) {
                try { eventRef.remove(); } catch (_) { /* ignore */ }
                onUnschedule(selectedTripId, eventId);
            }
            cleanupDrag();
        };
        window.addEventListener('mouseup', onUp, true);
        window.addEventListener('touchend', onUp, true);
        upListenerRef.current = onUp;
    };

    const cleanupDrag = () => {
        onDragOverWishlist(false);
        if (moveListenerRef.current) {
            window.removeEventListener('mousemove', moveListenerRef.current);
            window.removeEventListener('touchmove', moveListenerRef.current);
            moveListenerRef.current = null;
        }
        if (upListenerRef.current) {
            window.removeEventListener('mouseup', upListenerRef.current, true);
            window.removeEventListener('touchend', upListenerRef.current, true);
            upListenerRef.current = null;
        }
        if (ghostElRef.current) {
            ghostElRef.current.remove();
            ghostElRef.current = null;
        }
        wishlistRectRef.current = null;
        wasInsideWishlistRef.current = false;
        lastPointerRef.current = { x: 0, y: 0 };
    };

    const handleEventDragStop = () => {
        // Belt-and-suspenders cleanup if FC's dragStop fires. Idempotent.
        cleanupDrag();
    };

    return (
        <div className="calendar-page">
            <div className="calendar-toolbar">
                <div className="view-mode-toggle">
                    <button
                        className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('week')}
                    >
                        주간 보기
                    </button>
                    <button
                        className={`btn btn-sm ${viewMode === 'trip' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => hasTripPeriod && setViewMode('trip')}
                        disabled={!hasTripPeriod}
                        title={hasTripPeriod ? '' : '먼저 여행 기간을 설정하세요'}
                    >
                        여행 기간 {hasTripPeriod ? `(${tripDuration}일)` : ''}
                    </button>
                </div>
                <p className="calendar-instructions">💡 일정을 드래그하여 예약하거나 후보지로 옮기세요!</p>
            </div>
            <div className="calendar-container">
                <FullCalendar
                    key={`${selectedTripId}-${firstDate}-${viewMode}-${tripDuration}`}
                    plugins={[timeGridPlugin, interactionPlugin]}
                    {...calendarConfig}
                    allDaySlot={false}
                    slotMinTime="06:00:00"
                    slotMaxTime="24:00:00"
                    slotDuration="01:00:00"
                    expandRows={true}
                    displayEventTime={false}
                    events={events} editable={true} selectable={true} selectMirror={true}
                    eventChange={handleEventChange} eventClick={handleEventClick} select={handleDateSelect}
                    eventReceive={handleEventReceive} eventDragStop={handleEventDragStop}
                    eventDragStart={handleEventDragStart}
                    droppable={true} height="100%" locale="ko"
                />
            </div>
            {selectedActivity && (
                <ActivityModal
                    activity={selectedActivity} onClose={() => setSelectedActivity(null)}
                    onSave={handleSaveModal} onDelete={handleDeleteModal}
                    onMoveToCandidates={() => onUnschedule(selectedTripId, selectedActivity.id)}
                    availableTags={normalizeTags(currentTrip?.tags)}
                />
            )}
        </div>
    );
}
