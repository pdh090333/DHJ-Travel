import React, { useState, useEffect } from 'react';
import { Star, ExternalLink, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { resolveActivityColor, resolveTaxonomyColor, normalizeTags } from '../db';
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
    const [expandedCandidate, setExpandedCandidate] = useState(null);

    // ─── 위시리스트 지역별 그룹 ────────────────────────────
    // 순서는 Trip.areas 배열 순서를 따른다(가나다순 아님 — 사용자가 통제).
    // 지역 미지정은 맨 뒤로.
    const tripCandidates = (dbData.candidates || []).filter(c => c.tripId === selectedTripId);
    const tripAreas = normalizeTags(currentTrip?.areas);
    const candidateGroups = [
        ...tripAreas.map(a => ({
            key: a.name,
            name: a.name,
            color: a.color,
            items: tripCandidates.filter(c => c.area === a.name)
        })),
        {
            key: '__none__',
            name: '지역 없음',
            color: null,
            // 지역이 비었거나, 삭제된 지역을 참조 중인 것도 여기로 모은다
            items: tripCandidates.filter(c => !tripAreas.some(a => a.name === c.area))
        }
    ].filter(g => g.items.length > 0);

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
        const tagColor = resolveActivityColor(activity, currentTrip?.tags);
        const cardStyle = tagColor ? { '--activity-color': tagColor } : undefined;
        return (
        <div key={activity.id} className="timeline-item">
            <div className="time-block">
                <span>{activity.startTime}</span>
                <span className="time-separator">-</span>
                <span>{activity.endTime}</span>
            </div>
            <div className="activity-card" style={cardStyle}>
                <h3>
                    {activity.tag && <span className="activity-tag">{activity.tag}</span>}
                    {activity.title}
                </h3>

                <div className="locations-wrapper">
                    {hasDeparture && (
                        <div className={`location-info${eff.inherited ? ' location-inherited' : ''}`}>
                            <span className="location-label">출발: </span>
                            <a href={eff.departureUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eff.departure)}`} target="_blank" rel="noopener noreferrer" className="location-link">
                                📍 {eff.departure}
                                {eff.inherited && <span className="inherited-tag" title="직전 일정의 도착지에서 이어짐"> (직전 도착지)</span>}
                            </a>
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

            {tripCandidates.length > 0 && (
                <div className="wishlist-section">
                    <div className="wishlist-header">
                        <Star size={20} className="wishlist-icon" />
                        <h2>가고 싶은 곳 (Wishlist)</h2>
                        <span className="wishlist-count">{tripCandidates.length}곳</span>
                    </div>

                    {candidateGroups.map(group => (
                        <section key={group.key} className="wishlist-group">
                            <h3
                                className="wishlist-group-header"
                                style={group.color ? { '--area-color': group.color } : undefined}
                            >
                                <span className="wishlist-group-name">{group.name}</span>
                                <span className="wishlist-group-count">{group.items.length}</span>
                            </h3>
                            <ul className="wishlist-list">
                                {group.items.map(candidate => {
                                    const tagColor = resolveActivityColor(candidate, currentTrip?.tags);
                                    const open = expandedCandidate === candidate.id;
                                    const hasDetail = !!(candidate.imageUrl || candidate.notes);
                                    return (
                                        <li
                                            key={candidate.id}
                                            className="wishlist-row"
                                            style={tagColor ? { '--activity-color': tagColor } : undefined}
                                        >
                                            <div className="wishlist-row-main">
                                                <button
                                                    type="button"
                                                    className="wishlist-row-toggle"
                                                    onClick={() => setExpandedCandidate(open ? null : candidate.id)}
                                                    aria-expanded={open}
                                                    title={hasDetail ? (open ? '접기' : '사진·메모 보기') : '상세 정보 없음'}
                                                >
                                                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    {candidate.tag && <span className="activity-tag">{candidate.tag}</span>}
                                                    <span className="wishlist-row-title">{candidate.title}</span>
                                                </button>
                                                {candidate.area && (
                                                    <span
                                                        className="wishlist-area-badge"
                                                        style={{ background: resolveTaxonomyColor(candidate.area, currentTrip?.areas) || 'var(--text-secondary)' }}
                                                    >{candidate.area}</span>
                                                )}
                                                {candidate.url && (
                                                    <a href={candidate.url} target="_blank" rel="noopener noreferrer"
                                                       className="wishlist-link" title="지도에서 보기">
                                                        <ExternalLink size={15} />
                                                    </a>
                                                )}
                                            </div>
                                            {open && hasDetail && (
                                                <div className="wishlist-row-detail">
                                                    {candidate.imageUrl && (
                                                        <div className="wishlist-thumbnail-card">
                                                            <img src={candidate.imageUrl} alt={candidate.title} />
                                                        </div>
                                                    )}
                                                    {candidate.notes && <p className="wishlist-notes">{candidate.notes}</p>}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
