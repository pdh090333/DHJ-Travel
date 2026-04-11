import React from 'react';

// Bottom navigation for mobile (optional depending on design, maybe header is enough)
// The user requested multi-platform, so mobile navigation bar at bottom is standard UX.
import { CalendarDays, Settings } from 'lucide-react';
import './Navigation.css';

export default function Navigation({ currentView, onViewChange }) {
    return (
        <nav className="bottom-nav">
            <button
                className={`nav-item ${currentView === 'itinerary' ? 'active' : ''}`}
                onClick={() => onViewChange('itinerary')}
            >
                <CalendarDays size={24} />
                <span>Plan</span>
            </button>
            <button
                className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
                onClick={() => onViewChange('admin')}
            >
                <Settings size={24} />
                <span>Data</span>
            </button>
        </nav>
    );
}
