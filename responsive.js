// for responsive design
function calculateAndApplyScale() {
    const container = document.querySelector('.game-container'); // Your parent container
    const topRow = document.querySelector('.top-row');
    const gameBoard = document.querySelector('.game-board');

    // Only execute on screens smaller than 800px
    if (window.innerWidth >= 800) {
        // Optional: Reset styles for larger screens if they were previously scaled
        topRow.style.transform = '';
        gameBoard.style.transform = '';
        topRow.style.marginBottom = '';
        gameBoard.style.marginBottom = '';
        topRow.style.height = '';
        gameBoard.style.height = '';
        return; // Exit the function
    }

    if (!container || !topRow || !gameBoard) return;

    // Configuration - adjust these for your needs
    const GRID_MIN_WIDTH = 700;  // Ideal width your grid needs
    const MIN_SCALE = 0.5;       // Don't go smaller than 50%
    const MAX_SCALE = 1.2;       // Don't go larger than 120%

    // Calculate scale based on available width
    const parentWidth = container.offsetWidth;
    const scaleFactor = parentWidth / GRID_MIN_WIDTH;
    const finalScale = Math.min(Math.max(scaleFactor, MIN_SCALE), MAX_SCALE);

    // Apply the scale
    topRow.style.transform = `scale(${finalScale})`;
    gameBoard.style.transform = `scale(${finalScale})`;

    // Adjust margin to compensate for scaling
    const marginAdjustment = (1 - finalScale) * 20;
    topRow.style.marginBottom = `${20 + marginAdjustment}px`;
    gameBoard.style.marginBottom = `${20 + marginAdjustment}px`;

    // Get the height of the .card-pile and .tableau elements
    const cardPile = document.querySelector('.card-pile');
    const tableau = document.querySelector('.tableau');

    const cardPileHeight = cardPile ? cardPile.offsetHeight : 0;
    const tableauHeight = tableau ? tableau.offsetHeight : 0;

    // Apply the calculated heights to the parent containers
    topRow.style.height = `${cardPileHeight * finalScale}px`;
    gameBoard.style.height = `${tableauHeight * finalScale}px`;
}

// Debounced resize for better performance
let resizeTimeout;
function debouncedResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(calculateAndApplyScale, 100);
}

// Apply on load and resize
window.addEventListener('resize', debouncedResize);
document.addEventListener('DOMContentLoaded', calculateAndApplyScale);

