import React from 'react';
import './CalendarView.css';

export default function CalendarView({ dbData, selectedTripId }) {
    // 1. Filter activities for the selected trip
    const activities = dbData.activities.filter(a => a.tripId === selectedTripId);

    // 2. Identify unique dates and sort them
    const uniqueDates = [...new Set(activities.map(a => a.date))].filter(Boolean).sort();

    // 3. Generate hours for the Y-axis
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // 4. Helper to calculate position and height
    const getTimePosition = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60 + m) / (24 * 60) * 100;
    };

    const getActivityStyle = (start, end) => {
        const top = getTimePosition(start);
        const bottom = endTimePosition(end);
        return {
            top: `${top}%`,
            height: `${Math.max(bottom - top, 2)}%` // Minimum height to be visible
        };
    };

    const endTimePosition = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60 + m) / (24 * 60) * 100;
    };

    if (uniqueDates.length === 0) {
        return (
            <div className="calendar-empty">
                <h3>일정이 없습니다</h3>
                <p>Manage 페이지에서 일정을 추가해 주세요.</p>
            </div>
        );
    }

    return (
        <div className="calendar-container">
            <div className="calendar-grid-wrapper">
                {/* Time labels axis */}
                <div className="time-axis">
                    {hours.map(h => (
                        <div key={h} className="hour-label">
                            {String(h).padStart(2, '0')}:00
                        </div>
                    ))}
                </div>

                <div className="calendar-grid">
                    {/* Header showing dates */}
                    <div className="calendar-header">
                        {uniqueDates.map(date => (
                            <div key={date} className="date-column-header">
                                <div className="date-weekday">{new Date(date).toLocaleDateString('ko-KR', { weekday: 'short' })}</div>
                                <div className="date-day">{date.split('-')[2]}</div>
                            </div>
                        ))}
                    </div>

                    {/* Columns for each day */}
                    <div className="calendar-body">
                        {uniqueDates.map(date => (
                            <div key={date} className="date-column">
                                {/* Hour markers/lines */}
                                {hours.map(h => (
                                    <div key={h} className="hour-grid-line"></div>
                                ))}

                                {/* Activities markers */}
                                {activities
                                    .filter(a => a.date === date)
                                    .map(act => (
                                        <div
                                            key={act.id}
                                            className="calendar-activity-card"
                                            style={getActivityStyle(act.startTime, act.endTime)}
                                            title={`${act.startTime} - ${act.endTime}: ${act.title}`}
                                        >
                                            <div className="activity-title">{act.title}</div>
                                            <div className="activity-time">{act.startTime}</div>
                                        </div>
                                    ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
