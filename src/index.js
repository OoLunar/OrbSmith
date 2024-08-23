// Spotify Player Configuration
const clientId = "dbfc2c5b7bfd450892824b70eb136a47";
const redirectUri = window.location.href.split('?')[0];

// DOM elements
const body = document.getElementsByTagName("body")[0];
const loading = document.getElementById("loading");
const loginButton = document.getElementById("login-button");
const app = document.getElementById("app");
const coverArt = document.getElementById("cover-art");
const pauseIcon = document.getElementById("pause-icon");
const songTitle = document.getElementById("song-title");
const songArtist = document.getElementById("song-artist");
const songAlbum = document.getElementById("song-album");
const progressBar = document.getElementById("progress-fill");
const player = new Player(document.getElementById("song-info"));
let progressInterval;
let progress = 0;
let totalDurationMs = 0;
let activeApiCall = false;
let lastError = null;

/**
 * Initiates the login process.
 */
async function login() {
    // Generate the base64-urlencoded sha256 hash for the PKCE challenge
    const codeVerifier = generateRandomString();
    const codeChallenge = await sha256(codeVerifier).then(buffer => base64UrlEncode(buffer));
    localStorage.setItem("pkce_code_verifier", codeVerifier);

    // Generate a random state value
    const state = generateRandomString();
    localStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: "streaming user-read-email user-read-private user-read-playback-state",
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state: state,  // Include the state value in the authorization request
        show_dialog: false
    });

    // Redirect to Spotify login page
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/**
 * Initiates playing after receiving the authorization code.
 * @param {string} code - The authorization code.
 * @param {string} state - The state value.
 */
function startPlaying(code, state) {
    // Validate the returned state value
    const storedState = localStorage.getItem("oauth_state");
    if(state !== storedState) {
        handleError("Invalid state returned from OAuth authorization.", true);
        return;
    }

    // We have an authorization code, now we need to exchange it for an access token
    const codeVerifier = localStorage.getItem("pkce_code_verifier");
    fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            client_id: clientId
        }).toString()
    })
        .then(response => response.json())
        .then(data => {
            if(data.error) {
                handleError(`Failed to exchange code for token: ${data.error}`, true);
                return;
            }

            // Remove the code search parameter from the uri to prevent an infinite loop (code -> token -> code -> token -> ...)
            window.location.replace(redirectUri);

            // Cache the token in localStorage for later use
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token);

            // Call refreshToken() after the token expires
            setInterval(() => refreshToken(), data.expires_in * 1000);

            // We have the access token, now we can start the app
            startApp(data.access_token);
        })
        .catch(error => handleError(`Failed to exchange code for token: ${error}`, true));
}

/**
 * Refreshes the access token using the refresh token.
 * @returns {Promise<string>} A promise that resolves to the new access token.
 */
async function refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId
    });

    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });

        const data = await response.json();
        if(data.error) {
            handleError(`Failed to refresh token: ${data.error}`, true);
            throw new Error(`Failed to refresh token: ${data.error}`);
        }

        // Update the token information in localStorage
        localStorage.setItem("access_token", data.access_token);

        // Call refreshToken() after the token expires
        setInterval(() => refreshToken(), data.expires_in * 1000);

        // Return the new access token
        return data.access_token;
    } catch(error) {
        handleError(`Failed to refresh token: ${error}`, true);
        throw error;
    }
}

/**
 * Initializes the Spotify player.
 * @param {string} token - The access token.
 */
function startApp(token) {
    loading.style.display = "none";
    app.style.display = "grid";

    // Start polling for the currently playing track
    setInterval(async () => {
        if(activeApiCall) {
            return;
        }

        activeApiCall = true;
        try {
            const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            const data = await response.text();
            if(data !== undefined && data !== null && data !== "") {
                // Track is playing or paused
                updateSongInfo(JSON.parse(data));
            } else {
                document.title = "OrbSmith: Not Playing";
                coverArt.src = "res/spotify.png";
                songTitle.innerText = "Song: Not Playing";
                songArtist.innerText = "Artist: Not Playing";
                songAlbum.innerText = "Album: Not Playing";
                pauseIcon.style.display = "none";

                showPlayer(false);
                coverArt.classList.remove("paused");

                progress = 0;
                totalDurationMs = 0;
                progressBar.style.width = 0;
            }
        } catch(error) {
            handleError(`Failed to get current track: ${error}`);
        }

        activeApiCall = false;
    }, 1000);

    // Refresh the token every hour
    setInterval(refreshToken, 3600000);

    progressInterval = setInterval(updateProgressBar, 500);
}

/**
 * Updates the progress bar based on the current track's progress.
 */
function updateProgressBar() {
    progressBar.style.width = `${(progress / totalDurationMs) * 100}%`;
}

/**
 * Updates the song information displayed on the app.
 * @param {object} state - The player state object.
 */
function updateSongInfo(state) {
    const currentTrack = state.item;
    const titleName = `OrbSmith: ${currentTrack.name} - ${currentTrack.artists.map(artist => artist.name).join(", ")}`;

    if(document.title !== titleName) {
        player.onSongChange(); // Trigger appearance of song-info when song changes
    }

    // Change the song information
    document.title = titleName;
    coverArt.src = currentTrack.album.images[0].url;
    songTitle.innerText = `Song: ${currentTrack.name}`;
    songArtist.innerText = `Artist: ${currentTrack.artists.map(artist => artist.name).join(", ")}`;
    songAlbum.innerText = currentTrack.album.name !== currentTrack.name ? `Album: ${currentTrack.album.name}` : "";

    // Change the progress bar
    progress = state.progress_ms;
    totalDurationMs = currentTrack.duration_ms;

    // If the song is paused
    if(!state.is_playing) {
        coverArt.classList.add("paused");
        pauseIcon.style.display = "block";
        body.classList.replace("fade-out", "fade-in");
        player.onSongPause(); // Trigger permanent visibility for song-info on pause
        return;
    }

    // If the song is unpaused
    pauseIcon.style.display = "none";
    coverArt.classList.remove("paused");
    player.onSongUnpause(); // Trigger hide for song-info after unpause
}

// Check for the authorization code in the URL search parameters
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const state = params.get("state");

// If we have the code and state, exchange the code for a token
if(code && state) {
    app.addEventListener('mouseenter', () => showPlayer(true));
    app.addEventListener('mouseleave', () => {
        if(isPlaying) {
            clearTimeout(fadeTimeout);
            fadeTimeout = setTimeout(() => {
                showPlayer(false);
            }, FADE_OUT_DELAY); // Use the global FADE_OUT_DELAY variable
        }
    });

    startPlaying(code, state);
} else {
    // Otherwise, we assume the user needs to login
    loginButton.addEventListener("click", login);

    const token = localStorage.getItem("access_token");
    if(token) {
        const tokenExpiresAt = parseInt(localStorage.getItem("token_expires_at"));
        const currentTime = new Date().getTime();
        if(currentTime < tokenExpiresAt - 30000) {
            startApp(token);
        } else {
            refreshToken().then(startApp);
        }
    } else {
        loading.style.display = "none";
        app.style.display = "none";
        loginButton.style.display = "block";
    }
}
