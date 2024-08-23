class Player {
    constructor(songInfoElement) {
        this.songInfo = songInfoElement;
        this.transitionTime = 10000;  // 10 seconds
        this.isSongPaused = false;
        this.isHovered = false;
        this.currentTransitionTimeout = null;

        // Hover functionality
        this.songInfo.addEventListener('mouseover', () => this.onHover(true));
        this.songInfo.addEventListener('mouseout', () => this.onHover(false));
    }

    onHover(isHovered) {
        this.isHovered = isHovered;
        this.updateVisibility();
    }

    onSongPause() {
        this.isSongPaused = true;
        this.showSongInfo();
    }

    onSongUnpause() {
        this.isSongPaused = false;
        this.updateVisibility();
    }

    onSongChange() {
        this.showSongInfo();

        // Check visibility after song changes
        this.updateVisibility();
    }

    showSongInfo() {
        clearTimeout(this.currentTransitionTimeout);
        this.songInfo.classList.add('visible');
    }

    hideSongInfo() {
        clearTimeout(this.currentTransitionTimeout);

        // Start fade-out only after transition time if not paused or hovered
        this.currentTransitionTimeout = setTimeout(() => {
            if(!this.isHovered && !this.isSongPaused) {
                this.songInfo.classList.remove('visible');
            }
        }, this.transitionTime);
    }

    updateVisibility() {
        // Always keep song info visible if hovered or paused
        if(this.isHovered || this.isSongPaused) {
            this.showSongInfo();
        } else {
            this.hideSongInfo();
        }
    }
}