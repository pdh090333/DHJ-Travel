import React from 'react';
import { Settings, Map as MapIcon, CalendarDays } from 'lucide-react';

export default function Header({ currentView, onViewChange }) {
    return (
        <header className="header-glass">
            <div className="header-content">
                <div className="app-title" onClick={() => onViewChange('itinerary')} style={{ cursor: 'pointer' }}>
                    <MapIcon size={24} color="var(--primary)" />
                    DHJ 여행 계획표
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
                        className={`btn ${currentView === 'admin' ? 'active' : 'btn-ghost'}`}
                        onClick={() => onViewChange('admin')}
                    >
                        <Settings size={18} />
                        <span className="hidden-mobile">Manage</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
