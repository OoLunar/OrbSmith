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
        setTimeout(() => this.updateVisibility(), this.transitionTime);
    }

    showSongInfo() {
        clearTimeout(this.currentTransitionTimeout);
        this.songInfo.classList.add('visible');
    }

    hideSongInfo() {
        clearTimeout(this.currentTransitionTimeout);
        this.currentTransitionTimeout = setTimeout(() => this.songInfo.classList.remove('visible'), this.transitionTime);
    }

    updateVisibility() {
        if(this.isSongPaused || this.isHovered) {
            this.showSongInfo();
        } else {
            this.hideSongInfo();
        }
    }
}