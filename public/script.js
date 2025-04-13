// public/script.js

// --- Global variable to store login state ---
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const latestMoviesContainer = document.getElementById('latestMoviesContainer');
    const popularMoviesContainer = document.getElementById('popularMoviesContainer'); // Ref for popular
    const favoritesContainer = document.getElementById('favoritesContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const detailsSection = document.getElementById('detailsSection');
    const detailsContainer = document.getElementById('detailsContainer');
    const closeDetailsButton = document.getElementById('closeDetailsButton');
    // Auth elements
    const authLoading = document.getElementById('authLoading');
    const authLoggedOut = document.getElementById('authLoggedOut');
    const authLoggedIn = document.getElementById('authLoggedIn');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const favSectionStatus = document.getElementById('favSectionStatus');

    // --- API & Image Constants ---
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342'; // Poster size for cards
    const IMAGE_DETAILS_URL = 'https://image.tmdb.org/t/p/w500'; // Larger for details

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    closeDetailsButton.addEventListener('click', hideDetails);

    // Event Delegation for dynamic buttons
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('details-btn')) {
            fetchMovieDetails(target.dataset.id);
        } else if (target.classList.contains('favorite-btn')) {
             if (!currentUser) {
                 alert('Please log in to add favorites.');
                 return;
             }
            addFavorite(target.dataset.id, target.dataset.title, target.dataset.poster);
        } else if (target.classList.contains('remove-fav-btn')) {
             removeFavorite(target.dataset.id);
        } else if (target.id === 'logoutButton') {
             handleLogout();
        }
    });

    // --- Core Functions ---

    async function handleSearch() {
        const query = searchInput.value.trim();
        resultsContainer.innerHTML = '';
        hideDetails();
        if (!query) {
            resultsContainer.innerHTML = '<p>Please enter a search term.</p>';
            return;
        }
        showLoadingMessage(resultsContainer, 'Searching...');
        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error(`Search failed (${response.status})`);
            const movies = await response.json();
            displayMovies(movies, resultsContainer, 'No movies found matching your search.');
        } catch (error) {
            console.error("Search error:", error);
            showErrorMessage(resultsContainer, `Error searching movies: ${error.message}`);
        }
    }

    async function fetchMovieDetails(movieId) {
        detailsSection.style.display = 'block';
        showLoadingMessage(detailsContainer, 'Loading details...');
        detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
            const response = await fetch(`/api/movie/${movieId}`);
            if (!response.ok) throw new Error(`Failed to fetch details (${response.status})`);
            const movie = await response.json();
            displayMovieDetails(movie);
        } catch (error) {
            console.error("Error fetching details:", error);
            showErrorMessage(detailsContainer, `Could not load movie details: ${error.message}`);
        }
    }

    function displayMovieDetails(movie) {
        detailsContainer.innerHTML = '';
        const posterPath = movie.poster_path ? `${IMAGE_DETAILS_URL}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
        const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';

        let detailsHTML = `
            <img src="${posterPath}" alt="${movie.title} Poster" class="details-poster" loading="lazy">
            <h2>${movie.title} (${year})</h2>
            <p><strong>Rating:</strong> ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'} / 10 (${movie.vote_count ? movie.vote_count.toLocaleString() : 0} votes)</p>
            <p><strong>Genres:</strong> ${movie.genres?.map(g => g.name).join(', ') || 'N/A'}</p>
            <p><strong>Runtime:</strong> ${movie.runtime ? `${movie.runtime} min` : 'N/A'}</p>
            <p><strong>Release Date:</strong> ${movie.release_date || 'N/A'}</p>
            <p><strong>Overview:</strong> ${movie.overview || 'No overview available.'}</p>
        `;

        // Cast
        if (movie.credits?.cast?.length > 0) {
            detailsHTML += `<h3>Top Cast</h3><ul>`;
            movie.credits.cast.slice(0, 5).forEach(actor => {
                detailsHTML += `<li>${actor.name} (${actor.character})</li>`;
            });
            detailsHTML += `</ul>`;
        }
        // Trailer
         if (movie.videos?.results?.length > 0) {
             const trailer = movie.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
             if (trailer) {
                 detailsHTML += `<h3>Trailer</h3><iframe width="560" height="315" src="https://www.youtube.com/embed/${trailer.key}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
             }
         }
         // Add Favorite button within details (check login status)
        if (currentUser) {
             detailsHTML += `<button class="favorite-btn details-fav-btn" data-id="${movie.id}" data-title="${movie.title}" data-poster="${movie.poster_path || ''}">☆ Add to Favorites</button>`;
        } else {
            detailsHTML += `<p><a href="/login.html">Log in</a> to add this movie to your favorites.</p>`;
        }
        detailsContainer.innerHTML = detailsHTML;
    }

    function hideDetails() {
        detailsSection.style.display = 'none';
        detailsContainer.innerHTML = '';
    }

    // --- Authentication Functions ---
    async function checkLoginStatus() {
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();
            authLoading.style.display = 'none';
            if (data.isLoggedIn) {
                currentUser = data.user;
                authLoggedIn.style.display = 'flex';
                authLoggedOut.style.display = 'none';
                usernameDisplay.textContent = `Welcome, ${currentUser.username}!`;
                favSectionStatus.textContent = '';
                fetchFavorites(); // Fetch user-specific favorites *after* confirming login
            } else {
                currentUser = null;
                authLoggedOut.style.display = 'flex';
                authLoggedIn.style.display = 'none';
                 favSectionStatus.textContent = '(Login required)';
                 favoritesContainer.innerHTML = '<p><a href="/login.html">Log in</a> to see your favorites.</p>';
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            authLoading.style.display = 'none';
            authLoggedOut.style.display = 'flex';
             favoritesContainer.innerHTML = '<p class="error-message">Could not verify login status.</p>';
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Logout failed');
            alert(result.message);
            currentUser = null;
             authLoggedIn.style.display = 'none';
             authLoggedOut.style.display = 'flex';
             favoritesContainer.innerHTML = '<p><a href="/login.html">Log in</a> to see your favorites.</p>';
             favSectionStatus.textContent = '(Login required)';
        } catch (error) {
            console.error('Logout error:', error);
            alert(`Logout failed: ${error.message}`);
        }
    }

    // --- Movie List Fetching Functions ---
    async function fetchLatestMovies() {
         if (!latestMoviesContainer) return;
         showLoadingMessage(latestMoviesContainer, 'Loading latest movies...');
         try {
            const response = await fetch('/api/movies/now_playing');
            if (!response.ok) throw new Error('Failed to fetch latest movies');
            const movies = await response.json();
            displayMovies(movies.slice(0, 18), latestMoviesContainer, 'Could not load latest movies.');
        } catch (error) {
             console.error("Error fetching latest movies:", error);
             showErrorMessage(latestMoviesContainer, `Could not load latest movies: ${error.message}`);
        }
    }

    // ***** NEW FUNCTION FOR POPULAR MOVIES *****
    async function fetchPopularMovies() {
        if (!popularMoviesContainer) return; // Check if element exists
        showLoadingMessage(popularMoviesContainer, 'Loading popular movies...');
        try {
            const response = await fetch('/api/movies/popular'); // Call the new backend route
            if (!response.ok) throw new Error('Failed to fetch popular movies');
            const movies = await response.json();
            displayMovies(movies.slice(0, 18), popularMoviesContainer, 'Could not load popular movies.'); // Display them
        } catch (error) {
             console.error("Error fetching popular movies:", error);
             showErrorMessage(popularMoviesContainer, `Could not load popular movies: ${error.message}`);
        }
    }
    // ***** END NEW FUNCTION *****

    async function fetchFavorites() {
         if (!currentUser) {
             favoritesContainer.innerHTML = '<p><a href="/login.html">Log in</a> to see your favorites.</p>';
             return;
         }
         showLoadingMessage(favoritesContainer, 'Loading favorites...');
         try {
            const response = await fetch('/api/favorites');
            if (response.status === 401) {
                window.location.href = '/login.html?message=Session expired. Please log in again.';
                return;
            }
            if (!response.ok) throw new Error('Failed to fetch favorites');
            const favorites = await response.json();
            displayMovies(favorites, favoritesContainer, 'You have no favorite movies yet.', true); // isFavoriteList=true
        } catch (error) {
            console.error("Error fetching favorites:", error);
            showErrorMessage(favoritesContainer, `Could not load favorites: ${error.message}`);
        }
    }

    // --- Favorite Actions ---
     async function addFavorite(id, title, poster_path) {
        console.log(`Adding fav: ID=${id}, Title=${title}`);
        try {
            const response = await fetch('/api/favorites', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id, 10), title, poster_path }),
            });
            const result = await response.json();
            if (response.status === 401) { alert('Session expired. Please log in again.'); window.location.href = '/login.html'; return; }
            if (!response.ok) throw new Error(result.message || `Failed (${response.status})`);
            alert(`"${title}" added to favorites!`);
            fetchFavorites(); // Refresh list
        } catch (error) {
            console.error("Error adding favorite:", error); alert(`Could not add favorite: ${error.message}`);
        }
    }

     async function removeFavorite(id) {
        if (!id || !confirm("Remove this movie from favorites?")) return;
        try {
            const response = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
            const result = await response.json();
             if (response.status === 401) { alert('Session expired. Please log in again.'); window.location.href = '/login.html'; return; }
            if (!response.ok) throw new Error(result.message || `Failed (${response.status})`);
            alert(result.message);
            fetchFavorites(); // Refresh list
        } catch (error) {
             console.error("Error removing favorite:", error); alert(`Could not remove favorite: ${error.message}`);
        }
    }

    // --- Display Logic ---
    function displayMovies(movies, containerElement, emptyMessage, isFavoriteList = false) {
        containerElement.innerHTML = '';
        if (!movies || movies.length === 0) {
            containerElement.innerHTML = `<p>${emptyMessage}</p>`; return;
        }
        movies.forEach(movie => {
            const movieCard = document.createElement('div');
            movieCard.classList.add('movie-card');
            const posterPath = movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : 'https://via.placeholder.com/342x513?text=No+Image';
            const year = movie.release_date ? movie.release_date.split('-')[0] : (movie.year || 'N/A');

            // Determine button based on context & login state
            let actionButtonHTML = '';
            if (isFavoriteList) {
                actionButtonHTML = `<button class="remove-fav-btn" data-id="${movie.id}">✕ Remove</button>`;
            } else if (currentUser) { // Only show add favorite if logged in and not on favorite list
                actionButtonHTML = `<button class="favorite-btn" data-id="${movie.id}" data-title="${movie.title}" data-poster="${movie.poster_path || ''}">☆ Favorite</button>`;
            }
            // Login prompt could be added here if needed for non-favorite lists when logged out

            movieCard.innerHTML = `
                <div class="poster-container">
                    <img src="${posterPath}" alt="${movie.title} Poster" loading="lazy">
                    <span class="badge badge-hd">HD</span><span class="badge badge-type">Movie</span>
                </div>
                <div class="info-container">
                    <h3>${movie.title || 'N/A'}</h3>
                    <div class="meta-info"><span>${year}</span></div>
                    <button class="details-btn" data-id="${movie.id}">View Details</button>
                    ${actionButtonHTML}
                </div>`;
            containerElement.appendChild(movieCard);
        });
    }

    // --- Utility Display Functions ---
    function showLoadingMessage(element, message = 'Loading...') { element.innerHTML = `<p class="loading-msg">${message}</p>`; }
    function showErrorMessage(element, message = 'An error occurred.') { element.innerHTML = `<p class="error-message">${message}</p>`; }

    // --- Initial Page Load ---
    checkLoginStatus(); // Checks login and fetches favorites if logged in
    fetchLatestMovies(); // Fetch public data
    fetchPopularMovies(); // <<< FETCH POPULAR MOVIES

}); // End DOMContentLoaded