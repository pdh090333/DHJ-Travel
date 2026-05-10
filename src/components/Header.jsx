import React, { useState } from 'react';
import { Settings, Map as MapIcon, CalendarDays, ArrowLeft, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { getThemePreference, setThemePreference, THEME_CYCLE } from '../theme.js';

const THEME_LABEL = { auto: '자동', light: '라이트', dark: '다크' };

function ThemeToggle() {
    const [pref, setPref] = useState(getThemePreference);
    const next = THEME_CYCLE[pref];
    const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;

    const cycle = () => {
        setThemePreference(next);
        setPref(next);
    };

    return (
        <button
            className="btn btn-ghost"
            onClick={cycle}
            title={`테마: ${THEME_LABEL[pref]} (클릭하면 ${THEME_LABEL[next]})`}
            aria-label={`테마 전환 (현재: ${THEME_LABEL[pref]})`}
        >
            <Icon size={18} />
        </button>
    );
}

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
                        <span className="hidden-mobile">일정 보기</span>
                    </button>
                    <button
                        className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => onViewChange('admin')}
                    >
                        <Settings size={18} />
                        <span className="hidden-mobile">일정 수립</span>
                    </button>
                    <ThemeToggle />
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
