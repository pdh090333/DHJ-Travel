import { CalendarDays, Settings, Clock } from 'lucide-react';
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
                className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
                onClick={() => onViewChange('calendar')}
            >
                <Clock size={24} />
                <span>Timeline</span>
            </button>
            <button
                className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
                onClick={() => onViewChange('admin')}
            >
                <Settings size={24} />
                <span>Manage</span>
            </button>
        </nav>
    );
}
