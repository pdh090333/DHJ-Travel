import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ItineraryView from './pages/ItineraryView';
import AdminView from './pages/AdminView';
import TripSelect from './pages/TripSelect';
import LoginView from './pages/LoginView';
import { loadDB, ensureDefaultTrip, generateId, saveTrip, deleteTrip, DEFAULT_TAGS } from './db';
import { subscribeToAuth, signOutUser, isAllowedUser } from './auth';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('itinerary');
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [dbData, setDbData] = useState({ trips: [], activities: [], candidates: [] });
  const [loading, setLoading] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      if (!isAllowedUser(firebaseUser)) {
        // 비인가 이메일로 로그인 시도 → 즉시 로그아웃 + 에러 표시
        setAuthError('unauthorized');
        setUser(null);
        try {
          await signOutUser();
        } catch (e) {
          console.error('Sign out failed:', e);
        }
        setAuthReady(true);
        return;
      }
      setAuthError(null);
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    initApp();
  }, [user]);

  const reportBrokenActivities = (activities) => {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const broken = activities.filter(a => a.date && !ISO_DATE.test(a.date));
    if (broken.length > 0) {
      console.warn(`[Travel] ${broken.length}개의 활동에 잘못된 date 값이 있습니다 (Firebase Console에서 삭제하세요):`);
      broken.forEach(a => console.warn(`  • id=${a.id}  title="${a.title}"  date="${a.date}"`));
    }
  };

  const initApp = async () => {
    setLoading(true);
    try {
      await ensureDefaultTrip();
      const data = await loadDB();
      setDbData(data);
      reportBrokenActivities(data.activities);
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
      reportBrokenActivities(data.activities);
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
      endDate: '',
      tags: [...DEFAULT_TAGS]
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
      const { saveCandidate, deleteActivity } = await import('./db');
      await Promise.all([
        saveCandidate(newCandidate),
        deleteActivity(activityId)
      ]);
      await refreshDb();
    } catch (e) {
      console.error('Failed to unschedule activity:', e);
      alert('일정 취소 중 오류가 발생했습니다.');
      await refreshDb();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setSelectedTripId(null);
      setCurrentView('itinerary');
      setDbData({ trips: [], activities: [], candidates: [] });
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>인증 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        error={authError}
        onRetry={() => setAuthError(null)}
      />
    );
  }

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
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onBackToTrips={() => {
          setSelectedTripId(null);
          setCurrentView('itinerary');
        }}
        selectedTripId={selectedTripId}
        dbData={dbData}
        user={user}
        onSignOut={handleSignOut}
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
