import React from 'react';
import { Settings, Map as MapIcon, CalendarDays, ArrowLeft, LogOut } from 'lucide-react';

export default function Header({ currentView, onViewChange, onBackToTrips, selectedTripId, dbData, user, onSignOut }) {
    const currentTrip = dbData?.trips?.find(t => t.id === selectedTripId);

    return (
        <header className="header-glass">
            <div className="header-content">
                <div className="app-title" onClick={onBackToTrips} style={{ cursor: 'pointer' }}>
                    <MapIcon size={24} color="var(--primary)" />
                    {selectedTripId ? (
                        <div className="trip-context">
                            <span className="back-hint"><ArrowLeft size={16} /></span>
                            <span className="trip-title">{currentTrip?.title || 'DHJ 여행 일정표'}</span>
                        </div>
                    ) : 'DHJ 여행 일정표'}
                </div>
                <div className="nav-links">
                    <button
                        className={`btn ${currentView === 'itinerary' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => onViewChange('itinerary')}
                    >
                        <CalendarDays size={18} />
                        <span className="hidden-mobile">Itinerary</span>
                    </button>
                    <button
                        className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => onViewChange('admin')}
                    >
                        <Settings size={18} />
                        <span className="hidden-mobile">Manage</span>
                    </button>
                    {user && (
                        <button
                            className="btn btn-ghost"
                            onClick={onSignOut}
                            title={user.email || '로그아웃'}
                            aria-label={`로그아웃 (${user.email || ''})`}
                        >
                            <LogOut size={18} />
                            <span className="hidden-mobile user-email">{user.email}</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
