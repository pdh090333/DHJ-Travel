import React from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { saveActivities, generateId } from '../db';
import './CalendarView.css';

export default function CalendarView({ dbData, selectedTripId, refreshDb }) {
    // Filter activities for the selected trip
    const activities = dbData.activities.filter(a => a.tripId === selectedTripId);

    // Identify first date to display the calendar correctly
    const firstDate = activities
        .map(a => a.date)
        .filter(Boolean)
        .sort()[0] || new Date().toLocaleDateString('en-CA');

    // Map database activities to FullCalendar events
    const events = activities.map(act => {
        // Handle cases where time might be missing
        const startStr = act.date && act.startTime ? `${act.date}T${act.startTime}:00` : act.date ? `${act.date}T00:00:00` : null;
        let endStr = act.date && act.endTime ? `${act.date}T${act.endTime}:00` : null;

        // If start exists but no end, default to 1 hour later for visual purposes
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
        };
    }).filter(e => e.start); // Only render events that have at least a start date

    // Handle drag and drop or resizing
    const handleEventChange = async (changeInfo) => {
        const { event } = changeInfo;
        const newStart = event.start;
        const newEnd = event.end || new Date(newStart.getTime() + 60 * 60 * 1000); // Default 1 hour if no end

        // Local time formatting for Korean timezone/users (using en-CA for YYYY-MM-DD compatibility)
        // Note: FullCalendar gives us raw Date objects in local time as we set timeZone="local"
        const offset = newStart.getTimezoneOffset() * 60000;
        const localStart = new Date(newStart.getTime() - offset);
        const localEnd = new Date(newEnd.getTime() - offset);

        const dateStr = localStart.toISOString().split('T')[0];
        const startTimeStr = localStart.toISOString().slice(11, 16);
        const endTimeStr = localEnd.toISOString().slice(11, 16);

        const updatedActivities = activities.map(a =>
            a.id === event.id
                ? { ...a, date: dateStr, startTime: startTimeStr, endTime: endTimeStr }
                : a
        );

        try {
            await saveActivities(selectedTripId, updatedActivities);
            await refreshDb();
        } catch (e) {
            alert('일정 저장에 실패했습니다.');
            changeInfo.revert();
        }
    };

    // Handle creating a new event via click and drag on empty space
    const handleDateSelect = async (selectInfo) => {
        const title = prompt('새로운 일정 이름을 입력하세요:');
        const calendarApi = selectInfo.view.calendar;
        calendarApi.unselect(); // clear selection

        if (!title) return;

        const newStart = selectInfo.start;
        const newEnd = selectInfo.end;
        const offset = newStart.getTimezoneOffset() * 60000;
        const localStart = new Date(newStart.getTime() - offset);
        const localEnd = new Date(newEnd.getTime() - offset);

        const dateStr = localStart.toISOString().split('T')[0];
        const startTimeStr = localStart.toISOString().slice(11, 16);
        const endTimeStr = localEnd.toISOString().slice(11, 16);

        const newActivity = {
            id: generateId(),
            tripId: selectedTripId,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            title: title,
            departure: '',
            arrival: '',
            departureUrl: '',
            arrivalUrl: '',
            notes: ''
        };

        const updatedActivities = [...activities, newActivity];
        try {
            await saveActivities(selectedTripId, updatedActivities);
            await refreshDb();
        } catch (e) {
            alert('일정 생성에 실패했습니다.');
        }
    };

    return (
        <div className="calendar-page">
            <p className="calendar-instructions">
                💡 원하는 시간대를 드래그하여 새로운 일정을 추가하거나, 기존 일정을 드래그 앤 드롭으로 이동시킬 수 있어요!
            </p>
            <div className="calendar-container">
                <FullCalendar
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    initialDate={firstDate}
                    allDaySlot={false} // Focus on time-based scheduling
                    events={events}
                    editable={true} // Allow drag and resize
                    selectable={true} // Allow click and drag to select
                    selectMirror={true}
                    dayMaxEvents={true}
                    eventChange={handleEventChange} // Triggered on drag/resize end
                    select={handleDateSelect} // Triggered on empty slot selection
                    height="100%"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'timeGridWeek,timeGridDay'
                    }}
                    locale="ko" // Use Korean locale if possible
                />
            </div>
        </div>
    );
}
