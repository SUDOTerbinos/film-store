// public/auth.js

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const messageArea = document.getElementById('messageArea');

// Function to display messages
function showMessage(message, type = 'error') {
    if (!messageArea) return;
    messageArea.textContent = message;
    messageArea.className = `message ${type}`; // Add 'error' or 'success' class
    messageArea.style.display = 'block';
}

// Function to handle API requests
async function handleAuthRequest(url, formData) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        const result = await response.json(); // Always try to parse JSON

        if (!response.ok) {
            // Use message from API response if available, otherwise use status text
            throw new Error(result.message || `Request failed with status ${response.status}`);
        }

        return result; // Return successful result (contains message and maybe user data)

    } catch (error) {
        console.error('Auth request error:', error);
        showMessage(error.message || 'An unexpected error occurred.', 'error');
        return null; // Indicate failure
    }
}

// --- Login Form Logic ---
if (loginForm) {
    // Display message from query parameter (e.g., after redirect)
     const urlParams = new URLSearchParams(window.location.search);
     const message = urlParams.get('message');
     const success = urlParams.get('success');
     if (message) {
         showMessage(message, success ? 'success' : 'error');
         // Clean the URL
          window.history.replaceState({}, document.title, window.location.pathname);
     }


    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission
        showMessage('Logging in...', 'info'); // Show temporary message

        const formData = {
            username: loginForm.username.value,
            password: loginForm.password.value,
        };

        const result = await handleAuthRequest('/api/auth/login', formData);

        if (result) {
            showMessage(result.message, 'success');
            // Redirect to home page after successful login
            setTimeout(() => {
                 window.location.href = '/'; // Redirect to index.html (or wherever appropriate)
             }, 1000); // Short delay to show success message
        }
        // Error message is already handled by handleAuthRequest
    });
}

// --- Register Form Logic ---
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage('Registering...', 'info'); // Show temporary message

        const password = registerForm.password.value;
        const confirmPassword = registerForm.confirmPassword.value;

        if (password !== confirmPassword) {
            showMessage('Passwords do not match.', 'error');
            return;
        }

        const formData = {
            username: registerForm.username.value,
            email: registerForm.email.value,
            password: password,
        };

        const result = await handleAuthRequest('/api/auth/register', formData);

        if (result) {
             // Redirect to login page with success message
            window.location.href = `/login.html?success=true&message=${encodeURIComponent(result.message)}`;
        }
         // Error message is already handled by handleAuthRequest
    });
}