// Firebase initialization module
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

    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyANOlqIx79wrJLKCLSl8U19lscbdnE0v6Q",
        authDomain: "artifacts-ccba2.firebaseapp.com",
        projectId: "artifacts-ccba2",
        storageBucket: "artifacts-ccba2.firebasestorage.app",
        messagingSenderId: "785691942481",
        appId: "1:785691942481:web:b2c83ee66ca690f56e1f67"
    };

    const app = initializeApp(firebaseConfig);
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
