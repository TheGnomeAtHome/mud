// Authentication Module - Handles login, registration, and password reset
export function initializeAuth(firebase, ui, appId) {
    console.log('=== INITIALIZE AUTH MODULE START ===');
    console.log('Firebase auth:', !!firebase.auth);
    console.log('App ID:', appId);
    
    const { auth, authFunctions, firestoreFunctions } = firebase;
    const { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } = authFunctions;
    const { doc, getDoc } = firestoreFunctions;
    const { logToTerminal } = ui;
    
    const authModal = document.getElementById('auth-modal');
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const authError = document.getElementById('auth-error');
    
    console.log('Auth UI Elements:', {
        authModal: !!authModal,
        authTabsCount: authTabs.length,
        authFormsCount: authForms.length,
        authError: !!authError
    });
    
    // Tab switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            console.log('Auth tab clicked:', tab.dataset.form);
            authTabs.forEach(t => t.classList.remove('active'));
            authForms.forEach(f => f.classList.add('hidden'));
            tab.classList.add('active');
            const formId = tab.dataset.form;
            document.getElementById(formId).classList.remove('hidden');
            authError.textContent = '';
        });
    });
    
    // Registration
    const registerForm = document.getElementById('register-form');
    console.log('Register form found:', !!registerForm);
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            console.log('=== REGISTRATION FORM SUBMIT EVENT ===');
            e.preventDefault();
            e.stopPropagation();
            authError.textContent = '';
            
            const emailInput = document.getElementById('register-email');
            const passwordInput = document.getElementById('register-password');
            
            console.log('Register inputs found:', { email: !!emailInput, password: !!passwordInput });
            
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            
            console.log('Registration attempt - Email:', email, 'Password length:', password.length);
            
            if (!email || !password) {
                console.error('Validation failed: Missing email or password');
                authError.textContent = 'Email and password are required';
                authError.className = 'text-red-500 text-sm mt-4';
                return;
            }
            
            if (password.length < 6) {
                console.error('Validation failed: Password too short');
                authError.textContent = 'Password must be at least 6 characters';
                authError.className = 'text-red-500 text-sm mt-4';
                return;
            }
            
            try {
                console.log('Calling Firebase createUserWithEmailAndPassword...');
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('✓ Firebase user created successfully!', userCredential.user.uid);
                authModal.classList.add('hidden');
            } catch (error) {
                console.error('✗ Registration Error:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                authError.textContent = error.message;
                authError.className = 'text-red-500 text-sm mt-4';
            }
        }, { passive: false });
        console.log('✓ Registration form submit handler attached');
    } else {
        console.error('✗ Register form not found!');
    }
    
    // Login
    const loginForm = document.getElementById('login-form');
    console.log('Login form found:', !!loginForm);
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            console.log('=== LOGIN FORM SUBMIT EVENT ===');
            e.preventDefault();
            e.stopPropagation();
            authError.textContent = '';
            
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            
            console.log('Login inputs found:', { email: !!emailInput, password: !!passwordInput });
            
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            
            console.log('Login attempt - Email:', email, 'Password length:', password.length);
            
            if (!email || !password) {
                console.error('Validation failed: Missing email or password');
                authError.textContent = 'Email and password are required';
                authError.className = 'text-red-500 text-sm mt-4';
                return;
            }
            
            try {
                console.log('Calling Firebase signInWithEmailAndPassword...');
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log('✓ Login successful!', userCredential.user.uid);
                authModal.classList.add('hidden');
            } catch (error) {
                console.error('✗ Login Error:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                authError.textContent = 'Invalid credentials';
                authError.className = 'text-red-500 text-sm mt-4';
            }
        }, { passive: false });
        console.log('✓ Login form submit handler attached');
    } else {
        console.error('✗ Login form not found!');
    }
    
    // Password Reset
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    console.log('Forgot password form found:', !!forgotPasswordForm);
    
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            console.log('=== FORGOT PASSWORD FORM SUBMIT EVENT ===');
            e.preventDefault();
            authError.textContent = '';
            const email = document.getElementById('forgot-email').value;
            
            console.log('Password reset attempt for:', email);
            
            try {
                await sendPasswordResetEmail(auth, email);
                console.log('✓ Password reset email sent');
                authError.textContent = 'Password reset email sent! Check your inbox.';
                authError.className = 'text-green-500 text-sm mt-4';
            } catch (error) {
                console.error("✗ Forgot Password Error:", error.message);
                authError.textContent = 'Could not send reset email. Is the address correct?';
                authError.className = 'text-red-500 text-sm mt-4';
            }
        });
        console.log('✓ Forgot password form submit handler attached');
    } else {
        console.error('✗ Forgot password form not found!');
    }
    
    console.log('=== INITIALIZE AUTH MODULE COMPLETE ===');
    
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
