class Player {
    constructor(element) {
        this.element = element;
        this.transitionTime = 10000;  // 10 seconds
        this.isSongPaused = false;
        this.isHovered = false;
        this.currentTransitionTimeout = null;

        // Hover functionality
        this.element.addEventListener('mouseover', () => this.onHover(true));
        this.element.addEventListener('mouseout', () => this.onHover(false));
    }

    onHover(isHovered) {
        this.isHovered = isHovered;
        this.showSongInfo(this.isHovered);
    }

    pauseSong(isPaused) {
        this.isSongPaused = isPaused;
        if(isPaused) {
            this.showSongInfo(true);
        }
    }

    showSongInfo(visible) {
        clearTimeout(this.currentTransitionTimeout);
        if(visible) {
            this.element.classList.add('visible');
        }

        // Start fade-out only after transition time if not paused or hovered
        this.currentTransitionTimeout = setTimeout(() => {
            if(!this.isHovered && !this.isSongPaused) {
                this.element.classList.remove('visible');
            }
        }, this.transitionTime);
    }
}