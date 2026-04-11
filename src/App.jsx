import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import ItineraryView from './pages/ItineraryView';
import AdminView from './pages/AdminView';
import { loadDB, ensureDefaultTrip } from './db';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('itinerary');
  const [dbData, setDbData] = useState({ trips: [], activities: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      await ensureDefaultTrip();
      const data = await loadDB();
      setDbData(data);
    } catch (err) {
      console.error('Failed to load data from Firebase:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshDb = async () => {
    try {
      const data = await loadDB();
      setDbData(data);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>여행 일정을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <Header currentView={currentView} onViewChange={setCurrentView} />
      <main className="container animate-slide-up">
        {currentView === 'itinerary' && (
          <ItineraryView dbData={dbData} />
        )}
        {currentView === 'admin' && (
          <AdminView dbData={dbData} refreshDb={refreshDb} />
        )}
      </main>
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
    </>
  );
}

export default App;
