// Configuration and Constants
// MUD Game Configuration

// Firebase App ID
export const APP_ID = 'YOUR_APP_ID';

// Gemini AI Configuration (for AI features)
export const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Get this from Google AI Studio
export const GEMINI_MODEL = "gemini-2.0-flash";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Firebase Configuration (for database and authentication)
// This will be used if not provided by the deployment platform
export const FIREBASE_CONFIG = {
    apiKey: "YOUR_FIREBASE_API_KEY", // Get this from Firebase console - MUST BE DIFFERENT from Gemini key
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID"
};