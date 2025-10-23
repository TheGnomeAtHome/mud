// Firebase initialization module
import { FIREBASE_CONFIG } from './config.js';

// Initialize Firebase immediately for exports
const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
const { getAuth } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function initializeFirebase() {
    const { 
        onAuthStateChanged, 
        createUserWithEmailAndPassword, 
        signInWithEmailAndPassword, 
        signOut, 
        sendPasswordResetEmail 
    } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    const { 
        doc, 
        getDoc, 
        setDoc, 
        updateDoc, 
        onSnapshot, 
        collection, 
        query, 
        where, 
        orderBy, 
        limit, 
        addDoc, 
        serverTimestamp, 
        getDocs, 
        arrayUnion, 
        arrayRemove, 
        deleteDoc, 
        runTransaction 
    } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    return {
        app,
        auth,
        db,
        authFunctions: {
            onAuthStateChanged,
            createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
            signOut,
            sendPasswordResetEmail
        },
        firestoreFunctions: {
            doc,
            getDoc,
            setDoc,
            updateDoc,
            onSnapshot,
            collection,
            query,
            where,
            orderBy,
            limit,
            addDoc,
            serverTimestamp,
            getDocs,
            arrayUnion,
            arrayRemove,
            deleteDoc,
            runTransaction
        }
    };
}
