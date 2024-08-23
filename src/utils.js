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