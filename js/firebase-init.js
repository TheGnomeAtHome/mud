// Firebase initialization module
import { FIREBASE_CONFIG } from './config.js';

export async function initializeFirebase() {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
    const { 
        getAuth, 
        onAuthStateChanged, 
        createUserWithEmailAndPassword, 
        signInWithEmailAndPassword, 
        signOut, 
        sendPasswordResetEmail 
    } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    const { 
        getFirestore, 
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

    // Use the Firebase configuration from config.js
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);

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
