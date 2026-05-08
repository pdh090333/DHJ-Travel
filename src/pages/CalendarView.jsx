import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ActivityModal from '../components/ActivityModal';
import { saveActivity, deleteActivity, generateId } from '../db';
import './CalendarView.css';

const BUILD_TAG = 'wishlist-drag v7 — boundary on calendar exit, hide harness';

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
                        console.log('[wishlist] mirror captured:', cls || n.tagName);
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
        ghost.style.cssText = [
            'position:fixed', 'z-index:99998', 'pointer-events:none',
            'background:var(--primary,#4f46e5)', 'color:white',
            'padding:6px 12px', 'border-radius:6px',
            'font-size:0.85rem', 'font-weight:600', 'opacity:0.92',
            'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
            'white-space:nowrap', 'display:none',
            'left:0', 'top:0',
        ].join(';');
        ghost.textContent = info?.event?.title || '';
        document.body.appendChild(ghost);
        ghostElRef.current = ghost;
    };

    const handleEventDrag = (info) => {
        const js = info.jsEvent;
        const touch = (js.touches && js.touches[0]) || (js.changedTouches && js.changedTouches[0]);
        const x = js.clientX || (touch ? touch.clientX : 0);
        const y = js.clientY || (touch ? touch.clientY : 0);
        if (!x || !y) return;

        // Calendar boundary — primary trigger for hiding FC's mirror and
        // showing our own ghost. As soon as the cursor leaves the
        // calendar, FC's harness positioning is no longer relatable to
        // viewport coords.
        if (!calendarRectRef.current) {
            const cal = document.querySelector('.calendar-container');
            if (cal) calendarRectRef.current = cal.getBoundingClientRect();
        }
        const calR = calendarRectRef.current;
        const isOutsideCalendar = !!calR && (
            x < calR.left || x > calR.right || y < calR.top || y > calR.bottom
        );

        if (isOutsideCalendar !== wasOutsideCalendarRef.current) {
            wasOutsideCalendarRef.current = isOutsideCalendar;
            if (mirrorElRef.current) {
                mirrorElRef.current.style.visibility = isOutsideCalendar ? 'hidden' : '';
            }
        }

        const ghost = ghostElRef.current;
        if (ghost) {
            if (isOutsideCalendar) {
                ghost.style.display = 'block';
                ghost.style.left = (x + 12) + 'px';
                ghost.style.top = (y + 12) + 'px';
            } else if (ghost.style.display !== 'none') {
                ghost.style.display = 'none';
            }
        }

        // Wishlist boundary — separate concern: drives the sidebar's
        // outline + drop placeholder via setSidebarDragOver.
        if (!wishlistRectRef.current) {
            const sb = document.querySelector('.candidates-sidebar');
            if (sb) wishlistRectRef.current = sb.getBoundingClientRect();
        }
        if (wishlistRectRef.current) {
            const wr = wishlistRectRef.current;
            const isInsideWishlist = x >= wr.left && x <= wr.right && y >= wr.top && y <= wr.bottom;
            if (isInsideWishlist !== wasInsideWishlistRef.current) {
                wasInsideWishlistRef.current = isInsideWishlist;
                onDragOverWishlist(isInsideWishlist);
            }
        }
    };

    const handleEventDragStop = (info) => {
        onDragOverWishlist(false);

        // Cleanup: stop observer, restore FC mirror, remove our ghost.
        if (mirrorObserverRef.current) {
            mirrorObserverRef.current.disconnect();
            mirrorObserverRef.current = null;
        }
        if (mirrorElRef.current) {
            mirrorElRef.current.style.visibility = '';
            mirrorElRef.current = null;
        }
        if (ghostElRef.current) {
            ghostElRef.current.remove();
            ghostElRef.current = null;
        }

        const js = info.jsEvent;
        const touch = (js.touches && js.touches[0]) || (js.changedTouches && js.changedTouches[0]);
        const x = js.clientX || (touch ? touch.clientX : 0);
        const y = js.clientY || (touch ? touch.clientY : 0);
        if (wishlistRectRef.current && x && y) {
            const r = wishlistRectRef.current;
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                // IMPORTANT: Use the optimistic handler from App.jsx
                onUnschedule(selectedTripId, info.event.id);
            }
        }
        wishlistRectRef.current = null;
        calendarRectRef.current = null;
        wasOutsideCalendarRef.current = false;
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
                    eventDragStart={handleEventDragStart} eventDrag={handleEventDrag}
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
