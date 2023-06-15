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

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: "streaming user-read-email user-read-private",
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    // Redirect to Spotify login page
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/**
 * Initializes the Spotify player.
 * @param {string} token - The access token.
 */
function startApp(token) {
    const player = new Spotify.Player({
        name: "OBS Spotify Player",
        getOAuthToken: cb => cb(token)
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
}

/**
 * Updates the song information displayed on the app.
 * @param {object} state - The player state object.
 */
function updateSongInfo(state) {
    if(state) {
        const { current_track: currentTrack } = state.track_window;
        state.paused = state.paused;

        if(state.paused) {
            // If the music is paused, show the pause icon and grey out the cover art
            body.style.opacity = 1;
            coverArt.classList.add("paused");
            pauseIcon.style.display = "block";
            setTimeout(() => body.style.opacity = 0, 7500);
        } else {
            // If the music is playing, hide the pause icon and remove the grey overlay
            coverArt.classList.remove("paused");
            pauseIcon.style.display = "none";
            body.style.opacity = 1;
            setTimeout(() => body.style.opacity = 0, 5000);
        }

        document.title = `Spotify: ${currentTrack.name} - ${currentTrack.artists.map(artist => artist.name).join(", ")}`;
        coverArt.src = currentTrack.album.images[0].url;
        songTitle.innerText = `Song: ${currentTrack.name}`;
        songArtist.innerText = `Artist: ${currentTrack.artists.map(artist => artist.name).join(", ")}`;
        songAlbum.innerText = currentTrack.album.name !== currentTrack.name ? `Album: ${currentTrack.album.name}` : "";
    } else {
        document.title = "Spotify: Not Playing";
        coverArt.src = "res/spotify.png";
        songTitle.innerText = "Song: Not Playing";
        songArtist.innerText = "Artist: Not Playing";
        songAlbum.innerText = "Album: Not Playing";

        // If there is no music, hide the pause icon and remove the grey overlay
        pauseIcon.style.display = "none";

        // Keep app at full opacity when not playing
        body.style.opacity = 1;
    }
}

/**
 * Initiates playing after receiving the authorization code.
 * @param {string} code - The authorization code.
 */
function startPlaying(code) {
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

            // We have the access token, now we can start the app
            startApp(data.access_token);
        })
        .catch(error => handleError(`Failed to exchange code for token: ${error}`, true));
}

window.onSpotifyWebPlaybackSDKReady = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if(code) {
        startPlaying(code);
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