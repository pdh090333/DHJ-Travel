import React, { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ActivityModal from '../components/ActivityModal';
import { saveActivity, deleteActivity, generateId } from '../db';
import './CalendarView.css';

export default function CalendarView({ dbData, selectedTripId, refreshDb, onDragOverWishlist, onUnschedule }) {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const wishlistRectRef = useRef(null);
    const wasInsideWishlistRef = useRef(false);
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

    const handleEventDragStart = () => {
        const sidebar = document.querySelector('.candidates-sidebar');
        if (sidebar) wishlistRectRef.current = sidebar.getBoundingClientRect();
        wasInsideWishlistRef.current = false;
    };

    const handleEventDrag = (info) => {
        const js = info.jsEvent;
        const touch = (js.touches && js.touches[0]) || (js.changedTouches && js.changedTouches[0]);
        const x = js.clientX || (touch ? touch.clientX : 0);
        const y = js.clientY || (touch ? touch.clientY : 0);
        if (!x || !y) return;
        if (!wishlistRectRef.current) {
            const sb = document.querySelector('.candidates-sidebar');
            if (sb) wishlistRectRef.current = sb.getBoundingClientRect();
        }
        if (!wishlistRectRef.current) return;
        const r = wishlistRectRef.current;
        const isInside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        // Only flip the highlight when crossing the wishlist boundary —
        // calling setState every mousemove triggers an AdminView re-render
        // and made the cursor feel sluggish.
        if (isInside !== wasInsideWishlistRef.current) {
            wasInsideWishlistRef.current = isInside;
            onDragOverWishlist(isInside);
        }
    };

    const handleEventDragStop = (info) => {
        onDragOverWishlist(false);
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
