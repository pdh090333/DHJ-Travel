import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase';

// 본인/가족 화이트리스트.
// 여기에 본인 + 가족 Google 계정 이메일을 추가하세요.
// firestore.rules의 화이트리스트와 동일하게 유지해야 합니다.
export const ALLOWED_EMAILS = [
    'pdg090333@gmail.com',
    '9693dhj@gmail.com',
    // 'family1@example.com',
    // 'family2@example.com',
];

export const isAllowedUser = (user) => {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    return ALLOWED_EMAILS.some(e => e.toLowerCase() === email);
};

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
};

export const signOutUser = async () => {
    return signOut(auth);
};

export const subscribeToAuth = (callback) => {
    return onAuthStateChanged(auth, callback);
};
