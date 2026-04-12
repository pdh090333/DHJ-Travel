import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import ItineraryView from './pages/ItineraryView';
import AdminView from './pages/AdminView';
import TripSelect from './pages/TripSelect';
import { loadDB, ensureDefaultTrip, generateId, saveTrip, deleteTrip } from './db';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('itinerary');
  const [selectedTripId, setSelectedTripId] = useState(null);
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

  const handleSelectTrip = (tripId) => {
    setSelectedTripId(tripId);
    setCurrentView('itinerary');
  };

  const handleAddTrip = async () => {
    const title = prompt('새로운 여행 이름을 입력하세요:', '2025 새로운 여행');
    if (!title) return;

    const newTrip = {
      id: generateId(),
      title,
      startDate: '',
      endDate: ''
    };

    try {
      await saveTrip(newTrip);
      await refreshDb();
      setSelectedTripId(newTrip.id);
      setCurrentView('itinerary');
    } catch (e) {
      alert('여행 추가 실패: ' + e.message);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!confirm('정말로 이 여행과 관련된 모든 일정을 삭제하시겠습니까?')) return;
    try {
      await deleteTrip(tripId);
      await refreshDb();
      if (selectedTripId === tripId) setSelectedTripId(null);
    } catch (e) {
      alert('여행 삭제 실패: ' + e.message);
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

  const enrichedTrips = useMemo(() => {
    return dbData.trips.map(trip => {
      const tripActivities = dbData.activities.filter(a => a.tripId === trip.id && a.date);
      if (tripActivities.length === 0) {
        return { ...trip, startDate: '', endDate: '' };
      }

      const dates = tripActivities.map(a => a.date).sort();
      return {
        ...trip,
        startDate: dates[0],
        endDate: dates[dates.length - 1]
      };
    });
  }, [dbData.trips, dbData.activities]);

  const showTripSelect = !selectedTripId && (currentView === 'itinerary' || currentView === 'calendar');

  return (
    <>
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onBackToTrips={() => {
          setSelectedTripId(null);
          setCurrentView('itinerary');
        }}
        selectedTripId={selectedTripId}
        dbData={dbData}
      />
      <main className="container animate-slide-up">
        {showTripSelect && (
          <TripSelect
            trips={enrichedTrips}
            onSelectTrip={handleSelectTrip}
            onAddTrip={handleAddTrip}
          />
        )}
        {!showTripSelect && currentView === 'itinerary' && (
          <ItineraryView dbData={dbData} selectedTripId={selectedTripId} />
        )}
        {!showTripSelect && currentView === 'admin' && (
          <AdminView dbData={dbData} refreshDb={refreshDb} selectedTripId={selectedTripId} />
        )}
      </main>
    </>
  );
}

export default App;
