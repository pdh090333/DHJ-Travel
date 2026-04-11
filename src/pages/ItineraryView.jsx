import React, { useState } from 'react';
import './ItineraryView.css';

export default function ItineraryView({ dbData }) {
    // Sort unique dates from activities
    const uniqueDates = [...new Set(dbData.activities.map(a => a.date))].sort();
    const [selectedDate, setSelectedDate] = useState(uniqueDates[0] || null);

    const filteredActivities = dbData.activities
        .filter(a => a.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return (
        <div className="itinerary-page">
            <div className="date-selector">
                {uniqueDates.map(date => (
                    <button
                        key={date}
                        className={`btn ${selectedDate === date ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSelectedDate(date)}
                    >
                        {date}
                    </button>
                ))}
            </div>

            <div className="timeline-container">
                {filteredActivities.length === 0 ? (
                    <p>No activities planned for this date.</p>
                ) : (
                    filteredActivities.map(activity => (
                        <div key={activity.id} className="timeline-item">
                            <div className="time-block">
                                <span>{activity.startTime}</span>
                                <span className="time-separator">-</span>
                                <span>{activity.endTime}</span>
                            </div>
                            <div className="activity-card">
                                <h3>{activity.title}</h3>

                                <div className="locations-wrapper">
                                    {activity.departure && (
                                        <div className="location-info">
                                            <span className="location-label">출발: </span>
                                            <a href={activity.departureUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.departure)}`} target="_blank" rel="noopener noreferrer" className="location-link">📍 {activity.departure}</a>
                                        </div>
                                    )}

                                    {activity.arrival && (
                                        <div className="location-info">
                                            <span className="location-label">도착: </span>
                                            <a href={activity.arrivalUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.arrival)}`} target="_blank" rel="noopener noreferrer" className="location-link">📍 {activity.arrival}</a>
                                        </div>
                                    )}
                                </div>

                                {activity.notes && <p className="notes">{activity.notes}</p>}

                                {(activity.departure || activity.arrival) && (
                                    <div className="map-toggle-wrapper">
                                        <a
                                            className="btn btn-ghost map-toggle-btn"
                                            href={
                                                (activity.departure && activity.arrival)
                                                    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(activity.departure)}&destination=${encodeURIComponent(activity.arrival)}`
                                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.arrival || activity.departure)}`
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {(activity.departure && activity.arrival) ? '🗺️ 길찾기 보기' : '🗺️ 지도 보기'}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
