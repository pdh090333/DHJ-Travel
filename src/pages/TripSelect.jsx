import { Plane, Calendar, ChevronRight, PlusCircle, Trash2 } from 'lucide-react';
import './TripSelect.css';

export default function TripSelect({ trips, onSelectTrip, onAddTrip, onDeleteTrip }) {
    return (
        <div className="trip-select-page">
            <div className="trip-select-header">
                <h1>여행지 선택</h1>
                <p>계획된 여행 목록에서 하나를 선택하거나 새로운 여행을 시작하세요.</p>
            </div>

            <div className="trip-grid">
                {trips.map(trip => (
                    <div key={trip.id} className="trip-card" onClick={() => onSelectTrip(trip.id)}>
                        <div className="trip-card-icon">
                            <Plane size={32} />
                        </div>
                        <div className="trip-card-content">
                            <h3>{trip.title}</h3>
                            <div className="trip-card-date">
                                <Calendar size={14} />
                                <span>{trip.startDate || '날짜 미정'} - {trip.endDate || '날짜 미정'}</span>
                            </div>
                        </div>
                        <div className="trip-card-actions">
                            <button
                                className="btn-icon danger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTrip(trip.id);
                                }}
                                title="Delete Trip"
                            >
                                <Trash2 size={20} />
                            </button>
                            <div className="trip-card-arrow">
                                <ChevronRight size={20} />
                            </div>
                        </div>
                    </div>
                ))}

                <button className="add-trip-card" onClick={onAddTrip}>
                    <PlusCircle size={32} />
                    <span>새로운 여행 추가</span>
                </button>
            </div>
        </div>
    );
}
