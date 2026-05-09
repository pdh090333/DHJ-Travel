import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ActivityModal from '../components/ActivityModal';
import { saveActivity, deleteActivity, generateId } from '../db';
import './CalendarView.css';

const BUILD_TAG = 'wishlist-drag v16 — let FC see mouseup; display:none alone kills the flash';

export default function CalendarView({ dbData, selectedTripId, refreshDb, onDragOverWishlist, onUnschedule }) {
    // Build identifier — if the user does Ctrl+Shift+R and this doesn't
    // appear in the console, they didn't get the new bundle and any
    // verification is meaningless.
    useEffect(() => { console.log('[Travel]', BUILD_TAG); }, []);

    const [selectedActivity, setSelectedActivity] = useState(null);
    const wishlistRectRef = useRef(null);
    const wasInsideWishlistRef = useRef(false);
    // Calendar's bounding rect captured on dragStart. Once the cursor
    // leaves this rect, FC's mirror positioning is unreliable (the
    // captured node was `.fc-timegrid-event-harness`, an absolutely-
    // positioned wrapper inside the grid — hiding inner children does
    // nothing to the wrapper's position). So the new boundary is the
    // calendar itself, not the wishlist.
    const calendarRectRef = useRef(null);
    const wasOutsideCalendarRef = useRef(false);
    // Refs for the new approach:
    //  - mirrorObserverRef:  MutationObserver that captures whatever node FC
    //                        inserts as the drag mirror, regardless of class.
    //  - mirrorElRef:         the captured mirror element, so we can hide it
    //                        while over the wishlist.
    //  - ghostElRef:          our own cursor-following ghost we create from
    //                        scratch and append to <body>. Bypasses FC's
    //                        coordinate frame entirely — no selector match
    //                        problems, no calendar-grid-local positioning.
    const mirrorObserverRef = useRef(null);
    const mirrorElRef = useRef(null);
    const ghostElRef = useRef(null);
    // Global pointermove listener registered for the duration of the drag.
    // FC 6.x has no `eventDrag` option (the prop was silently ignored),
    // so we have to subscribe to mousemove ourselves to get per-frame
    // cursor coordinates during the drag.
    const moveListenerRef = useRef(null);
    const upListenerRef = useRef(null);
    // Last known cursor position from our own mousemove listener. Used as
    // a fallback because info.jsEvent's coords are unreliable on mouseup
    // (sometimes 0/null, sometimes the snap-back position).
    const lastPointerRef = useRef({ x: 0, y: 0 });
    const activities = dbData.activities.filter(a => a.tripId === selectedTripId);

    const firstDate = activities
        .map(a => a.date)
        .filter(Boolean)
        .sort()[0] || new Date().toLocaleDateString('en-CA');

    const events = activities.map(act => {
        const startStr = act.date && act.startTime ? `${act.date}T${act.startTime}:00` : act.date ? `${act.date}T00:00:00` : null;
        let endStr = act.date && act.endTime ? `${act.date}T${act.endTime}:00` : null;

        if (startStr && !endStr) {
            const startObj = new Date(startStr);
            startObj.setHours(startObj.getHours() + 1);
            endStr = startObj.toISOString().slice(0, 16) + ':00';
        }

        return {
            id: act.id,
            title: act.title || '새 일정',
            start: startStr,
            end: endStr,
            backgroundColor: 'var(--primary)',
            borderColor: 'var(--primary)',
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

    const handleEventDragStart = (info) => {
        const sidebar = document.querySelector('.candidates-sidebar');
        if (sidebar) wishlistRectRef.current = sidebar.getBoundingClientRect();
        wasInsideWishlistRef.current = false;
        const cal = document.querySelector('.calendar-container');
        if (cal) calendarRectRef.current = cal.getBoundingClientRect();
        wasOutsideCalendarRef.current = false;

        // Capture FC's mirror element via MutationObserver — selector-free.
        // FC inserts the mirror as a *new* DOM node sometime after this
        // callback fires; we don't care which class it ends up with.
        mirrorElRef.current = null;
        if (mirrorObserverRef.current) mirrorObserverRef.current.disconnect();
        const obs = new MutationObserver((records) => {
            if (mirrorElRef.current) return;
            for (const rec of records) {
                for (const n of rec.addedNodes) {
                    if (n.nodeType !== 1) continue;
                    const cls = n.getAttribute?.('class') || '';
                    const looksLikeMirror =
                        cls.includes('fc-event') ||
                        n.querySelector?.('.fc-event-main, .fc-event-title');
                    if (looksLikeMirror) {
                        mirrorElRef.current = n;
                        // Hide on capture — FC's mirror positioning is
                        // unreliable across the full drag (snaps to slot,
                        // not cursor). Our ghost is the only visual.
                        n.style.display = 'none';
                        console.log('[wishlist] mirror captured + hidden:', cls || n.tagName);
                        obs.disconnect();
                        return;
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        mirrorObserverRef.current = obs;

        // Build our own cursor-following ghost. This is the actual visible
        // feedback over the wishlist — independent of FC's mirror. It's
        // position:fixed so it tracks the cursor in viewport coords with
        // zero involvement from FC's calendar-grid frame.
        const ghost = document.createElement('div');
        const sx = info?.jsEvent?.clientX || 0;
        const sy = info?.jsEvent?.clientY || 0;
        ghost.style.cssText = [
            'position:fixed', 'z-index:99998', 'pointer-events:none',
            'background:var(--primary,#4f46e5)', 'color:white',
            'padding:6px 12px', 'border-radius:6px',
            'font-size:0.85rem', 'font-weight:600', 'opacity:0.92',
            'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
            'white-space:nowrap',
            // Show immediately at the cursor; no "ghost not visible until
            // first mousemove" gap during which the FC mirror flashes.
            `left:${sx + 12}px`, `top:${sy + 12}px`,
        ].join(';');
        ghost.textContent = info?.event?.title || '';
        document.body.appendChild(ghost);
        ghostElRef.current = ghost;
        if (sx && sy) lastPointerRef.current = { x: sx, y: sy };

        // Subscribe to global pointer movement for the duration of the
        // drag. FC's `eventDrag` prop is a no-op in 6.x — earlier fixes
        // never ran because the callback was never invoked. mousemove
        // on window fires during FC's drag the same way it would for
        // any other pointer interaction.
        const onMove = (e) => {
            const t = e.touches?.[0] || e.changedTouches?.[0];
            const x = e.clientX || (t ? t.clientX : 0);
            const y = e.clientY || (t ? t.clientY : 0);
            if (!x || !y) return;
            lastPointerRef.current = { x, y };

            // Belt-and-suspenders: even if MutationObserver missed the
            // mirror, sweep any visible .fc-event-dragging clones. FC
            // never adds this class to source events.
            document.querySelectorAll('.fc-event-dragging').forEach(el => {
                if (el.style.display !== 'none') el.style.display = 'none';
            });
            if (mirrorElRef.current && mirrorElRef.current.style.display !== 'none') {
                mirrorElRef.current.style.display = 'none';
            }

            // Ghost is the only visual feedback — always cursor-tracking,
            // calendar in/out doesn't matter.
            const g = ghostElRef.current;
            if (g) {
                if (g.style.display !== 'block') g.style.display = 'block';
                g.style.left = (x + 12) + 'px';
                g.style.top = (y + 12) + 'px';
            }

            // Wishlist boundary still drives the sidebar outline +
            // drop-placeholder for affordance.
            const wr = wishlistRectRef.current;
            if (wr) {
                const isInsideWishlist =
                    x >= wr.left && x <= wr.right && y >= wr.top && y <= wr.bottom;
                if (isInsideWishlist !== wasInsideWishlistRef.current) {
                    wasInsideWishlistRef.current = isInsideWishlist;
                    onDragOverWishlist(isInsideWishlist);
                }
            }
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        moveListenerRef.current = onMove;

        // Drop handler — window-level mouseup, registered in capture phase
        // so FC can't swallow it via stopPropagation. Doesn't depend on
        // FC's eventDragStop callback firing (it didn't, in v9 testing).
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
            console.log('[wishlist] mouseup drop check', {
                x, y, droppedOnWishlist, hasWishlistRect: !!wr,
            });

            if (droppedOnWishlist) {
                // Don't stopPropagation / stopImmediatePropagation here.
                // FC's mouseup handler must run for it to clean up its
                // internal "is-dragging" state — without that, the next
                // drag attempt is silently ignored. We let FC's
                // dragStop pipeline run and just hide the resulting
                // mirror animation with display:none (which suppresses
                // any paint, snap-back included).
                try { eventRef.remove(); } catch (_) { /* ignore */ }
                onUnschedule(selectedTripId, eventId);

                const sweepHide = () => {
                    document.querySelectorAll('.fc-event-dragging').forEach(el => {
                        el.style.display = 'none';
                    });
                };
                sweepHide();
                requestAnimationFrame(sweepHide);
                setTimeout(sweepHide, 100);
                setTimeout(sweepHide, 250);
            }

            cleanupDrag(droppedOnWishlist);
        };
        window.addEventListener('mouseup', onUp, true);
        window.addEventListener('touchend', onUp, true);
        upListenerRef.current = onUp;
    };

    const cleanupDrag = (droppedOnWishlist = false) => {
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
        if (mirrorObserverRef.current) {
            mirrorObserverRef.current.disconnect();
            mirrorObserverRef.current = null;
        }
        if (mirrorElRef.current) {
            if (droppedOnWishlist) {
                // Keep hidden; FC needs the DOM node to finish its own
                // cleanup, and next-drag init seems to depend on it
                // existing. .remove() here was breaking subsequent drags.
                mirrorElRef.current.style.display = 'none';
            } else {
                mirrorElRef.current.style.display = '';
                mirrorElRef.current.style.visibility = '';
            }
            mirrorElRef.current = null;
        }
        if (ghostElRef.current) {
            ghostElRef.current.remove();
            ghostElRef.current = null;
        }
        wishlistRectRef.current = null;
        calendarRectRef.current = null;
        wasOutsideCalendarRef.current = false;
        wasInsideWishlistRef.current = false;
        lastPointerRef.current = { x: 0, y: 0 };
    };

    const handleEventDragStop = () => {
        // Drop logic is handled by the window mouseup listener registered
        // in handleEventDragStart (FC's dragStop wasn't firing reliably).
        // This is just a belt-and-suspenders cleanup if dragStop *does*
        // fire. cleanupDrag is idempotent.
        console.log('[wishlist] FC dragStop fired (informational)');
        cleanupDrag();
    };

    return (
        <div className="calendar-page">
            <p className="calendar-instructions">💡 일정을 드래그하여 예약하거나 후보지로 옮기세요!</p>
            <div className="calendar-container">
                <FullCalendar
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek" initialDate={firstDate} allDaySlot={false}
                    events={events} editable={true} selectable={true} selectMirror={true}
                    eventChange={handleEventChange} eventClick={handleEventClick} select={handleDateSelect}
                    eventReceive={handleEventReceive} eventDragStop={handleEventDragStop}
                    eventDragStart={handleEventDragStart}
                    droppable={true} height="100%" locale="ko"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
                />
            </div>
            {selectedActivity && (
                <ActivityModal
                    activity={selectedActivity} onClose={() => setSelectedActivity(null)}
                    onSave={handleSaveModal} onDelete={handleDeleteModal}
                    onMoveToCandidates={() => onUnschedule(selectedTripId, selectedActivity.id)}
                />
            )}
        </div>
    );
}
