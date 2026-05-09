// Database layer using Firebase Firestore
//
// Schema:
// Trip = { id, title, startDate, endDate }
// Activity = { id, tripId, date, startTime, endTime, title, departure, arrival, departureUrl, arrivalUrl, notes }
// Candidate = { id, tripId, title, url, notes, imageUrl }

import {
    collection, getDocs, doc, setDoc, deleteDoc,
    writeBatch, query, where
} from 'firebase/firestore';
import { db } from './firebase';

const TRIPS_COL = 'trips';
const ACTIVITIES_COL = 'activities';
const CANDIDATES_COL = 'candidates';

export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
};

// ─── Load ──────────────────────────────────────────────
export const loadDB = async () => {
    const [tripsSnap, activitiesSnap, candidatesSnap] = await Promise.all([
        getDocs(collection(db, TRIPS_COL)),
        getDocs(collection(db, ACTIVITIES_COL)),
        getDocs(collection(db, CANDIDATES_COL))
    ]);

    const trips = tripsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activities = activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { trips, activities, candidates };
};

// ─── Activity: single-doc ops (preferred) ──────────────
export const saveActivity = async (activity) => {
    if (!activity?.id) throw new Error('saveActivity: id required');
    if (!activity?.tripId) throw new Error('saveActivity: tripId required');
    await setDoc(doc(db, ACTIVITIES_COL, activity.id), activity);
};

export const deleteActivity = async (activityId) => {
    await deleteDoc(doc(db, ACTIVITIES_COL, activityId));
};

// Bulk replace all activities for a single trip. Use only for true bulk
// operations like CSV import — never for editing a single activity.
export const replaceTripActivities = async (tripId, activities) => {
    if (!tripId) throw new Error('replaceTripActivities: tripId required');

    const q = query(collection(db, ACTIVITIES_COL), where('tripId', '==', tripId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(d => batch.delete(d.ref));

    activities.forEach(act => {
        const ref = doc(db, ACTIVITIES_COL, act.id);
        batch.set(ref, { ...act, tripId });
    });

    await batch.commit();
};

// ─── Trip ──────────────────────────────────────────────
export const saveTrip = async (trip) => {
    await setDoc(doc(db, TRIPS_COL, trip.id), trip);
};

export const deleteTrip = async (tripId) => {
    const [actsSnap, candsSnap] = await Promise.all([
        getDocs(query(collection(db, ACTIVITIES_COL), where('tripId', '==', tripId))),
        getDocs(query(collection(db, CANDIDATES_COL), where('tripId', '==', tripId)))
    ]);

    const batch = writeBatch(db);
    batch.delete(doc(db, TRIPS_COL, tripId));
    actsSnap.docs.forEach(d => batch.delete(d.ref));
    candsSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
};

// ─── Candidates ────────────────────────────────────────
export const saveCandidate = async (candidate) => {
    await setDoc(doc(db, CANDIDATES_COL, candidate.id), candidate);
};

export const deleteCandidate = async (candidateId) => {
    await deleteDoc(doc(db, CANDIDATES_COL, candidateId));
};

// ─── Bootstrap ─────────────────────────────────────────
export const ensureDefaultTrip = async () => {
    const snap = await getDocs(collection(db, TRIPS_COL));
    if (snap.empty) {
        const tripId = generateId();
        const trip = {
            id: tripId,
            title: '첫 번째 여행',
            startDate: '',
            endDate: ''
        };
        await saveTrip(trip);
        return tripId;
    }
    return snap.docs[0].id;
};

// ─── CSV Export ────────────────────────────────────────
export const exportToCSV = (activities) => {
    const headers = ['date', 'startTime', 'endTime', 'title', 'departure', 'arrival', 'departureUrl', 'arrivalUrl', 'notes'];
    const rows = activities.map(act => [
        act.date,
        act.startTime,
        act.endTime,
        `"${(act.title || '').replace(/"/g, '""')}"`,
        `"${(act.departure || '').replace(/"/g, '""')}"`,
        `"${(act.arrival || '').replace(/"/g, '""')}"`,
        `"${(act.departureUrl || '').replace(/"/g, '""')}"`,
        `"${(act.arrivalUrl || '').replace(/"/g, '""')}"`,
        `"${(act.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "itinerary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ─── CSV Import ────────────────────────────────────────
export const parseCSV = (csvText, tripId) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const activities = [];
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        if (row.length < 4) continue;
        activities.push({
            id: generateId(),
            tripId,
            date: row[0]?.replace(/(^"|"$)/g, '').trim() || '',
            startTime: row[1]?.replace(/(^"|"$)/g, '').trim() || '',
            endTime: row[2]?.replace(/(^"|"$)/g, '').trim() || '',
            title: row[3]?.replace(/(^"|"$)/g, '').trim() || '',
            departure: row[4]?.replace(/(^"|"$)/g, '').trim() || '',
            arrival: row[5]?.replace(/(^"|"$)/g, '').trim() || '',
            departureUrl: row[6]?.replace(/(^"|"$)/g, '').trim() || '',
            arrivalUrl: row[7]?.replace(/(^"|"$)/g, '').trim() || '',
            notes: row[8]?.replace(/(^"|"$)/g, '').trim() || '',
        });
    }
    return activities;
};
