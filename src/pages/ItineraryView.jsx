import React, { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import './ItineraryView.css';

export default function ItineraryView({ dbData, selectedTripId }) {
    const currentTrip = dbData.trips.find(t => t.id === selectedTripId);
    const tripActivities = dbData.activities.filter(a => a.tripId === selectedTripId);

    // Sort unique dates from activities
    const uniqueDates = [...new Set(tripActivities.map(a => a.date))].sort();
    const [selectedDate, setSelectedDate] = useState(uniqueDates[0] || null);

    // Auto-select first date if current selection is not in the new list
    React.useEffect(() => {
        if (uniqueDates.length > 0 && (!selectedDate || !uniqueDates.includes(selectedDate))) {
            setSelectedDate(uniqueDates[0]);
        }
    }, [uniqueDates, selectedDate]);

    const filteredActivities = tripActivities
        .filter(a => a.date === selectedDate)
        .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));

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

        // Calculate dynamic timestamp if date and time are available
        if (activity.date && activity.startTime) {
            const [yr, mo, dy] = activity.date.split('-').map(Number);
            const [hr, mn] = activity.startTime.split(':').map(Number);

            // Generate Google Maps internal timestamp (!8j):
            // It represents seconds from epoch at UTC midnight of the date + local seconds of day.
            const timestamp = Math.floor(Date.UTC(yr, mo - 1, dy) / 1000) + hr * 3600 + mn * 60;

            // Use the advanced URL format which supports the !8j (departure time) parameter
            // This works with both coords (47.123,130.456) and place names.
            return `https://www.google.com/maps/dir/${encodeURIComponent(originParam)}/${encodeURIComponent(destParam)}/am=t/data=!3m1!4b1!4m5!4m4!2m3!6e0!7e2!8j${timestamp}`;
        }

        // Fallback: standard API URL without time if data is incomplete
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

            {dbData.candidates && dbData.candidates.filter(c => c.tripId === selectedTripId).length > 0 && (
                <div className="wishlist-section">
                    <div className="wishlist-header">
                        <Star size={20} className="wishlist-icon" />
                        <h2>가고 싶은 곳 (Wishlist)</h2>
                    </div>
                    <div className="wishlist-grid">
                        {dbData.candidates
                            .filter(c => c.tripId === selectedTripId)
                            .map(candidate => (
                                <div key={candidate.id} className="wishlist-card">
                                    <div className="wishlist-card-content">
                                        <h4>{candidate.title}</h4>
                                        {candidate.notes && <p className="wishlist-notes">{candidate.notes}</p>}
                                    </div>
                                    {candidate.url && (
                                        <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="wishlist-link">
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
