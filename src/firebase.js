import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDb2xWCyZ0yKYWNBuKSTsfAwL4OP2bO-hc",
    authDomain: "dhj-travel.firebaseapp.com",
    projectId: "dhj-travel",
    storageBucket: "dhj-travel.firebasestorage.app",
    messagingSenderId: "816942617288",
    appId: "1:816942617288:web:b390b8e095be0a03c6cbfd",
    measurementId: "G-1705Q7ERXC"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
