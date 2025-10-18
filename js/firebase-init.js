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
        apiKey: "AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs",
        authDomain: "mudgame-3cbb1.firebaseapp.com",
        projectId: "mudgame-3cbb1",
        storageBucket: "mudgame-3cbb1.appspot.com",
        messagingSenderId: "1004334145379",
        appId: "1:1004334145379:web:3db9fda346526a64e67d56"
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
