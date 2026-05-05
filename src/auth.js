import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase';

// 본인/가족 화이트리스트.
// 여기에 본인 + 가족 Google 계정 이메일을 추가하세요.
// firestore.rules의 화이트리스트와 동일하게 유지해야 합니다.
export const ALLOWED_EMAILS = [
    'pdh090333@gmail.com',
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
    try {
        return await signInWithPopup(auth, provider);
    } catch (e) {
        // 팝업이 차단되거나 환경(모바일/시크릿)이 팝업을 막으면 전체 페이지 리다이렉트로 폴백
        if (
            e?.code === 'auth/popup-blocked' ||
            e?.code === 'auth/operation-not-supported-in-this-environment'
        ) {
            return signInWithRedirect(auth, provider);
        }
        throw e;
    }
};

export const signOutUser = async () => {
    return signOut(auth);
};

export const subscribeToAuth = (callback) => {
    return onAuthStateChanged(auth, callback);
};
