import React, { useState, useEffect } from 'react';
import { Star, ExternalLink, Calendar, Info } from 'lucide-react';
import './ItineraryView.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const getDateRange = (start, end) => {
    if (!start || !end) return [];
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const startMs = Date.UTC(sy, sm - 1, sd);
    const endMs = Date.UTC(ey, em - 1, ed);
    if (endMs < startMs) return [];
    const dates = [];
    for (let ms = startMs; ms <= endMs; ms += 86400000) {
        const d = new Date(ms);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
};

const formatMonthDay = (dateStr) => {
    if (!dateStr) return '';
    const [, m, d] = dateStr.split('-').map(Number);
    return `${m}/${d}`;
};

const formatWeekday = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};

export default function ItineraryView({ dbData, selectedTripId }) {
    const currentTrip = dbData.trips.find(t => t.id === selectedTripId);
    const tripActivities = dbData.activities.filter(a => a.tripId === selectedTripId);

    // Filter to ISO YYYY-MM-DD; fragile CSV import can leave non-date
    // strings (e.g. URLs) in `date`.
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const tripDates = getDateRange(currentTrip?.startDate, currentTrip?.endDate);
    const activityDates = [...new Set(tripActivities.map(a => a.date).filter(d => d && ISO_DATE.test(d)))].sort();
    const allDates = tripDates.length > 0 ? tripDates : activityDates;

    const [selectedDate, setSelectedDate] = useState('all');

    useEffect(() => {
        if (selectedDate !== 'all' && !allDates.includes(selectedDate)) {
            setSelectedDate('all');
        }
    }, [allDates, selectedDate]);

    const sortByTime = (a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    const activitiesByDate = allDates.map(date => ({
        date,
        activities: tripActivities.filter(a => a.date === date).sort(sortByTime)
    }));
    const visibleDays = selectedDate === 'all'
        ? activitiesByDate
        : activitiesByDate.filter(d => d.date === selectedDate);

    const totalDays = tripDates.length;

    // Predecessor lookup: globally sort by (date, startTime) so the
    // previous activity's arrival can fill in an empty `departure`.
    // Crosses day boundaries naturally — Day 2 morning chains from Day 1 night.
    const globalSorted = [...tripActivities]
        .filter(a => a.date && ISO_DATE.test(a.date))
        .sort((a, b) => a.date.localeCompare(b.date) || sortByTime(a, b));
    const predecessorMap = new Map();
    for (let i = 1; i < globalSorted.length; i++) {
        const prev = globalSorted[i - 1];
        if (prev.arrival) predecessorMap.set(globalSorted[i].id, prev);
    }
    const getEffectiveDeparture = (activity) => {
        if (activity.departure) {
            return { departure: activity.departure, departureUrl: activity.departureUrl, inherited: false };
        }
        const prev = predecessorMap.get(activity.id);
        if (prev) {
            return { departure: prev.arrival, departureUrl: prev.arrivalUrl, inherited: true };
        }
        return { departure: '', departureUrl: '', inherited: false };
    };

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

    const buildDirectionsUrl = (activity, effDeparture) => {
        const originParam = getLocationParam(effDeparture.departure, effDeparture.departureUrl);
        const destParam = getLocationParam(activity.arrival, activity.arrivalUrl);

        if (activity.date && activity.startTime) {
            const [yr, mo, dy] = activity.date.split('-').map(Number);
            const [hr, mn] = activity.startTime.split(':').map(Number);

            // Generate Google Maps internal timestamp (!8j):
            // It represents seconds from epoch at UTC midnight of the date + local seconds of day.
            const timestamp = Math.floor(Date.UTC(yr, mo - 1, dy) / 1000) + hr * 3600 + mn * 60;

            return `https://www.google.com/maps/dir/${encodeURIComponent(originParam)}/${encodeURIComponent(destParam)}/am=t/data=!3m1!4b1!4m5!4m4!2m3!6e0!7e2!8j${timestamp}`;
        }

        return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`;
    };

    const renderActivity = (activity) => {
        const eff = getEffectiveDeparture(activity);
        const hasDeparture = !!eff.departure;
        const hasArrival = !!activity.arrival;
        const cardStyle = activity.color ? { '--activity-color': activity.color } : undefined;
        return (
        <div key={activity.id} className="timeline-item">
            <div className="time-block">
                <span>{activity.startTime}</span>
                <span className="time-separator">-</span>
                <span>{activity.endTime}</span>
            </div>
            <div className="activity-card" style={cardStyle}>
                <h3>{activity.title}</h3>

                <div className="locations-wrapper">
                    {hasDeparture && (
                        <div className={`location-info${eff.inherited ? ' location-inherited' : ''}`}>
                            <span className="location-label">출발: </span>
                            <a href={eff.departureUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eff.departure)}`} target="_blank" rel="noopener noreferrer" className="location-link">
                                📍 {eff.departure}
                                {eff.inherited && <span className="inherited-tag" title="직전 일정의 도착지에서 이어짐"> (직전 도착지)</span>}
                            </a>
                            <span
                                className="location-info-icon"
                                title="출발지를 비워두면 직전 일정의 도착지가 자동으로 출발지로 사용되어 길찾기가 됩니다."
                                aria-label="출발지를 비워두면 직전 일정의 도착지가 자동으로 출발지로 사용되어 길찾기가 됩니다."
                            >
                                <Info size={14} />
                            </span>
                        </div>
                    )}

                    {hasArrival && (
                        <div className="location-info">
                            <span className="location-label">도착: </span>
                            <a href={activity.arrivalUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.arrival)}`} target="_blank" rel="noopener noreferrer" className="location-link">📍 {activity.arrival}</a>
                        </div>
                    )}
                </div>

                {activity.imageUrl && (
                    <div className="activity-image-wrapper">
                        <img src={activity.imageUrl} alt={activity.title} className="activity-image" />
                    </div>
                )}

                {activity.notes && <p className="notes">{activity.notes}</p>}

                <div className="activity-meta-actions">
                    {(hasDeparture || hasArrival) && (
                        <a
                            className="btn btn-ghost action-btn"
                            href={
                                (hasDeparture && hasArrival)
                                    ? buildDirectionsUrl(activity, eff)
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLocationParam(activity.arrival || eff.departure, activity.arrivalUrl || eff.departureUrl))}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            🗺️ {(hasDeparture && hasArrival) ? '길찾기' : '지도 보기'}
                        </a>
                    )}

                    {activity.reviewUrl && (
                        <a
                            className="btn btn-ghost action-btn"
                            href={activity.reviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ⭐ 구글 리뷰
                        </a>
                    )}
                </div>
            </div>
        </div>
        );
    };

    return (
        <div className="itinerary-page">
            {currentTrip && (currentTrip.startDate || currentTrip.endDate) && (
                <div className="trip-overview-banner">
                    <h1 className="trip-overview-title">{currentTrip.title}</h1>
                    <div className="trip-overview-period">
                        <Calendar size={16} />
                        <span className="trip-overview-dates">
                            {currentTrip.startDate
                                ? `${formatMonthDay(currentTrip.startDate)} (${formatWeekday(currentTrip.startDate)})`
                                : '시작일 미정'}
                            <span className="trip-overview-arrow"> → </span>
                            {currentTrip.endDate
                                ? `${formatMonthDay(currentTrip.endDate)} (${formatWeekday(currentTrip.endDate)})`
                                : '종료일 미정'}
                        </span>
                        {totalDays > 0 && <span className="trip-overview-days">총 {totalDays}일</span>}
                    </div>
                </div>
            )}

            {allDates.length > 0 && (
                <div className="date-selector">
                    <button
                        className={`btn date-btn ${selectedDate === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSelectedDate('all')}
                    >
                        <span className="date-btn-day">전체</span>
                        <span className="date-btn-date">{allDates.length}일</span>
                    </button>
                    {allDates.map((date, idx) => (
                        <button
                            key={date}
                            className={`btn date-btn ${selectedDate === date ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setSelectedDate(date)}
                        >
                            <span className="date-btn-day">Day {idx + 1}</span>
                            <span className="date-btn-date">{formatMonthDay(date)} ({formatWeekday(date)})</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="days-container">
                {visibleDays.length === 0 ? (
                    <p className="no-activities-empty">여행 기간을 설정하거나 일정을 추가하세요.</p>
                ) : (
                    visibleDays.map(({ date, activities }) => {
                        const dayIdx = allDates.indexOf(date);
                        return (
                            <section key={date} className="day-section">
                                {selectedDate === 'all' && (
                                    <div className="day-section-header">
                                        <span className="day-section-day">Day {dayIdx + 1}</span>
                                        <span className="day-section-date">
                                            {formatMonthDay(date)} ({formatWeekday(date)})
                                        </span>
                                    </div>
                                )}
                                {activities.length === 0 ? (
                                    <p className="no-activities">일정 없음</p>
                                ) : (
                                    <div className="timeline-container">
                                        {activities.map(renderActivity)}
                                    </div>
                                )}
                            </section>
                        );
                    })
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
                                        {candidate.imageUrl && (
                                            <div className="wishlist-thumbnail-card">
                                                <img src={candidate.imageUrl} alt={candidate.title} />
                                            </div>
                                        )}
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
