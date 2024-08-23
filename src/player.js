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
        this.showSongInfo(this.isHovered);
    }

    pauseSong(isPaused) {
        this.isSongPaused = isPaused;
        this.showSongInfo(true);
    }

    showSongInfo(visible) {
        clearTimeout(this.currentTransitionTimeout);
        if(visible) {
            this.songInfo.classList.add('visible');
        }

        // Start fade-out only after transition time if not paused or hovered
        this.currentTransitionTimeout = setTimeout(() => {
            if(!this.isHovered && !this.isSongPaused) {
                this.songInfo.classList.remove('visible');
            }
        }, this.transitionTime);
    }
}