// server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // v2
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg'); // PostgreSQL client

const app = express();
const port = process.env.PORT || 3000;

// --- Database Setup ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client for DB test:', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release(); // Release client back to pool
        if (err) {
            return console.error('Error executing DB test query:', err.stack);
        }
        console.log('Database connected successfully:', result.rows[0].now);
    });
});

// --- Session Configuration ---
const sessionStore = new pgSession({
    pool: pool,
    tableName: 'session'
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        secure: 'auto', // Use 'true' if using https in production
        httpOnly: true
    }
}));

// --- Middleware ---
app.use(express.static('public')); // Serve static files
app.use(express.json());           // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- Authentication Middleware ---
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    if (req.path.startsWith('/api/')) {
        res.status(401).json({ message: 'Authentication required. Please log in.' });
    } else {
        res.redirect('/login.html?message=Please log in to continue');
    }
}

// --- TMDb API Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
    console.error("FATAL ERROR: TMDB_API_KEY is not defined in .env file.");
    process.exit(1);
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'replace_this_with_a_very_long_random_secret_string') {
     console.warn("WARNING: SESSION_SECRET is not set or is using the default. Please set a strong secret in .env for security.");
}

// --- Authentication API Routes ---

// Register New User
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password required.' });
    }
    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const insertQuery = 'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username';
        const result = await pool.query(insertQuery, [username, email, passwordHash]);
        console.log(`User registered: ${result.rows[0].username} (ID: ${result.rows[0].user_id})`);
        res.status(201).json({ message: 'Registration successful! You can now log in.', user: result.rows[0] });
    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }
        res.status(500).json({ message: 'Registration failed due to server error.' });
    }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required.' });
    }
    try {
        const findUserQuery = 'SELECT user_id, username, password_hash FROM users WHERE username = $1';
        const result = await pool.query(findUserQuery, [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            req.session.userId = user.user_id;
            req.session.username = user.username;
            console.log(`User logged in: ${user.username} (ID: ${user.user_id})`);
            res.status(200).json({ message: 'Login successful!', user: { userId: user.user_id, username: user.username } });
        } else {
            res.status(401).json({ message: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Login failed due to server error.' });
    }
});

// Logout User
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ message: 'Logout failed.' });
        }
        res.clearCookie('connect.sid');
        console.log('User logged out');
        res.status(200).json({ message: 'Logout successful.' });
    });
});

// Check Login Status
app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.userId) {
        res.status(200).json({
            isLoggedIn: true,
            user: { userId: req.session.userId, username: req.session.username }
        });
    } else {
        res.status(200).json({ isLoggedIn: false });
    }
});

// --- TMDb API Routes (Unprotected) ---

// Get Latest (Now Playing) Movies
app.get('/api/movies/now_playing', async (req, res) => {
    const url = `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
    try {
        const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`TMDb Error: ${apiResponse.statusText}`);
        const data = await apiResponse.json();
        res.json(data.results || []);
    } catch (error) {
        console.error("Error fetching now playing movies:", error);
        res.status(500).json({ message: 'Server error fetching latest movies' });
    }
});

// ***** NEW ROUTE FOR POPULAR MOVIES *****
app.get('/api/movies/popular', async (req, res) => {
    const url = `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`; // Get first page
    try {
        const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`TMDb Error: ${apiResponse.statusText}`);
        const data = await apiResponse.json();
        res.json(data.results || []); // Send back the results array
    } catch (error) {
        console.error("Error fetching popular movies:", error);
        res.status(500).json({ message: 'Server error fetching popular movies' });
    }
});
// ***** END NEW ROUTE *****

// Search Movies
app.get('/api/search', async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ message: 'Search query required' });
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    try {
         const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`TMDb Error: ${apiResponse.statusText}`);
        const data = await apiResponse.json();
        res.json(data.results || []);
    } catch (error) {
        console.error(`Error searching movies for "${query}":`, error);
        res.status(500).json({ message: 'Server error during search' });
    }
});

// Get Movie Details
app.get('/api/movie/:id', async (req, res) => {
    const movieId = req.params.id;
    const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`;
    try {
         const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`TMDb Error: ${apiResponse.statusText}`);
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error(`Error fetching details for movie ${movieId}:`, error);
        res.status(500).json({ message: 'Server error fetching movie details' });
    }
});

// --- User Favorites API Routes (Protected by ensureAuthenticated) ---

// Get User's Favorites
app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    try {
        const query = 'SELECT movie_id, movie_title, poster_path FROM user_favorites WHERE user_id = $1 ORDER BY added_at DESC';
        const result = await pool.query(query, [userId]);
        const favorites = result.rows.map(fav => ({
            id: fav.movie_id, title: fav.movie_title, poster_path: fav.poster_path
        }));
        res.json(favorites);
    } catch (error) {
        console.error(`Error fetching favorites for user ${userId}:`, error);
        res.status(500).json({ message: 'Error fetching favorites.' });
    }
});

// Add a Favorite
app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { id, title, poster_path } = req.body;
    if (!id || !title) return res.status(400).json({ message: 'Movie ID and Title required.' });
    const movieId = parseInt(id, 10);
    try {
        const insertQuery = 'INSERT INTO user_favorites (user_id, movie_id, movie_title, poster_path) VALUES ($1, $2, $3, $4)';
        await pool.query(insertQuery, [userId, movieId, title, poster_path]);
        console.log(`Favorite added for user ${userId}: Movie ${movieId}`);
        res.status(201).json({ message: 'Favorite added successfully.' });
    } catch (error) {
        console.error(`Error adding favorite for user ${userId}, movie ${movieId}:`, error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Movie already in favorites.' });
        }
        res.status(500).json({ message: 'Error adding favorite.' });
    }
});

// Remove a Favorite
app.delete('/api/favorites/:movieId', ensureAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const movieId = parseInt(req.params.movieId, 10);
    if (isNaN(movieId)) return res.status(400).json({ message: 'Invalid Movie ID.' });
    try {
        const deleteQuery = 'DELETE FROM user_favorites WHERE user_id = $1 AND movie_id = $2';
        const result = await pool.query(deleteQuery, [userId, movieId]);
        if (result.rowCount > 0) {
            console.log(`Favorite removed for user ${userId}: Movie ${movieId}`);
            res.status(200).json({ message: 'Favorite removed successfully.' });
        } else {
            res.status(404).json({ message: 'Favorite not found or not owned by user.' });
        }
    } catch (error) {
        console.error(`Error removing favorite for user ${userId}, movie ${movieId}:`, error);
        res.status(500).json({ message: 'Error removing favorite.' });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});