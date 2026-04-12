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
  const [dbData, setDbData] = useState({ trips: [], activities: [], candidates: [] });
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

  const handleUnscheduleActivity = async (tripId, activityId) => {
    // Optimistic Update: Remove from activities and add to candidates locally
    const activityToMove = dbData.activities.find(a => a.id === activityId);
    if (!activityToMove) return;

    const newCandidate = {
      id: generateId(),
      tripId,
      title: activityToMove.title,
      url: activityToMove.arrivalUrl || activityToMove.departureUrl || '',
      notes: activityToMove.notes || ''
    };

    setDbData(prev => ({
      ...prev,
      activities: prev.activities.filter(a => a.id !== activityId),
      candidates: [...prev.candidates, newCandidate]
    }));

    try {
      // Background DB operations
      const { saveCandidate, saveActivities } = await import('./db');
      await saveCandidate(newCandidate);
      const remainingActivities = dbData.activities.filter(a => a.id !== activityId);
      await saveActivities(tripId, remainingActivities);
      // Final sync to be sure
      await refreshDb();
    } catch (e) {
      console.error('Failed to unschedule activity:', e);
      alert('일정 취소 중 오류가 발생했습니다.');
      await refreshDb(); // Revert on failure
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

  const showTripSelect = !selectedTripId;

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
        {currentView === 'admin' ? (
          <AdminView
            dbData={dbData}
            refreshDb={refreshDb}
            selectedTripId={selectedTripId}
            onUnschedule={handleUnscheduleActivity}
          />
        ) : (
          !selectedTripId ? (
            <TripSelect
              trips={dbData.trips}
              onSelectTrip={handleSelectTrip}
              onAddTrip={handleAddTrip}
            />
          ) : (
            <ItineraryView dbData={dbData} selectedTripId={selectedTripId} />
          )
        )}
      </main>
    </>
  );
}

export default App;
