import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ActivityModal from '../components/ActivityModal';
import { saveActivities, generateId, deleteCandidate, saveCandidate } from '../db';
import './CalendarView.css';

export default function CalendarView({ dbData, selectedTripId, refreshDb }) {
    const [selectedActivity, setSelectedActivity] = useState(null);
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
            extendedProps: act // store original activity data to use on click
        };
    }).filter(e => e.start);

    // 1. Drag and drop moving/resizing
    const handleEventChange = async (changeInfo) => {
        const { event } = changeInfo;
        const newStart = event.start;
        const newEnd = event.end || new Date(newStart.getTime() + 60 * 60 * 1000);

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

    // 2. Click existing activity to open modal
    const handleEventClick = (clickInfo) => {
        const existingActivity = clickInfo.event.extendedProps;
        setSelectedActivity(existingActivity);
    };

    // 3. Select empty slot to open modal for creation
    const handleDateSelect = (selectInfo) => {
        const calendarApi = selectInfo.view.calendar;
        calendarApi.unselect();

        const newStart = selectInfo.start;
        const newEnd = selectInfo.end;
        const offset = newStart.getTimezoneOffset() * 60000;
        const localStart = new Date(newStart.getTime() - offset);
        const localEnd = new Date(newEnd.getTime() - offset);

        const dateStr = localStart.toISOString().split('T')[0];
        const startTimeStr = localStart.toISOString().slice(11, 16);
        const endTimeStr = localEnd.toISOString().slice(11, 16);

        // Pre-fill a new draft activity
        setSelectedActivity({
            id: `new_${generateId()}`,
            tripId: selectedTripId,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            title: '',
            departure: '',
            arrival: '',
            departureUrl: '',
            arrivalUrl: '',
            notes: ''
        });
    };

    // 4. Modal Handlers
    const handleSaveModal = async (editedActivity) => {
        let updatedActivities;
        if (editedActivity.id.startsWith('new_')) {
            // Remove 'new_' prefix 
            const finalActivity = { ...editedActivity, id: editedActivity.id.replace('new_', '') };
            updatedActivities = [...activities, finalActivity];
        } else {
            updatedActivities = activities.map(a => a.id === editedActivity.id ? editedActivity : a);
        }

        try {
            await saveActivities(selectedTripId, updatedActivities);
            await refreshDb();
            setSelectedActivity(null);
        } catch (e) {
            alert('일정 저장에 실패했습니다.');
        }
    };

    const handleDeleteModal = async (idOfActivity) => {
        if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
        const updatedActivities = activities.filter(a => a.id !== idOfActivity);
        try {
            await saveActivities(selectedTripId, updatedActivities);
            await refreshDb();
            setSelectedActivity(null);
        } catch (e) {
            alert('일정 삭제에 실패했습니다.');
        }
    };

    const handleEventReceive = async (info) => {
        const { event } = info;
        const candidateData = event.extendedProps;

        const newStart = event.start;
        const newEnd = event.end || new Date(newStart.getTime() + 60 * 60 * 1000);
        const offset = newStart.getTimezoneOffset() * 60000;
        const localStart = new Date(newStart.getTime() - offset);
        const localEnd = new Date(newEnd.getTime() - offset);

        const dateStr = localStart.toISOString().split('T')[0];
        const startTimeStr = localStart.toISOString().slice(11, 16);
        const endTimeStr = localEnd.toISOString().slice(11, 16);

        const newActivity = {
            id: generateId(),
            tripId: selectedTripId,
            title: candidateData.title,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            departure: candidateData.departure || '',
            arrival: candidateData.arrival || candidateData.title,
            departureUrl: candidateData.departureUrl || '',
            arrivalUrl: candidateData.arrivalUrl || candidateData.url || '',
            notes: candidateData.notes || ''
        };

        try {
            // 1. Add as activity
            await saveActivities(selectedTripId, [...activities, newActivity]);
            // 2. Remove from candidates
            await deleteCandidate(candidateData.id);
            await refreshDb();
        } catch (e) {
            alert('일정 전환에 실패했습니다.');
            event.remove();
        }
    };

    const handleMoveToCandidates = async (activityData) => {
        if (!window.confirm('이 일정을 후보지(Wishlist)로 옮기시겠습니까?')) return;

        const candidate = {
            id: generateId(),
            tripId: selectedTripId,
            title: activityData.title,
            url: activityData.arrivalUrl || activityData.departureUrl || '',
            notes: activityData.notes || ''
        };

        const updatedActivities = activities.filter(a => a.id !== activityData.id);

        try {
            // 1. Save as candidate
            await saveCandidate(candidate);
            // 2. Remove from activities
            await saveActivities(selectedTripId, updatedActivities);
            await refreshDb();
            setSelectedActivity(null);
        } catch (e) {
            alert('후보지 이동에 실패했습니다.');
        }
    };

    return (
        <div className="calendar-page">
            <p className="calendar-instructions">
                💡 원하는 시간대를 드래그하거나 기존 일정을 클릭하여 구체적인 계획을 입력하세요!
            </p>
            <div className="calendar-container">
                <FullCalendar
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    initialDate={firstDate}
                    allDaySlot={false}
                    events={events}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    dayMaxEvents={true}
                    eventChange={handleEventChange}
                    eventClick={handleEventClick}
                    select={handleDateSelect}
                    eventReceive={handleEventReceive}
                    droppable={true}
                    height="100%"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'timeGridWeek,timeGridDay'
                    }}
                    locale="ko"
                />
            </div>

            {selectedActivity && (
                <ActivityModal
                    activity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                    onSave={handleSaveModal}
                    onDelete={handleDeleteModal}
                    onMoveToCandidates={handleMoveToCandidates}
                />
            )}
        </div>
    );
}
