import React, { useState } from 'react';
import './ItineraryView.css';

export default function ItineraryView({ dbData }) {
    // Sort unique dates from activities
    const uniqueDates = [...new Set(dbData.activities.map(a => a.date))].sort();
    const [selectedDate, setSelectedDate] = useState(uniqueDates[0] || null);
    const filteredActivities = dbData.activities
        .filter(a => a.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const getLocationParam = (name, url) => {
        if (!url) return name;

        // 1. Try !3d and !4d (common in shared full URLs)
        const d3match = url.match(/!3d(-?\d+\.\d+)/);
        const d4match = url.match(/!4d(-?\d+\.\d+)/);
        if (d3match && d4match) return `${d3match[1]},${d4match[1]}`;

        // 2. Try @lat,lng
        const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) return `${coordMatch[1]},${coordMatch[2]}`;

        // 3. Try q=lat,lng
        const qCoordMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qCoordMatch) return `${qCoordMatch[1]},${qCoordMatch[2]}`;

        // 4. Try extract place name from /place/Name/
        const placeMatch = url.match(/\/place\/([^/]+)/);
        if (placeMatch) return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));

        return name;
    };

    const buildDirectionsUrl = (activity) => {
        const originParam = getLocationParam(activity.departure, activity.departureUrl);
        const destParam = getLocationParam(activity.arrival, activity.arrivalUrl);
        const isCoord = (s) => /^-?\d+\.\d+,-?\d+\.\d+$/.test(s);

        // If both are coordinates AND a date/time is set, use the working timestamp format
        if (isCoord(originParam) && isCoord(destParam) && activity.date && activity.startTime) {
            const timestamp = Math.floor(new Date(`${activity.date}T${activity.startTime}:00`).getTime() / 1000);
            return `https://www.google.com/maps/dir/${originParam}/${destParam}/am=t/data=!3m1!4b1!4m5!4m4!2m3!6e0!7e2!8j${timestamp}`;
        }

        // Fallback: standard API URL (no departure time, text or single-coord)
        return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`;
    };

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
                                                    ? buildDirectionsUrl(activity)
                                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLocationParam(activity.arrival || activity.departure, activity.arrivalUrl || activity.departureUrl))}`
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
