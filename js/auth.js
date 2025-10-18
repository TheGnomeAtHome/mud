// Authentication Module - Handles login, registration, and password reset
export function initializeAuth(firebase, ui, appId) {
    const { auth, authFunctions, firestoreFunctions } = firebase;
    const { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } = authFunctions;
    const { doc, getDoc } = firestoreFunctions;
    const { logToTerminal } = ui;
    
    const authModal = document.getElementById('auth-modal');
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const authError = document.getElementById('auth-error');
    
    // Tab switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            authForms.forEach(f => f.classList.add('hidden'));
            tab.classList.add('active');
            const formId = tab.dataset.form;
            document.getElementById(formId).classList.remove('hidden');
            authError.textContent = '';
        });
    });
    
    // Registration
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        console.log('Registration attempt:', email);
        
        if (!email || !password) {
            authError.textContent = 'Email and password are required';
            authError.className = 'text-red-500 text-sm mt-4';
            return;
        }
        
        if (password.length < 6) {
            authError.textContent = 'Password must be at least 6 characters';
            authError.className = 'text-red-500 text-sm mt-4';
            return;
        }
        
        try {
            console.log('Creating user with Firebase...');
            await createUserWithEmailAndPassword(auth, email, password);
            console.log('User created successfully');
            authModal.classList.add('hidden');
        } catch (error) {
            console.error("Registration Error:", error.message, error.code);
            authError.textContent = error.message;
            authError.className = 'text-red-500 text-sm mt-4';
        }
    });
    
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            authModal.classList.add('hidden');
        } catch (error) {
            console.error("Login Error:", error.message);
            authError.textContent = 'Invalid credentials';
            authError.className = 'text-red-500 text-sm mt-4';
        }
    });
    
    // Password Reset
    document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = document.getElementById('forgot-email').value;
        
        try {
            await sendPasswordResetEmail(auth, email);
            authError.textContent = 'Password reset email sent! Check your inbox.';
            authError.className = 'text-green-500 text-sm mt-4';
        } catch (error) {
            console.error("Forgot Password Error:", error.message);
            authError.textContent = 'Could not send reset email. Is the address correct?';
            authError.className = 'text-red-500 text-sm mt-4';
        }
    });
    
    // Return authentication state handler
    function setupAuthStateHandler(callback) {
        return onAuthStateChanged(auth, callback);
    }
    
    return {
        setupAuthStateHandler,
        showAuthModal: () => authModal.classList.remove('hidden'),
        hideAuthModal: () => authModal.classList.add('hidden')
    };
}
