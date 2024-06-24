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
let progressInterval;
let progress = 0;
let totalDurationMs = 0;
let isPlaying = false;

/**
 * Generates a secure random string using the browser crypto API.
 * @returns {string} A random string.
 */
function generateRandomString() {
    const array = new Uint32Array(28);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

/**
 * Calculates the SHA256 hash of the input text.
 * @param {string} plain - The input text.
 * @returns {Promise<ArrayBuffer>} A promise that resolves to an ArrayBuffer.
 */
function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest("SHA-256", data);
}

/**
 * Base64-urlencodes the input string.
 * @param {string} str - The input string.
 * @returns {string} The base64-url encoded string.
 */
function base64UrlEncode(str) {
    // Convert the ArrayBuffer to string using Uint8 array to convert to what btoa accepts.
    // btoa accepts chars only within ascii 0-255 and base64 encodes.
    // This line takes base64 strings and converts them to base64url strings.
    // See here for the reason why we need to make this replacement:
    // https://developer.spotify.com/documentation/general/guides/authorization-guide/#implicit-grant-flow
    let base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Handles errors and displays appropriate messages.
 * @param {string} message - The error message.
 * @param {boolean} [clearStorage=false] - Whether to clear the local storage.
 */
function handleError(message, clearStorage = false) {
    if(clearStorage) {
        localStorage.clear();
        loginButton.addEventListener("click", login);
        loading.style.display = "none";
        app.style.display = "none";
        loginButton.style.display = "block";
    }

    window.alert(JSON.stringify(message)); // For debugging purposes only
    console.error(message);
}

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
        scope: "streaming user-read-email user-read-private",
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
            localStorage.setItem("token_expires_in", data.expires_in);
            localStorage.setItem("token_expires_at", new Date().getTime() + data.expires_in * 1000);

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
        localStorage.setItem("token_expires_in", data.expires_in);
        localStorage.setItem("token_expires_at", new Date().getTime() + data.expires_in * 1000);
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
    const player = new Spotify.Player({
        name: "OrbSmith: Stream Overlay",
        getOAuthToken: async cb => {
            const tokenExpiresAt = parseInt(localStorage.getItem("token_expires_at"));
            const currentTime = new Date().getTime();

            if(currentTime < tokenExpiresAt - 30000) {
                // Token is valid for more than 30 seconds, use the current token
                cb(token);
            } else {
                try {
                    // Token is about to expire, refresh it
                    const newToken = await refreshToken();
                    cb(newToken);
                } catch(error) {
                    // Handle token refresh error
                    handleError("Failed to refresh access token.", true);
                }
            }
        }
    });

    player.addListener("initialization_error", message => handleError(message, true));
    player.addListener("authentication_error", message => handleError(message, true));
    player.addListener("account_error", message => handleError(message));
    player.addListener("playback_error", message => handleError(message));
    player.addListener("player_state_changed", state => updateSongInfo(state));
    player.addListener("not_ready", device_id => console.log("Device ID has gone offline", device_id));
    player.addListener("ready", device_id => {
        console.log("Ready with Device ID", device_id);
        loading.style.display = "none";
        app.style.display = "grid";
    });

    player.connect();
    progressInterval = setInterval(updateProgressBar, 500);
}

function updateProgressBar() {
    if(!isPlaying) {
        // If the music is paused, don't update the progress bar
        return;
    }

    progress += 500;
    progressBar.style.width = `${(progress / totalDurationMs) * 100}%`;
}

/**
 * Updates the song information displayed on the app.
 * @param {object} state - The player state object.
 */
function updateSongInfo(state) {
    if(state) {
        const { current_track: currentTrack } = state.track_window;

        document.title = `OrbSmith: ${currentTrack.name} - ${currentTrack.artists.map(artist => artist.name).join(", ")}`;
        coverArt.src = currentTrack.album.images[0].url;
        songTitle.innerText = `Song: ${currentTrack.name}`;
        songArtist.innerText = `Artist: ${currentTrack.artists.map(artist => artist.name).join(", ")}`;
        songAlbum.innerText = currentTrack.album.name !== currentTrack.name ? `Album: ${currentTrack.album.name}` : "";

        if(state.paused) {
            // If the music is paused, show the pause icon and grey out the cover art
            body.classList.replace("fade-out", "fade-in");
            coverArt.classList.add("paused");
            pauseIcon.style.display = "block";
            isPlaying = false;
        } else {
            // If the music is playing, hide the pause icon and remove the grey overlay
            pauseIcon.style.display = "none";
            coverArt.classList.remove("paused");

            isPlaying = true;
            progress = state.position;
            totalDurationMs = currentTrack.duration_ms;

            // If the song is just starting, fade in the cover art
            if(state.position === 0) {
                body.classList.replace("fade-out", "fade-in");
                setTimeout(() => body.classList.replace("fade-in", "fade-out"), 5000);
            } else {
                // Otherwise, fade out the cover art
                body.classList.replace("fade-in", "fade-out");
            }
        }
    } else {
        document.title = "OrbSmith: Not Playing";
        coverArt.src = "res/spotify.png";
        songTitle.innerText = "Song: Not Playing";
        songArtist.innerText = "Artist: Not Playing";
        songAlbum.innerText = "Album: Not Playing";

        // If there is no music, hide the pause icon and remove the grey overlay
        pauseIcon.style.display = "none";
        body.classList.replace("fade-out", "fade-in");
    }
}

window.onSpotifyWebPlaybackSDKReady = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    if(code) {
        startPlaying(code, state);
    } else {
        const cachedToken = localStorage.getItem("access_token");
        if(cachedToken) {
            // We have a cached token, so start the app
            startApp(cachedToken);
        } else {
            // We don't have an authorization code, so show the login button
            loginButton.addEventListener("click", login);
            loading.style.display = "none";
            loginButton.style.display = "block";
        }
    }
};
