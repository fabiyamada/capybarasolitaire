// Show tutorial prompt modal on first load
function showTutorialPrompt() {
    // Prevent duplicate modals or show if user previously skipped
    if (document.getElementById('tutorialPromptModal')) return;
    if (localStorage.getItem('tutorialSkipped') === 'true') return;
    const modal = document.createElement('div');
    modal.id = 'tutorialPromptModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.45)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div style="background:#fff;padding:32px 28px 24px 28px;border-radius:16px;box-shadow:0 4px 32px #0002;max-width:350px;text-align:center;">
        <h3>Would you like to see the tutorial?</h3>
        <img src='img/tutorial_class.jpg' style="width:100%;">
        <div style="margin-bottom:20px;color:#444;font-size:1em;">Learn how to play Solitaire step by step!</div>
        <button id="tutorialPromptYes" style="margin-bottom:12px">Yes, please</button>
        <button id="tutorialPromptNo" style="">I know how to play, skip tutorial</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('tutorialPromptYes').onclick = function() {
        modal.remove();
        startTutorial();
    };
    document.getElementById('tutorialPromptNo').onclick = function() {
        modal.remove();
        try {
            localStorage.setItem('tutorialSkipped', 'true');
        } catch (e) {}
    };
}

// Expose showTutorialPrompt globally so it can be called from Play now button
window.showTutorialPrompt = showTutorialPrompt;
// Touch device detection
function isTouchDevice() {
    return (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
}

// Global constants and initial state (ensure these exist to avoid ReferenceError)
const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const CARD_VALUES = ['a','2','3','4','5','6','7','8','9','10','j','q','k'];

// Preload state
let allCardsLoaded = false;
const preloadErrorList = [];

// Card spacing/cache defaults (may be recalculated at runtime)
let CARD_STACK_SPACING_FACE_UP = null;
let CARD_STACK_SPACING_FACE_DOWN = null;
let spacingUp = null;
let spacingDown = null;

let backSkin = 'back01'; // default back skin
// Try to restore persisted choice (safe access)
try {
    const saved = localStorage.getItem('cardBackSkin');
    if (saved) backSkin = saved;
} catch (e) { /* ignore */ }
let frontSkin = 'front_default'; // default front skin
// Try to restore persisted front choice (safe access)
try {
    const savedFront = localStorage.getItem('cardFrontSkin');
    if (savedFront) frontSkin = savedFront;
} catch (e) { /* ignore */ }

function selectBackSkin(skin) {
    // Validate input and normalize
    const allowed = ['back01', 'back02', 'back03'];
    if (!skin || typeof skin !== 'string') {
        console.warn('selectBackSkin: invalid skin', skin);
        return;
    }
    if (!allowed.includes(skin)) {
        console.warn('selectBackSkin: unknown skin, falling back to default:', skin);
        skin = 'back03';
    }

    // Update runtime value and persist preference
    backSkin = skin;
    try { localStorage.setItem('cardBackSkin', backSkin); } catch (e) {}
    // Update stylesheet rule immediately so CSS-controlled backs change even before image loads
    try { ensureCardBackStyle(backSkin); } catch (e) {}

    // Also update any existing DOM elements immediately so the change is visible on click
    try {
        const immediateUrl = `img/cards/back/${backSkin}.jpg`;
        document.querySelectorAll('.card.face-down, .card-face.card-back').forEach(el => {
            el.style.backgroundImage = `url('${immediateUrl}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        });
    } catch (e) { }

    // Update thumbnail UI immediately
    try {
        document.querySelectorAll('.skin-image').forEach(imgEl => {
            if (imgEl.dataset && imgEl.dataset.skin === backSkin) imgEl.classList.add('selected');
            else imgEl.classList.remove('selected');
        });
    } catch (e) { }

    // Re-render display immediately so newly-created card elements use CSS rules
    if (typeof updateDisplay === 'function') try { updateDisplay(); } catch (e) { }

    // Preload the single back image (keeps old onload handling for logging)
    const url = `img/cards/back/${backSkin}.jpg`;
    const img = new Image();
    img.onload = function () {
        // Update any static face-down cards and flip-container back faces
        document.querySelectorAll('.card.face-down, .card-face.card-back').forEach(el => {
            // Apply same sizing/positioning used for front faces
            el.style.backgroundImage = `url('${url}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        });

        // Update skin thumbnails UI (toggle selected class)
        try {
            document.querySelectorAll('.skin-image').forEach(imgEl => {
                if (imgEl.dataset && imgEl.dataset.skin === backSkin) imgEl.classList.add('selected');
                else imgEl.classList.remove('selected');
            });
        } catch (e) { }

        // If a preloader or display update is available, refresh the UI
        if (typeof updateDisplay === 'function') try { updateDisplay(); } catch (e) { /* ignore */ }
        console.log('Card back skin updated to', backSkin);
    };
    img.onerror = function () {
        console.warn('Failed to load card back image:', url);
    };
    img.src = url;
}

// Select and apply a background skin immediately
function selectBg(bg) {
    if (!bg || typeof bg !== 'string') return;
    // Normalize allowed values (fallback to background00)
    const allowed = ['background00', 'background01', 'background02', 'background03'];
    if (!allowed.includes(bg)) bg = 'background00';

    // Remove any existing backgroundNN class from body and add the new one
    try {
        document.body.classList.remove(...allowed);
    } catch (e) { /* ignore if spread fails */ }
    document.body.classList.add(bg);

    // Persist choice
    try { localStorage.setItem('pageBackground', bg); } catch (e) {}

    // Update thumbnail UI
    try {
        document.querySelectorAll('.skin-image').forEach(imgEl => {
            // thumbnails for backgrounds don't use data-skin attribute; compare src or alt
            if (imgEl.getAttribute('onclick') && imgEl.getAttribute('onclick').includes(bg)) imgEl.classList.add('selected');
            else imgEl.classList.remove('selected');
        });
    } catch (e) {}

    // Close skins modal if open
   // try { toggleModal('skins', false); } catch (e) {}
}

// Create or update a stylesheet rule to ensure CSS-driven back faces use current skin
function ensureCardBackStyle(skin) {
    const id = 'card-back-style';
    const url = `img/cards/back/${skin}.jpg`;
    let style = document.getElementById(id);
    const css = `
        /* dynamic card back skin */
        .card .card-back { background-image: url("${url}") !important; }
        .card.face-down { background-image: url("${url}") !important; background-size: cover; background-position: center; }
    `;
    if (!style) {
        style = document.createElement('style');
        style.id = id;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    } else {
        style.textContent = css;
    }
}

// Small visual toast notification for claim results — styles live in style.css
function showClaimNotification(message, duration = 4000) {
    try {
        const existing = document.getElementById('claimNotification');
        if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'claimNotification';
    el.className = 'claim-notification';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    // Add image thumbnail to the left
    const img = document.createElement('img');
    img.className = 'claim-notification-img';
    img.src = 'img/daily_prize_open.png';
    img.alt = '';
    el.appendChild(img);

    const text = document.createElement('div');
    text.className = 'claim-notification-text';
    text.textContent = message;
    el.appendChild(text);

    document.body.appendChild(el);
        // Force layout then animate in via CSS
        void el.offsetWidth;
        el.classList.add('visible');

        // Auto-dismiss helper
        const hide = () => {
            try {
                el.classList.remove('visible');
                // remove after transition
                setTimeout(() => { try { el.remove(); } catch (_) {} }, 320);
            } catch (e) {}
        };

        const timer = setTimeout(hide, duration);
        // allow click to dismiss early
        el.addEventListener('click', () => { clearTimeout(timer); hide(); });
    } catch (e) { console.warn('showClaimNotification error', e); }
}

function getCardStackSpacing(cardElement = null) {
    let isFaceDown = false;

    // Determine if the card is face-down based on the class
    if (cardElement) {
        isFaceDown = cardElement.classList.contains('face-down');
    }

    if (isFaceDown && CARD_STACK_SPACING_FACE_DOWN !== null) return CARD_STACK_SPACING_FACE_DOWN;
    if (!isFaceDown && CARD_STACK_SPACING_FACE_UP !== null) return CARD_STACK_SPACING_FACE_UP;

    try {
        // Try to measure an existing card in the DOM
        const sample = cardElement || document.querySelector('.card');
        let height = 0;
        if (sample) {
            const r = sample.getBoundingClientRect();
            height = r.height;
            isFaceDown = sample.classList.contains('face-down');
        } else {
            // Create a temporary off-screen card to measure CSS-driven size
            const temp = document.createElement('div');
            temp.className = isFaceDown ? 'card face-down' : 'card';
            temp.style.visibility = 'hidden';
            temp.style.position = 'absolute';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            const r = temp.getBoundingClientRect();
            height = r.height;
            temp.remove();
        }
        if (!height || isNaN(height)) height = 110; // fallback to original card height
        // Adjust ratio based on face-up or face-down state
       // const ratio = isFaceDown ? 10 / 110 : 40 / 110;

        spacingDown = Math.max(6, Math.round(height * (10/110)));
        spacingUp = Math.max(6, Math.round(height * (40/110)));
        
        console.log(`**valor espacio boca abajo:`, spacingDown);
        console.log(`**valor espacio boca arriba:`, spacingUp);

    } catch (e) {
        const fallback = isFaceDown ? 10 : 30;
        if (isFaceDown) {
            CARD_STACK_SPACING_FACE_DOWN = fallback;
        } else {
            CARD_STACK_SPACING_FACE_UP = fallback;
        }
        return fallback;
    }
}



// Debounced window resize handler to avoid excessive reflows
(() => {
    let resizeTimer = null;
    const DEBOUNCE_MS = 150;
    function onResize() {
        console.log('# # # # Window resized, recalculating card metrics...');
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Clear cached values to force recalculation
            CARD_STACK_SPACING_FACE_UP = null;
            CARD_STACK_SPACING_FACE_DOWN = null;
            CARD_DIMENSIONS = null;
            
            // Recalculate spacing for both face-up and face-down cards
           // getCardStackSpacing(); // This will recalculate and cache new values
            
            // Update the display to apply new spacing
            updateDisplay();
            
            resizeTimer = null;
        }, DEBOUNCE_MS);
    }
    // Attach listener
    window.addEventListener('resize', onResize);
})();


// Cache full card dimensions (width, height) for reuse
let CARD_DIMENSIONS = null;
function getCardDimensions() {
    if (CARD_DIMENSIONS) return CARD_DIMENSIONS;
    try {
        const sample = document.querySelector('.card');
        let w = 80, h = 110;
        if (sample) {
            const r = sample.getBoundingClientRect();
            w = Math.round(r.width) || w;
            h = Math.round(r.height) || h;
        } else {
            const temp = document.createElement('div');
            temp.className = 'card';
            temp.style.visibility = 'hidden';
            temp.style.position = 'absolute';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            const r = temp.getBoundingClientRect();
            w = Math.round(r.width) || w;
            h = Math.round(r.height) || h;
            temp.remove();
        }
        CARD_DIMENSIONS = { width: w, height: h };
    } catch (e) {
        CARD_DIMENSIONS = { width: 80, height: 110 };
    }
    return CARD_DIMENSIONS;
}

function getAllCardUrls() {
    const urls = [];
    for (const s of CARD_SUITS) {
        for (const v of CARD_VALUES) {
            urls.push(`img/cards/${getFrontDeckDir()}/${v}of${s}.jpg`);
        }
    }
      urls.push('img/cards/back/' + backSkin + '.jpg');
    return urls;
}

function preloadAllCards(onProgress) {
    const urls = getAllCardUrls();
    const total = urls.length;
    let loaded = 0;
    return new Promise((resolve) => {
        urls.forEach(url => {
            const img = new Image();
            img.onload = async () => {
                // Attempt decode to avoid first-use hitch
                if (img.decode) { try { await img.decode(); } catch(_){} }
                loaded++; onProgress && onProgress(loaded, total);
                if (loaded === total) { allCardsLoaded = true; resolve({errors: preloadErrorList}); }
            };
            img.onerror = () => {
                preloadErrorList.push(url);
                loaded++; onProgress && onProgress(loaded, total);
                if (loaded === total) { allCardsLoaded = true; resolve({errors: preloadErrorList}); }
            };
            img.src = url;
        });
    });
}

function updatePreloadStatus(loaded, total) {
    const el = document.getElementById('preloadStatus');
    if (!el) return;
    const percent = Math.round((loaded/total)*100);
    el.textContent = `Loading cuteness ${percent}%`;
    if (percent >= 100) el.textContent = 'Cuteness ready!';
}

async function prepareGameAfterPreload() {
    // Wait for preload before enabling gameplay
    await preloadAllCards(updatePreloadStatus);
    const newGameButtons = document.querySelectorAll('#newGameButton');
    newGameButtons.forEach(btn => btn.disabled = false);
    // Enable splashStart button after preload
    const splashStartBtn = document.getElementById('splashStart');
    if (splashStartBtn) splashStartBtn.disabled = false;
    // Only initialize AFTER assets are cached
    initGame();
}

// ----------------------
// Daily login / daily prize system
// ----------------------

function _safeGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}

function _safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

// Unlocked skins management
function getUnlockedSkins() {
    try { return JSON.parse(_safeGet('unlockedSkins', '[]')) || []; } catch (e) { return []; }
}

function setUnlockedSkins(arr) {
    try { _safeSet('unlockedSkins', JSON.stringify(arr || [])); } catch (e) {}
}

function unlockSkin(skinId) {
    try {
        const arr = getUnlockedSkins();
        if (!arr.includes(skinId)) {
            arr.push(skinId);
            setUnlockedSkins(arr);
        }
        // skinId might be either element id or data-skin value. Try both
        const byId = document.getElementById(skinId);
        if (byId) byId.classList.remove('locked');
        // also remove locked class from any element with data-skin attribute matching
        const byData = document.querySelectorAll(`[data-skin="${skinId}"]`);
        byData.forEach(el => el.closest('.skin-option')?.classList.remove('locked'));
    } catch (e) { console.warn('unlockSkin error', e); }
}

function restoreUnlockedSkins() {
    try {
        const arr = getUnlockedSkins();
        if (!arr || !arr.length) return;
        arr.forEach(skinId => {
            const byId = document.getElementById(skinId);
            if (byId) byId.classList.remove('locked');
            const byData = document.querySelectorAll(`[data-skin="${skinId}"]`);
            byData.forEach(el => el.closest('.skin-option')?.classList.remove('locked'));
        });
    } catch (e) { console.warn('restoreUnlockedSkins error', e); }
}

function getTodayKey() {
    // Use UTC date (yyyy-mm-dd) so prize logic is consistent across timezones.
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function isYesterdayKey(key) {
    if (!key) return false;
    // Compare against UTC "yesterday"
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return key === `${y}-${m}-${day}`;
}

// Render the prize history list using stored claimedDates (most recent first)
function renderPrizeHistory() {
    const container = document.getElementById('prizeHistoryList');
    if (!container) return;
    // keep last 7 days
    let dates = [];
    try { dates = JSON.parse(_safeGet('dailyPrizeDates', '[]')); } catch (e) { dates = []; }
    // Build 7 list items representing days 1..7. We'll mark claimed ones using the dates array.
    // Clear existing children and re-create from the HTML template if present; if not, create simple items.
    const templateItems = container.querySelectorAll('li');
    // If template exists and length >=7 reuse it to preserve images
    if (templateItems && templateItems.length >= 7) {
        templateItems.forEach((li, idx) => {
            // determine corresponding day label: day 1 is index 0
            const dayIndex = idx; // 0..6
            // check if the date for this day exists in dates (we'll match by most recent days)
            const claimed = dates.includes(getTodayKeyForOffset(-(dayIndex)));
            li.classList.toggle('claimed', claimed);
            li.classList.toggle('locked', !claimed);
            const span = li.querySelector('span');
            if (span) span.textContent = claimed ? 'Claimed!' : `Day ${dayIndex + 1}`;
        });
    } else {
        container.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = 'img/daily_prize.png';
            const span = document.createElement('span');
            const claimed = dates.includes(getTodayKeyForOffset(-(i)));
            span.textContent = claimed ? 'Claimed!' : `Day ${i + 1}`;
            li.className = claimed ? 'claimed' : 'locked';
            li.appendChild(img);
            li.appendChild(span);
            container.appendChild(li);
        }
    }
}

function getTodayKeyForOffset(offsetDays) {
    // Return UTC date for today + offsetDays
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Initialize daily prize UI and state on load
function initDailyPrizes() {
    const today = getTodayKey();
    const last = _safeGet('lastDailyPrizeDate', '');
    let streak = parseInt(_safeGet('dailyStreak', '0')) || 0;
    const claimBtn = document.getElementById('claimPrizeButton');
    const prizeMessage = document.getElementById('prizeMessage');

    // Determine if player can claim today
    const canClaim = last !== today;

    if (claimBtn) claimBtn.disabled = !canClaim;
    if (prizeMessage) {
        if (canClaim) {
            if (!last) prizeMessage.textContent = "Welcome! Claim your first daily prize.";
            else if (isYesterdayKey(last)) prizeMessage.textContent = `Back-to-back! Claim today's prize to continue your streak of ${streak} day(s).`;
            else prizeMessage.textContent = 'Welcome back! Your streak was reset — claim today to start a new streak.';
        } else {
            prizeMessage.textContent = 'You already claimed today. Come back tomorrow for another prize!';
        }
    }

    renderPrizeHistory();
}

// Public function wired from index.html
function claimDailyPrize() {
    const today = getTodayKey();
    const last = _safeGet('lastDailyPrizeDate', '');
    let streak = parseInt(_safeGet('dailyStreak', '0')) || 0;
    let dates = [];
    try { dates = JSON.parse(_safeGet('dailyPrizeDates', '[]')); } catch (e) { dates = []; }

    // Prevent double-claim
    if (last === today) {
        const prizeMessage = document.getElementById('prizeMessage');
        if (prizeMessage) prizeMessage.textContent = 'You already claimed today.';
        const claimBtn = document.getElementById('claimPrizeButton'); if (claimBtn) claimBtn.disabled = true;
        return;
    }

    // Update streak. If last was yesterday -> continue streak, otherwise start at 1
    const brokeStreak = !!(last && !isYesterdayKey(last));
    if (isYesterdayKey(last)) streak = streak + 1; else streak = 1;
    _safeSet('dailyStreak', String(streak));

    // Record claim date
    dates = dates || [];
    if (!dates.includes(today)) dates.push(today);
    // keep only last 30 entries
    if (dates.length > 30) dates = dates.slice(dates.length - 30);
    _safeSet('dailyPrizeDates', JSON.stringify(dates));

    // Persist last date
    _safeSet('lastDailyPrizeDate', today);

    // Award a simple token (this can be integrated later with puzzles or inventory)
    // If the player broke their streak (missed yesterday), give a small returning bonus so
    // they still feel rewarded for coming back even after the streak reset.
    const prevTokens = parseInt(_safeGet('dailyPrizeTokens', '0')) || 0;
    const wasFirstClaim = (parseInt(prevTokens, 10) || 0) === 0;
    const returnBonus = brokeStreak ? 1 : 0; // extra token for returning after a missed day
    const newTokens = prevTokens + 1 + returnBonus;
    _safeSet('dailyPrizeTokens', String(newTokens));

    // Award unique prizes per day-of-streak (persisted so each prize is unique)
    try {
        const unique = getUniquePrizes();
        const dayKey = `day${streak}`; // e.g. day1, day2, ...
        if (!unique[dayKey]) {
            // First time awarding this day's prize
            unique[dayKey] = true;
            // Day 1: unlock skin back02
            if (streak === 1) {
                try { unlockSkin('back02'); } catch (e) {}
                try { showClaimNotification('You got a new Skin!'); } catch (e) {}
            }
            // Day 2: award puzzle piece / win
            else if (streak === 2) {
                try {
                    if (typeof totalWins === 'number') {
                        totalWins = (totalWins || 0) + 1;
                        localStorage.setItem('solitaireWins', totalWins);
                        try { updateHiddenImage(); } catch (e) {}
                        try { playWinSound(); } catch (e) {}
                        try { showClaimNotification('You got a puzzle piece!'); } catch (e) {}
                    }
                } catch (e) { console.warn('award puzzle piece error', e); }
            }
            // Day 3: unlock background01
            else if (streak === 3) {
                try { selectBg('background01'); } catch (e) {}
                try { showClaimNotification('You unlocked a new Background!'); } catch (e) {}
            }
            // Day 4: award another puzzle piece / win (unique)
            else if (streak === 4) {
                try {
                    if (typeof totalWins === 'number') {
                        totalWins = (totalWins || 0) + 1;
                        localStorage.setItem('solitaireWins', totalWins);
                        try { updateHiddenImage(); } catch (e) {}
                        try { playWinSound(); } catch (e) {}
                        try { showClaimNotification('You got a puzzle piece!'); } catch (e) {}
                    }
                } catch (e) { console.warn('award puzzle piece error', e); }
            }
            // Day 5: unlock back03 card back
            else if (streak === 5) {
                try { unlockSkin('back03'); } catch (e) {}
                try { showClaimNotification('You unlocked a new Card Back!'); } catch (e) {}
            }
            // Day 6: unlock background02
            else if (streak === 6) {
                try { selectBg('background02'); } catch (e) {}
                try { showClaimNotification('You unlocked a new Background!'); } catch (e) {}
            }
            // Day 7: unlock back04
            else if (streak === 7) {
                try { unlockSkin('back04'); } catch (e) {}
                try { showClaimNotification('You unlocked a new Card Back!'); } catch (e) {}
            }
            // Day 8: award a puzzle piece / win (unique)
            else if (streak === 8) {
                try {
                    if (typeof totalWins === 'number') {
                        totalWins = (totalWins || 0) + 1;
                        localStorage.setItem('solitaireWins', totalWins);
                        try { updateHiddenImage(); } catch (e) {}
                        try { playWinSound(); } catch (e) {}
                        try { showClaimNotification('You got a puzzle piece!'); } catch (e) {}
                    }
                } catch (e) { console.warn('award puzzle piece error', e); }
            }
            // Day 9: unlock background03
            else if (streak === 9) {
                try { selectBg('background03'); } catch (e) {}
                try { showClaimNotification('You unlocked a new Background!'); } catch (e) {}
            }
            // Day 10: unlock deck02
            else if (streak === 10) {
                try { unlockSkin('deck02'); } catch (e) {}
                try { showClaimNotification('You unlocked a new Card Deck!'); } catch (e) {}
            }
            
            else {
                try { showClaimNotification(`You unlocked Day ${streak} prize!`); } catch (e) {}
            }

            // persist unique prize mapping
            try { setUniquePrizes(unique); } catch (e) {}
        }
    } catch (e) { console.warn('unique prize handling error', e); }

    // Update UI (omit token counts from display — tokens are currently unused)
    const prizeMessage = document.getElementById('prizeMessage');
    if (prizeMessage) {
        if (brokeStreak) prizeMessage.textContent = `Welcome back! You claimed today's prize and received a returning bonus. Streak: ${streak} day(s).`;
        else prizeMessage.textContent = `You claimed today's prize! Streak: ${streak} day(s).`;
    }
    const claimBtn = document.getElementById('claimPrizeButton'); if (claimBtn) claimBtn.disabled = true;

    // Clear any small capyprize area to avoid confusing token labels
    const capy = document.querySelector('.capyprize');
    if (capy) capy.textContent = '';

    // Show a small visual notification describing what was claimed
    try {
        if (wasFirstClaim) {
            showClaimNotification('You got a new Skin!');
        } else if (brokeStreak) {
            showClaimNotification(`Welcome back! You received a returning bonus (+${returnBonus} token).`);
        } else {
            showClaimNotification(`You claimed today's prize! Streak: ${streak} day(s).`);
        }
        try { playCardSound('claim'); } catch (e) {}
    } catch (e) {}

    renderPrizeHistory();
}

// Export globally so the HTML inline handlers can call it
window.claimDailyPrize = claimDailyPrize;
window.initDailyPrizes = initDailyPrizes;

// ----------------------

// Show the daily prizes modal once per day. Uses localStorage key 'lastDailyPrizesShownDate'.
function showDailyPrizeOncePerDay() {
    try {
        const today = getTodayKey();
        const lastShown = _safeGet('lastDailyPrizesShownDate', '');
        if (lastShown === today) return; // already shown today
        // Ensure prize UI is initialized before opening
        try { if (typeof initDailyPrizes === 'function') initDailyPrizes(); } catch (e) {}
        // Open modal
        try { toggleModal('dailyPrizes', true); } catch (e) { /* fallback: make visible directly */
            const overlay = document.getElementById('overlay');
            const modal = document.getElementById('dailyPrizes');
            if (overlay) overlay.style.display = 'flex';
            if (modal) modal.style.display = 'block';
        }
        _safeSet('lastDailyPrizesShownDate', today);
        return true;
    } catch (e) { console.warn('showDailyPrizeOncePerDay error', e); }
}

// Watch a modal (by id) for being closed (style.display === 'none') then call cb once
function watchModalCloseThen(cb, modalId) {
    try {
        const modal = document.getElementById(modalId);
        if (!modal) { cb(); return; }
        // If it's already hidden, call cb immediately
        const style = window.getComputedStyle(modal);
        if (style.display === 'none' || style.visibility === 'hidden') { cb(); return; }

        const obs = new MutationObserver((mutationsList) => {
            for (const m of mutationsList) {
                if (m.type === 'attributes' && m.attributeName === 'style') {
                    const s = window.getComputedStyle(modal);
                    if (s.display === 'none' || s.visibility === 'hidden') {
                        try { cb(); } catch (_) {}
                        obs.disconnect();
                        return;
                    }
                }
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['style'] });
        // Also listen for click on overlay background as a defensive close
        const overlay = document.getElementById('overlay');
        function onOverlayClick(e) {
            // if modal hidden now, trigger cb
            const s = window.getComputedStyle(modal);
            if (s.display === 'none' || s.visibility === 'hidden') {
                try { cb(); } catch (_) {}
                overlay && overlay.removeEventListener('click', onOverlayClick);
                obs.disconnect();
            }
        }
        if (overlay) overlay.addEventListener('click', onOverlayClick);
    } catch (e) { try { cb(); } catch (_) {} }
}


window.onload = async () => {
        initAudio();
        totalWins = parseInt(localStorage.getItem('solitaireWins')) || 0;
        updateHiddenImage();
        // Disable New Game until cards ready
        const newGameButtons = document.querySelectorAll('#newGameButton');
        newGameButtons.forEach(button => { button.disabled = true; });
    prepareGameAfterPreload();
    // Apply persisted back skin immediately so UI shows chosen back
    try { if (typeof selectBackSkin === 'function') selectBackSkin(backSkin); } catch (e) {}
    // Apply persisted page background if present
    try {
        const savedBg = localStorage.getItem('pageBackground');
        if (savedBg && typeof selectBg === 'function') selectBg(savedBg);
    } catch (e) {}


    // Start the game loop/timer
    console.log("5. Starting game interval...");
    setInterval(() => { if (!gameWon) { updateTimeDisplay(); } }, 1000);

    function updateTimeDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('time').textContent = `⏳ ${minutes}:${seconds}`;
}

    // (Buttons re-enabled after preload finishes)

    // --- Splash screen logic ---
    try {
        const splashEl = document.getElementById('splash');
        const splashBtn = document.getElementById('splashStart');
        const gameContainer = document.querySelector('.game-container');
        const gameCover = document.querySelector('.game_cover');

        function hideSplash() {
            if (!splashEl) return;
            splashEl.style.display = 'none';
            gameCover.style.display = 'none';
            splashEl.setAttribute('aria-hidden', 'true');
            if (gameContainer) gameContainer.style.pointerEvents = '';
            playCardSound('start');
            try { localStorage.setItem('splashDismissed', 'true'); } catch (e) {};
            // Prefer showing daily prizes first. If the prize modal opens, wait until it's closed to show the tutorial.
            try {
                const opened = showDailyPrizeOncePerDay();
                if (opened) {
                    watchModalCloseThen(() => { try { showTutorialPrompt(); } catch (e) {} }, 'dailyPrizes');
                } else {
                    showTutorialPrompt();
                }
            } catch (e) {
                // fallback
                showTutorialPrompt();
            }
        }

        function showSplash() {
            if (!splashEl) return;
            splashEl.style.display = 'flex';
            splashEl.setAttribute('aria-hidden', 'false');
            if (gameContainer) gameContainer.style.pointerEvents = 'none';
        }

        // Show on first visit (no localStorage flag) OR on hard reload
        const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
        const isReload = (navEntries && navEntries[0] && navEntries[0].type === 'reload') || (performance && performance.navigation && performance.navigation.type === 1);
        const dismissed = localStorage.getItem('splashDismissed') === 'true';

        if (!dismissed || isReload) showSplash(); else hideSplash();

        if (splashBtn) splashBtn.addEventListener('click', hideSplash);
        // Allow ESC key to close
        document.addEventListener('keydown', (e) => { if ((e.key === 'Escape' || e.key === 'Esc') && splashEl && splashEl.style.display !== 'none') hideSplash(); });
    } catch (e) { console.warn('Splash init error', e); }

    // Initialize daily prizes UI/state
    try { if (typeof initDailyPrizes === 'function') initDailyPrizes(); } catch (e) { /* ignore */ }
    try { restoreUnlockedSkins(); } catch (e) { /* ignore */ }
    // If splash was already dismissed, hideSplash() will have called showDailyPrizeOncePerDay as needed
};

        // Variables del juego
    let deck = [], stock = [], waste = [], foundations = [[], [], [], []], tableaux = [[], [], [], [], [], [], []];
    let selectedCards = [], selectedPile = null, selectedIndex = null;
    let score = 0, moves = 0, startTime = Date.now(), gameWon = false;
    // Track if a draw-from-stock animation is currently running to prevent
    // overlapping draws and to allow preserving the waste DOM during the
    // animation.
    let drawInProgress = false;
        let audioContext = null, soundEnabled = true;
        let totalWins = 0, winCountedThisGame = false;

    let gameHistory = [];
    const MAX_HISTORY_SIZE = 50;

        let undoCount = 50;

        function cloneCard(card) { return { ...card }; }
        function deepClonePiles(piles) { return piles.map(p => p.map(cloneCard)); }
        function gameStateSignature() {
            // Use stable unique ids plus face state to detect changes precisely
            return JSON.stringify({
                stock: stock.map(c => c.id + (c.faceUp? 'U':'D')),
                waste: waste.map(c => c.id + (c.faceUp? 'U':'D')),
                foundations: foundations.map(f => f.map(c => c.id + (c.faceUp? 'U':'D'))),
                tableaux: tableaux.map(t => t.map(c => c.id + (c.faceUp? 'U':'D')))
            });
        }
        function debugState(label='') {
            console.log('[DEBUG]', label, {
                stock: stock.map(c=>c.id),
                waste: waste.map(c=>c.id),
                foundations: foundations.map(f=>f.map(c=>c.id)),
                tableaux: tableaux.map(t=>t.map(c=>c.id))
            });
        }
        function saveState() {
            const currentSig = gameStateSignature();
            if (gameHistory.length > 0) {
                const last = gameHistory[gameHistory.length - 1];
                if (last._sig === currentSig) {
                    return; // no change
                }
            }
            const state = {
                stock: stock.map(cloneCard),
                waste: waste.map(cloneCard),
                foundations: deepClonePiles(foundations),
                tableaux: deepClonePiles(tableaux),
                score,
                moves,
                _sig: currentSig // internal use only
            };
            gameHistory.push(state);
            if (gameHistory.length > MAX_HISTORY_SIZE) gameHistory.shift();
            console.log(`State saved. History size: ${gameHistory.length}`);
        }

        function initAudio() {
            try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
            catch (e) { console.log('Web Audio API no soportada:', e); soundEnabled = false; }
        }

        function playCardSound(type = 'move') {
            if (!soundEnabled || !audioContext) return;
            try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                switch(type) {
                    case 'move': oscillator.frequency.setValueAtTime(400, audioContext.currentTime); oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1); gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.15); break;
                    case 'flip': oscillator.frequency.setValueAtTime(600, audioContext.currentTime); oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.08); gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.12); break;
                    case 'foundation': oscillator.frequency.setValueAtTime(800, audioContext.currentTime); oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1); gainNode.gain.setValueAtTime(0.12, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.2); break;
                    case 'shuffle': oscillator.type = 'square'; oscillator.frequency.setValueAtTime(150, audioContext.currentTime); oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3); gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.35); break;
                    case 'error': oscillator.type = 'square'; oscillator.frequency.setValueAtTime(200, audioContext.currentTime); oscillator.frequency.setValueAtTime(180, audioContext.currentTime + 0.05); oscillator.frequency.setValueAtTime(160, audioContext.currentTime + 0.1); gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.15); break;
                    case 'select': oscillator.frequency.setValueAtTime(500, audioContext.currentTime); gainNode.gain.setValueAtTime(0.06, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.08); break;
                    case 'start':
                oscillator.type = 'triangle'; // Un tipo de onda que suena más suave y melódica
                
                // Pequeña melodía ascendente
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
                oscillator.frequency.linearRampToValueAtTime(523.25, audioContext.currentTime + 0.15); // C5
                oscillator.frequency.linearRampToValueAtTime(659.25, audioContext.currentTime + 0.30); // E5
                oscillator.frequency.linearRampToValueAtTime(880, audioContext.currentTime + 0.50); // A5

                // Control de volumen para un efecto de "fade out"
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.30);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6); // Se desvanece al final

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.6); // El sonido durará 0.6 segundos
                break;
                case 'claim': {
                // A short, sparkling arpeggio for claiming a prize
                try {
                    const now = audioContext.currentTime;
                    const freqs = [740, 987.77, 1244.51]; // F#5, B5, D6 - bright triad
                    freqs.forEach((f, i) => {
                        const osc = audioContext.createOscillator();
                        const g = audioContext.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(f, now + i * 0.08);
                        g.gain.setValueAtTime(0.16 * Math.pow(0.8, i), now + i * 0.08);
                        // quick decay
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
                        osc.connect(g);
                        g.connect(audioContext.destination);
                        osc.start(now + i * 0.08);
                        osc.stop(now + i * 0.08 + 0.38);
                    });
                    // Add a tiny bell overlay
                    const bell = audioContext.createOscillator();
                    const bellGain = audioContext.createGain();
                    bell.type = 'triangle';
                    bell.frequency.setValueAtTime(1320, now);
                    bellGain.gain.setValueAtTime(0.08, now);
                    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                    bell.connect(bellGain);
                    bellGain.connect(audioContext.destination);
                    bell.start(now);
                    bell.stop(now + 0.45);
                } catch (e) { console.log('Error in claim sound:', e); }
                break;
                }
                }
            } catch (e) { console.log('Error reproducing sound:', e); }
        }
        function playWinSound() {
            if (!soundEnabled || !audioContext) return;
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, index) => {
                setTimeout(() => {
                    try {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.5);
                    } catch (e) { console.log('Error in victory sound:', e); }
                }, index * 200);
            });
        }
        function toggleSound() {
  soundEnabled = !soundEnabled;

  const button = document.getElementById('soundToggle');
  const iconSpan = button.querySelector('.button-icon'); // busca el span del icono

  if (iconSpan) {
    iconSpan.textContent = soundEnabled ? '🔊' : '🔇';
  }

  if (soundEnabled && !audioContext) initAudio();
  if (soundEnabled) playCardSound('select');
}

        function createDeck() { 
            const suits = ['♠', '♥', '♦', '♣']; 
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']; 
            const colors = ['black', 'red', 'red', 'black']; 
            deck = []; 
            let idCounter = 0; 
            for (let s = 0; s < suits.length; s++) { 
                for (let v = 0; v < values.length; v++) { 
                    deck.push({ id: idCounter++, suit: suits[s], value: values[v], color: colors[s], faceUp: false, numValue: v + 1 }); 
                } 
            } 
        }
        function shuffleDeck() { playCardSound('shuffle'); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }
        function initGame() {
            createDeck(); shuffleDeck();
            stock = [...deck]; waste = []; foundations = [[], [], [], []]; tableaux = [[], [], [], [], [], [], []];
            for (let col = 0; col < 7; col++) { for (let row = 0; row <= col; row++) { const card = stock.pop(); if (row === col) card.faceUp = true; tableaux[col].push(card); } }
            score = 0; moves = 0; startTime = Date.now(); gameWon = false; winCountedThisGame = false;
            clearSelection(); updateDisplay();
            updateUndoDisplay();
            // Save initial state so first undo works correctly
            gameHistory = [];
            saveState();
        }

        function preloadCardImages() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades']
  const values = [
    'a',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'j',
    'q',
    'k',
  ]

  // Precarga todas las 52 caras de las cartas
  for (const suit of suits) {
    for (const value of values) {
            const img = new Image()
            img.src = `img/cards/${getFrontDeckDir()}/${value}of${suit}.jpg`
    }
  }

  // Precarga la imagen del reverso de la carta
    const backImg = new Image();
    backImg.src = `img/cards/back/${backSkin}.jpg`;
}
// Old preload removed (now using full-deck promise preloader)

function createCardElement(card, index = 0, skipSpacing = false) {
    const cardEl = document.createElement('div');
    // Add data-id for tutorial hand targeting
    if (card.id === 'aofspades' || card.id === 'A♠' || card.id === 'Aofspades') {
        cardEl.setAttribute('data-id', 'aofspades');
    }
    // Support a transient flag _animateFlip to render as a flip-capable element
    const animateFlip = !!card._animateFlip;
    cardEl.className = `card ${card.color}` + (animateFlip ? ' flip-anim' : '');
    if (animateFlip) {
        // wrap faces inside so CSS 3D transform can show back/front
        cardEl.classList.add('card-flip-container');
    }

    // Asignar un ID único basado en las propiedades de la carta
    cardEl.id = `card-${card.id}`; // Usa la propiedad `id` de la carta

    // If animation requested, render inner faces so we can flip visually.
    if (animateFlip) {
        // Back face (initially shown)
        const back = document.createElement('div');
        back.className = 'card-face card-back';
        // Front face (hidden until flipped)
        const front = document.createElement('div');
        front.className = 'card-face card-front';

        const value = card.value.toLowerCase();
        const suit = card.suit === '♥' ? 'hearts' : 
                     card.suit === '♦' ? 'diamonds' : 
                     card.suit === '♣' ? 'clubs' : 'spades';
            const imagePath = `img/cards/${getFrontDeckDir()}/${value}of${suit}.jpg`;
        front.style.backgroundImage = `url('${imagePath}')`;
        front.style.backgroundSize = 'cover';
        front.style.backgroundPosition = 'center';

        cardEl.appendChild(back);
        cardEl.appendChild(front);
        // If card is logically faceUp but we want to animate the flip from back -> front,
        // keep the DOM showing back initially and flip via JS after insertion.
        if (card.faceUp) {
            cardEl.classList.remove('face-down');
        } else {
            cardEl.classList.add('face-down');
        }
    } else {
        if (!card.faceUp) {
            cardEl.className += ' face-down';
        } else {
            const value = card.value.toLowerCase();
            const suit = card.suit === '♥' ? 'hearts' : 
                         card.suit === '♦' ? 'diamonds' : 
                         card.suit === '♣' ? 'clubs' : 'spades';
            const imagePath = `img/cards/${getFrontDeckDir()}/${value}of${suit}.jpg`;
            cardEl.style.backgroundImage = `url('${imagePath}')`;
            cardEl.style.backgroundSize = 'cover';
            cardEl.style.backgroundPosition = 'center';
            
            // Añade el valor y el palo de la carta dentro de un span
            const rankAndSuit = document.createElement('span');
            rankAndSuit.className = 'card-label';
            rankAndSuit.innerHTML = `${card.value}<br>${card.suit}`;
            cardEl.appendChild(rankAndSuit);
        }
    }

    if (!skipSpacing) {
        const stackSpacing = getCardStackSpacing(cardEl); // Pass the card element
        cardEl.style.top = `${index * stackSpacing}px`;
    }
    cardEl.style.zIndex = index + 1;
    return cardEl;
}


// Modificar la función updateDisplay para hacer clickeable las cartas de foundation
function updateDisplay() {
    const stockEl = document.getElementById('stock');
    stockEl.innerHTML = '';
    if (stock.length > 0) {
        const cardEl = createCardElement({...stock[0], faceUp: false});
        cardEl.style.top = '5px';
        cardEl.dataset.pile = 'stock';
        cardEl.dataset.index = '0';
        if (tutorialMode) {
            cardEl.onclick = null;
            cardEl.style.pointerEvents = 'none';
            stockEl.onclick = null;
            stockEl.style.pointerEvents = 'none';
        } else {
            cardEl.onclick = (event) => {
                console.log('Stock card clicked!');
                drawCards(event);
            };
            cardEl.style.pointerEvents = '';
            stockEl.onclick = null;
            stockEl.style.pointerEvents = '';
        }
        stockEl.appendChild(cardEl);
    } else {
        if (tutorialMode) {
            stockEl.onclick = null;
            stockEl.style.pointerEvents = 'none';
        } else {
            stockEl.onclick = (event) => {
                console.log('Empty stock area clicked!');
                drawCards(event);
            };
            stockEl.style.pointerEvents = '';
        }
    }

    // Waste pile rendering (show up to 3 cards)
    const wasteEl = document.getElementById('waste');
    wasteEl.querySelectorAll('.temp-back-placeholder').forEach(el => el.remove());
    wasteEl.innerHTML = '';
    if (waste.length > 0) {
        let showCount = Math.min(3, waste.length);
        for (let i = waste.length - showCount; i < waste.length; i++) {
            const card = waste[i];
            const cardEl = createCardElement(card);
            cardEl.style.top = '5px';
            cardEl.dataset.pile = 'waste';
            cardEl.dataset.index = i.toString();
            cardEl.onclick = () => {
                console.log('Waste card clicked:', card.id);
                handlePileClick(waste, i, 'waste');
            };
            cardEl.ondblclick = () => {
                console.log('Waste card double-clicked:', card.id);
                handleCardDoubleClick(waste, i);
            };
            cardEl.style.zIndex = (i === waste.length - 1) ? '99' : (90 + i);
            if (selectedPile === 'waste' && selectedIndex === i) {
                cardEl.classList.add('selected');
            }
            // Make waste cards draggable
            cardEl.draggable = true;
            cardEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ pile: 'waste', index: i }));
                e.dataTransfer.effectAllowed = 'move';
            });
            wasteEl.appendChild(cardEl);
        }
    } else {
        console.log('Waste pile is empty, no card to display');
    }

    for (let i = 0; i < 4; i++) {
        const foundEl = document.getElementById(`foundation-${i}`);
        foundEl.innerHTML = '';
        foundEl.className = 'card-pile foundation';
        // Add a class for tutorial hand targeting (only to foundation-0 for now)
        if (i === 0) foundEl.classList.add('foundation-pile');
        foundEl.onclick = () => handlePileClick(foundations[i], -1, `foundation-${i}`);
        if (foundations[i].length === 0) {
            foundEl.className += ' empty-foundation';
        } else {
            const topCard = foundations[i][foundations[i].length - 1];
            const cardEl = createCardElement(topCard);
            cardEl.style.top = '5px';
            // NUEVO: Hacer la carta clickeable para seleccionarla
            cardEl.onclick = (e) => {
                e.stopPropagation(); // Evitar que se active el click del contenedor
                handlePileClick(foundations[i], foundations[i].length - 1, `foundation-${i}`);
            };
            // Agregar clase selected si está seleccionada
            if (selectedPile === `foundation-${i}` && selectedIndex === foundations[i].length - 1) {
                cardEl.classList.add('selected');
            }
            foundEl.appendChild(cardEl);
        }
    }
            
            for (let i = 0; i < 7; i++) {
                const tableauEl = document.getElementById(`tableau-${i}`);
                tableauEl.innerHTML = '';
                if (tutorialMode) {
                    tableauEl.onclick = null;
                    tableauEl.style.pointerEvents = 'none';
                } else {
                    tableauEl.onclick = (e) => {
                        if (e.target === tableauEl) {
                            handlePileClick(tableaux[i], -1, `tableau-${i}`);
                        }
                    };
                    tableauEl.style.pointerEvents = '';
                }
                tableaux[i].forEach((card, index) => {
                    const cardEl = createCardElement(card, index, true);
                    if (tutorialMode) {
                        cardEl.onclick = null;
                        cardEl.ondblclick = null;
                        cardEl.style.pointerEvents = 'none';
                    } else {
                        cardEl.onclick = () => handlePileClick(tableaux[i], index, `tableau-${i}`);
                        cardEl.ondblclick = () => handleCardDoubleClick(tableaux[i], index);
                        cardEl.style.pointerEvents = '';
                    }
                    if (selectedPile === `tableau-${i}` && index >= selectedIndex) {
                        cardEl.classList.add('selected');
                    }
                    tableauEl.appendChild(cardEl);
                });
            }

            // Aplicar espaciado personalizado a las primeras cartas boca arriba
            applySpacingToFirstFaceUpCards();

            document.getElementById('score').textContent = `⭐: ${score}`;
            document.getElementById('moves').textContent = `🖐️: ${moves}`;

            enableDragAndDrop();
           enableTouchDragAndDrop();
           

            if (!gameWon && foundations.every(f => f.length === 13)) {
                gameWon = true; 
                document.getElementById('winPuzzlePiece').style.display = 'none';
                document.getElementById('winSeason').style.display = 'none';
                document.getElementById('winOverlay').style.display = 'block';
                document.getElementById('winMessage').style.display = 'block';
                if (totalWins >= 16) {
                    document.getElementById('winSeason').style.display = 'block';
                } else {   
                    document.getElementById('winPuzzlePiece').style.display = 'block';
                }
                setTimeout(() => playWinSound(), 300);
                if (!winCountedThisGame) {
                    winCountedThisGame = true;
                    totalWins++;
                    localStorage.setItem('solitaireWins', totalWins);
                    updateHiddenImage();
                }


            }
            


        }



        function updateHiddenImage() { 
            const panels = document.querySelectorAll('.image-panel'); 
            for (let i = 0; i < panels.length; i++) { 
                if (i < totalWins) { 
                    panels[i].classList.add('revealed'); 
                } else { 
                    panels[i].classList.remove('revealed'); 
                } 
            } 
            const secondImageContainer = document.getElementById('second-image');
            if (totalWins >= 4) {
                secondImageContainer.style.display = 'block';
            } else {
                secondImageContainer.style.display = 'none';
            }

            const thirdImageContainer = document.getElementById('third-image');
            if (totalWins >= 8) {
               thirdImageContainer.style.display = 'block';
            } else {
                thirdImageContainer.style.display = 'none';
            }

            const fourthImageContainer = document.getElementById('fourth-image');
            if (totalWins >= 12) {
               fourthImageContainer.style.display = 'block';
            } else {
                fourthImageContainer.style.display = 'none';
            }
        }

        function resetImageProgress() {
            if (confirm('Are you sure you want to restart? All progress will be lost.')) {
                totalWins = 0;
                localStorage.setItem('solitaireWins', 0);
                updateHiddenImage();
                playCardSound('shuffle');
            }
        }

        function simulateWin() {
            if (gameWon) return;
            gameWon = true;
            
            document.getElementById('winPuzzlePiece').style.display = 'none';
                document.getElementById('winSeason').style.display = 'none';
                document.getElementById('winOverlay').style.display = 'block';
                document.getElementById('winMessage').style.display = 'block';
                if (totalWins >= 16) {
                    document.getElementById('winSeason').style.display = 'block';
                } else {   
                    document.getElementById('winPuzzlePiece').style.display = 'block';
                }
            setTimeout(() => playWinSound(), 300);
            if (!winCountedThisGame) {
                winCountedThisGame = true;
                totalWins++;
                localStorage.setItem('solitaireWins', totalWins);
                updateHiddenImage();
            }

            
        }

// Modificar la función handlePileClick para permitir seleccionar cartas de foundation
function handlePileClick(pile, cardIndex, pileType) {
    const clickedCard = (cardIndex !== -1 && pile.length > 0) ? pile[cardIndex] : null;

    if (selectedCards.length > 0) {
        if (selectedPile === pileType && selectedIndex === cardIndex) {
            clearSelection();
           // updateDisplay();
            return;
        }
        
        if (pileType.startsWith('tableau')) {
            const targetIndex = parseInt(pileType.split('-')[1]);
            moveToTableau(targetIndex);
            
        } else if (pileType.startsWith('foundation')) {
            const targetIndex = parseInt(pileType.split('-')[1]);
            moveToFoundation(targetIndex);
            
        } else {
            playCardSound('error');
            clearSelection();
            saveState();
            updateDisplay();
        }
        return;
    }

    if (!clickedCard) return;

    if (!clickedCard.faceUp) {
        playCardSound('error');
        return;
    }

    if (pileType.startsWith('tableau')) {
        // Validación para mover múltiples cartas en el Tableau
        for (let i = cardIndex; i < pile.length - 1; i++) {
            const current = pile[i];
            const next = pile[i + 1];
            if (current.color === next.color || current.numValue !== next.numValue + 1) {
                playCardSound('error');
                return;
            }
        }
        selectedCards = pile.slice(cardIndex);
        selectedPile = pileType;
        selectedIndex = cardIndex;
    } else if (pileType.startsWith('foundation')) {
        // NUEVO: Permitir seleccionar la carta superior de una foundation
        if (cardIndex === pile.length - 1) { // Solo la carta superior
            selectedCards = [clickedCard];
            selectedPile = pileType;
            selectedIndex = cardIndex;
        } else {
            playCardSound('error');
            return;
        }
    } else {
        selectedCards = [clickedCard];
        selectedPile = pileType;
        selectedIndex = cardIndex;
    }
    playCardSound('select');
    updateDisplay();
}

        function handleCardDoubleClick(pile, cardIndex) {
            console.log('doble click detectado');
            if (cardIndex !== pile.length - 1) { return; }
            const card = pile[cardIndex];
            if (!card || !card.faceUp) return;
            for (let i = 0; i < 4; i++) {
                if (canMoveToFoundation(card, foundations[i])) {
                    pile.pop();
                    foundations[i].push(card);
                    moves++;
                    score += 10;
                    playCardSound('foundation');
                    checkForFaceUp();
                    clearSelection();
                    updateDisplay();
                    
                     saveState();
                    return;
                }
            }
            playCardSound('error');
            clearSelection();
    updateDisplay();
        }

        function clearSelection() { selectedCards = []; selectedPile = null; selectedIndex = null; }

    async function drawCards(ev) {
    console.log('drawCards called - stock length:', stock.length, 'waste length:', waste.length);
    clearSelection();
    if (stock.length > 0) {
        if (drawInProgress) {
            console.log('Draw already in progress, ignoring click');
            return;
        }
        drawInProgress = true;
        // Draw only 1 card from stock
        let drawCount = Math.min(1, stock.length);
        let drawnCards = [];
        for (let i = 0; i < drawCount; i++) {
            let card = stock.pop();
            card.faceUp = true;
            drawnCards.push(card);
        }
        waste.push(...drawnCards);
        moves++;
        saveState();
        playCardSound('flip');
        updateDisplay();
        drawInProgress = false;
    } else if (waste.length > 0) {
        // When stock is empty, recycle waste pile back to stock (all face down, in order)
        while (waste.length > 0) {
            let card = waste.pop();
            card.faceUp = false;
            stock.unshift(card); // maintain original order
        }
        moves++;
        saveState();
        playCardSound('shuffle');
        updateDisplay();
    } else {
        console.log('Both stock and waste are empty - nothing to draw');
    }
}

// Pre-decode an image using Image() API; resolves when decoded or rejects on error
function decodeImage(url, timeout = 2000) {
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            let finished = false;
            const clean = () => { img.onload = null; img.onerror = null; };
            const onLoadSuccess = () => {
                if (finished) return; finished = true; clean();
                // If decode API present, use it for guaranteed decode
                if (img.decode) {
                    img.decode().then(() => resolve(img)).catch(() => resolve(img));
                } else {
                    resolve(img);
                }
            };
            img.onload = onLoadSuccess;
            img.onerror = (e) => { if (finished) return; finished = true; clean(); reject(e); };
            img.src = url;
            // timeout: reject if not loaded in time
            const to = setTimeout(() => {
                if (finished) return; finished = true; clean(); reject(new Error('Image decode timeout'));
            }, timeout);
        } catch (err) { reject(err); }
    });
}

        // Create a floating card element used for animating movement between piles.
        // This is simplified: it contains a single face showing the front image.
        function createFloatingAnimCard(card) {
            const el = document.createElement('div');
            el.className = 'card';
            // Create a front container where the image/label will be applied
            const front = document.createElement('div');
            front.className = 'card-front';
            front.style.position = 'absolute';
            front.style.inset = '0';
            el.appendChild(front);
            return el;
        }

// Find the waste pile DOM element for the given card id and animate flip
function triggerWasteFlipAnimation(cardId) {
    // Flip animation removed: this function is now a no-op because
    // the waste card is revealed immediately by `drawCards`.
    return;
}

        function moveToFoundation(foundationIndex) {
            if (selectedCards.length === 1) {
                const card = selectedCards[0];
                const foundation = foundations[foundationIndex];
                if (canMoveToFoundation(card, foundation)) {
                    removeSelectedCardsFromSource();
                    foundation.push(card);
                    score += 10;
                    moves++;
                    playCardSound('foundation');
                    checkForFaceUp();
                    clearSelection();
                    saveState();
                    updateDisplay();
                } else {
                    playCardSound('error');
                    clearSelection();
                    updateDisplay();
                }
            } else {
                playCardSound('error');
            }
        }

        function moveToTableau(tableauIndex) {
            if (selectedCards.length > 0) {
                const tableau = tableaux[tableauIndex];
                const firstCard = selectedCards[0];
                if (canMoveToTableau(firstCard, tableau)) {
                    removeSelectedCardsFromSource();
                    tableau.push(...selectedCards);
                    moves++;
                    playCardSound('move');
                    checkForFaceUp();
                    clearSelection();
                    saveState();
                    updateDisplay();
                } else {
                    playCardSound('error');
                    clearSelection();
                    updateDisplay();
                }
            }
        }

        function canMoveToFoundation(card, foundation) {
            if (foundation.length === 0) { return card.value === 'A'; }
            const topCard = foundation[foundation.length - 1];
            return card.suit === topCard.suit && card.numValue === topCard.numValue + 1;
        }

        function canMoveToTableau(card, tableau) {
            // Diagnostic log for touch drop issues
            try {
                console.log('canMoveToTableau: card=', card && card.value, 'tableauLen=', tableau.length, 'top=', tableau.length ? tableau[tableau.length - 1].value : 'none');
            } catch (e) {
                console.log('canMoveToTableau: error logging state', e);
            }
            if (tableau.length === 0) { return card.value === 'K'; }
            const topCard = tableau[tableau.length - 1];
            return card.color !== topCard.color && card.numValue === topCard.numValue - 1;
        }

        // Modificar la función removeSelectedCardsFromSource para incluir foundations
function removeSelectedCardsFromSource() {
    if (!selectedPile) return;
    if (selectedPile === 'waste') {
        waste.pop();
    } else if (selectedPile.startsWith('tableau')) {
        const index = parseInt(selectedPile.split('-')[1]);
        tableaux[index].splice(selectedIndex);
    } else if (selectedPile.startsWith('foundation')) {
        // NUEVO: Remover carta de foundation
        const index = parseInt(selectedPile.split('-')[1]);
        foundations[index].pop();
    }
}

        function checkForFaceUp() {
            for (let i = 0; i < 7; i++) {
                const tableau = tableaux[i];
                if (tableau.length > 0) {
                    const topCard = tableau[tableau.length - 1];
                    if (!topCard.faceUp) {
                        topCard.faceUp = true;
                        score += 5;
                        playCardSound('flip');
                    }
                }
            }
        }

        async function newGame() {

   // Clear the game history
    gameHistory = []; 
    playCardSound('start');
    document.getElementById('winMessage').style.display = 'none'; 
    document.getElementById('winOverlay').style.display = 'none';
    initGame(); 
}

        function autoComplete() {
            let moveCount = 0;
            const tryMove = () => {
                if (waste.length > 0) {
                    const card = waste[waste.length - 1];
                    for (let i = 0; i < 4; i++) {
                        if (canMoveToFoundation(card, foundations[i])) {
                            foundations[i].push(waste.pop());
                            return true;
                        }
                    }
                }
                for (let t = 0; t < 7; t++) {
                    if (tableaux[t].length > 0) {
                        const card = tableaux[t][tableaux[t].length - 1];
                        for (let i = 0; i < 4; i++) {
                            if (canMoveToFoundation(card, foundations[i])) {
                                foundations[i].push(tableaux[t].pop());
                                checkForFaceUp();
                                return true;
                            }
                        }
                    }
                }
                return false;
            };
            const autoMoveInterval = setInterval(() => {
                if (tryMove()) {
                    moves++;
                    score += 10;
                    playCardSound('foundation');
                    saveState();
                    updateDisplay();
                    moveCount++;
                } else {
                    clearInterval(autoMoveInterval);
                    if (moveCount === 0) playCardSound('error');
                }
            }, 100);
        }

function undo() {
    // Player has no free undos left
    if (undoCount <= 0) {
        // Here you can show a prompt or button to watch an ad
        console.log("No more undos.");
        // The user will click a separate button to watch the ad.
        return; 
    }

    if (gameHistory.length > 1) {
        gameHistory.pop();
        const lastState = gameHistory[gameHistory.length - 1];
        // Deep clone when restoring so saved snapshot remains immutable
        stock = lastState.stock.map(cloneCard);
        waste = lastState.waste.map(cloneCard); 
        foundations = lastState.foundations.map(f => f.map(cloneCard));
        tableaux = lastState.tableaux.map(t => t.map(cloneCard));
        score = lastState.score;
        moves = lastState.moves;

        clearSelection();
        updateDisplay();

        // Decrement the undo counter
        undoCount--;
        updateUndoDisplay(); // You'll create this function to show the count
    } else {
        playCardSound('start'); 
    }
}


function updateUndoDisplay() {
    const undoButton = document.getElementById('undoButton');
   
    const undoCountDisplay = document.getElementById('undoCountDisplay');

    // Update the text to show the current count
    undoCountDisplay.textContent = `(${undoCount})`;

    // Disable the button if the count is zero
    if (undoCount <= 0) {
        undoButton.disabled = true;
        
    } else {
        undoButton.disabled = false;
        
    }
}

// --------------------- Drag & Drop ---------------------

function enableDragAndDrop() {
    console.log("enableDragAndDrop: inicializando...");

    // Resetear eventos previos
    document.querySelectorAll('.card').forEach(el => {
        el.draggable = false;
        el.ondragstart = null;
        el.ondragend = null;
    });
    document.querySelectorAll('.tableau, .foundation, #waste, #stock').forEach(el => {
        el.ondragover = null;
        el.ondrop = null;
        el.ondragenter = null;
        el.ondragleave = null;
    });

    // Tableaux
    for (let t = 0; t < 7; t++) {
        const tableauEl = document.getElementById(`tableau-${t}`);
        // Ensure the tableau container itself has a dataset.pile so touch drop logic
        // (which inspects dropTarget.dataset.pile) can detect empty tableaux.
        if (tableauEl) tableauEl.dataset.pile = `tableau-${t}`;
        const cardsInDOM = tableauEl.querySelectorAll('.card');
        cardsInDOM.forEach((cardEl, idx) => {
            cardEl.dataset.pile = `tableau-${t}`;
            cardEl.dataset.index = idx;
            if (!cardEl.classList.contains('face-down')) {
                cardEl.draggable = true;
              //  console.log(`Carta en tableau-${t}, idx ${idx} marcada como draggable`);
            }
            cardEl.ondragstart = function (e) {
                console.log("dragstart en carta:", this.dataset.pile, this.dataset.index, this.className);
                onCardDragStart.call(this, e);
            };
            cardEl.ondragend = function (e) {
                console.log("dragend en carta:", this.dataset.pile, this.dataset.index);
                onCardDragEnd.call(this, e);
                saveState();
            };
        });

        tableauEl.ondragover = function (e) {
            console.log("dragover en tableau", t);
            onPileDragOver.call(this, e);
        };
        tableauEl.ondrop = function (e) {
            console.log("drop en tableau", t);
            onTableauDrop.call(this, e);
        };
        tableauEl.ondragenter = function (e) {
            console.log("dragenter en tableau", t);
            onPileDragEnter.call(this, e);
        };
        tableauEl.ondragleave = function (e) {
            console.log("dragleave en tableau", t);
            onPileDragLeave.call(this, e);
        };
    }

    // Foundations
    for (let f = 0; f < 4; f++) {
        const foundEl = document.getElementById(`foundation-${f}`);
        foundEl.dataset.pile = `foundation-${f}`;
        foundEl.ondragover = function (e) {
            console.log("dragover en foundation", f);
            onPileDragOver.call(this, e);
        };
        foundEl.ondrop = function (e) {
            console.log("drop en foundation", f);
            onFoundationDrop.call(this, e);
        };
        foundEl.ondragenter = function (e) {
            console.log("dragenter en foundation", f);
            onPileDragEnter.call(this, e);
        };
        foundEl.ondragleave = function (e) {
            console.log("dragleave en foundation", f);
            onPileDragLeave.call(this, e);
        };
    }

    // Waste
    const wasteEl = document.getElementById('waste');
    if (wasteEl) {
        const top = wasteEl.querySelector('.card:last-child');
        if (top) {
            top.dataset.pile = 'waste';
            top.dataset.index = (waste.length - 1).toString();
            top.draggable = true;
            console.log("Carta en waste marcada como draggable");
            top.ondragstart = function (e) {
                console.log("dragstart en waste");
                onCardDragStart.call(this, e);
            };
            top.ondragend = function (e) {
                console.log("dragend en waste");
                onCardDragEnd.call(this, e);
            };
        }
    }

    console.log("enableDragAndDrop: terminado");

    
}

function enableTouchDragAndDrop() {
    // Variables para doble tap
    let lastTapTime = 0;
    let lastTapCard = null;
    let touchDragData = null;
    let touchDragEl = null;
    let lastTouchedPile = null;
    let dragGhost = null;
    // Fix: Declare touchMoved and related touch state variables at function scope
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    document.querySelectorAll('.card').forEach(cardEl => {
        // Handle touch interactions: single tap = click/select, double tap = double-click action,
        // and touch+move = drag. Uses timing and movement thresholds to distinguish behaviors.
        cardEl.addEventListener('touchstart', function (e) {
                if (cardEl.classList.contains('face-down')) return;

                // initialize touch drag state
                touchDragEl = cardEl;
                touchDragData = {
                    pileType: cardEl.dataset.pile,
                    index: parseInt(cardEl.dataset.index, 10)
                };
                cardEl.classList.add('dragging');
                lastTouchedPile = null;
                // record tap timing and position for tap/double-tap detection
                touchStartTime = Date.now();
                touchStartX = (e.touches && e.touches[0]) ? e.touches[0].clientX : 0;
                touchStartY = (e.touches && e.touches[0]) ? e.touches[0].clientY : 0;
                touchMoved = false;

                // Create drag ghost for visual feedback (kept for drag)
                // If the touched card belongs to a tableau and there are cards below it,
                // create a stacked ghost showing the whole selection. Otherwise use a single clone.
                dragGhost = document.createElement('div');
                dragGhost.style.position = 'fixed';
                dragGhost.style.pointerEvents = 'none';
                dragGhost.style.zIndex = '9999';
                dragGhost.style.opacity = '1';
                dragGhost.style.transform = `scale(${1.02 * finalScale})`;

                const pileType = cardEl.dataset.pile;
                let created = false;
                if (pileType && pileType.startsWith('tableau')) {
                    const tIdx = parseInt(pileType.split('-')[1], 10);
                    const tableauEl = document.getElementById(`tableau-${tIdx}`);
                    if (tableauEl) {
                        const children = Array.from(tableauEl.querySelectorAll('.card'));
                        const idx = parseInt(cardEl.dataset.index, 10);
                        const numCards = Math.max(1, children.length - idx);
                        if (numCards > 1) {
                            // build stacked ghost
                            const dims = getCardDimensions();
                            const spacing = getCardStackSpacing();
                            dragGhost.style.width = `${dims.width}px`;
                            dragGhost.style.height = `${dims.height + (numCards - 1) * spacing}px`;
                            dragGhost.style.opacity = '1';
                            dragGhost.style.transform = `scale(${1.02 * finalScale})`;
                            dragGhost.style.left = '-9999px';
                            dragGhost.style.top = '-9999px';
                            for (let i = idx; i < children.length; i++) {
                                const cardClone = children[i].cloneNode(true);
                                cardClone.style.position = 'absolute';
                                cardClone.style.left = '0px';
                                cardClone.style.top = `${(i - idx) * spacing}px`;
                                cardClone.style.width = `${dims.width}px`;
                                cardClone.style.height = `${dims.height}px`;
                                cardClone.style.pointerEvents = 'none';
                                dragGhost.appendChild(cardClone);
                            }
                            document.body.appendChild(dragGhost);
                            created = true;
                        }
                    }
                }

                if (!created) {
                    // fallback single-card ghost
                    const single = cardEl.cloneNode(true);
                    const dimsSingle = getCardDimensions();
                    single.style.width = `${dimsSingle.width}px`;
                    single.style.height = `${dimsSingle.height}px`;
                    single.style.pointerEvents = 'none';
                    dragGhost.appendChild(single);
                    document.body.appendChild(dragGhost);
                }

                const touch = e.touches[0];
                dragGhost.style.left = `${touch.clientX - 40}px`;
                dragGhost.style.top = `${touch.clientY - 60}px`;

                e.preventDefault();
            }, { passive: false });

            cardEl.addEventListener('touchmove', function (e) {
                const touch = e.touches[0];
                // if movement is significant, treat as drag
                if (!touch) return;
                const dx = Math.abs(touch.clientX - touchStartX);
                const dy = Math.abs(touch.clientY - touchStartY);
                if (dx > 10 || dy > 10) touchMoved = true;

                // Move ghost
                if (dragGhost) {
                    dragGhost.style.left = `${touch.clientX - 40}px`;
                    dragGhost.style.top = `${touch.clientY - 60}px`;
                }

                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el && (el.classList.contains('tableau') || el.classList.contains('foundation'))) {
                    lastTouchedPile = el;
                    el.classList.add('pile-drag-over');
                } else {
                    lastTouchedPile = null;
                    document.querySelectorAll('.pile-drag-over').forEach(p => p.classList.remove('pile-drag-over'));
                }
                e.preventDefault();
            }, { passive: false });

            cardEl.addEventListener('touchend', function (e) {
                // remove visual ghost and drag classes
                if (dragGhost) dragGhost.remove();
                dragGhost = null;
                document.querySelectorAll('.pile-drag-over').forEach(p => p.classList.remove('pile-drag-over'));

                // If it was a drag (moved enough), attempt drop
                if (touchMoved && touchDragData) {
                    const touchPoint = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                    let dropTarget = touchPoint ? document.elementFromPoint(touchPoint.clientX, touchPoint.clientY) : null;

                    // If elementFromPoint returned a child (e.g. an inner element), try to find
                    // the closest ancestor that represents a pile and has dataset.pile.
                    if (dropTarget) {
                        try {
                            const pileEl = dropTarget.closest && (dropTarget.closest('.tableau, .foundation, .card-pile') || dropTarget.closest('[data-pile]'));
                            if (pileEl && pileEl.dataset && pileEl.dataset.pile) {
                                dropTarget = pileEl;
                            } else if (!(dropTarget.dataset && dropTarget.dataset.pile)) {
                                dropTarget = lastTouchedPile;
                            }
                        } catch (e) {
                            // closest may throw if dropTarget is not an Element; fallback to lastTouchedPile
                            dropTarget = lastTouchedPile;
                        }
                    } else {
                        dropTarget = lastTouchedPile;
                    }

                    if (dropTarget && dropTarget.dataset && dropTarget.dataset.pile) {
                        const pileType = dropTarget.dataset.pile;
                        if (pileType.startsWith('tableau')) {
                            const targetIndex = parseInt(pileType.split('-')[1], 10);
                            selectedCards = getSelectedCardsFromTouch(touchDragData);
                            selectedPile = touchDragData.pileType;
                            selectedIndex = touchDragData.index;
                            console.log('touchend: attempted drop on', pileType, 'selectedPile=', selectedPile, 'selectedIndex=', selectedIndex);
                            if (selectedCards && selectedCards.length > 0) console.log('touchend: selectedCards[0]=', selectedCards[0].value, 'faceUp=', selectedCards[0].faceUp, 'numValue=', selectedCards[0].numValue);
                            moveToTableau(targetIndex);
                            // saveState handled inside moveToTableau
                        } else if (pileType.startsWith('foundation')) {
                            const targetIndex = parseInt(pileType.split('-')[1], 10);
                            selectedCards = getSelectedCardsFromTouch(touchDragData);
                            selectedPile = touchDragData.pileType;
                            selectedIndex = touchDragData.index;
                            moveToFoundation(targetIndex);
                            // saveState handled inside moveToFoundation
                        } else {
                            playCardSound('error');
                        }
                    } else {
                        playCardSound('error');
                    }
                    cardEl.classList.remove('dragging');
                    touchDragEl = null;
                    touchDragData = null;
                    lastTouchedPile = null;
                    e.preventDefault();
                    return;
                }

                // Otherwise treat as tap: detect double-tap vs single-tap
                const now = Date.now();
                if (lastTapCard === cardEl && (now - lastTapTime) < 300) {
                    // double tap
                    const pileType = cardEl.dataset.pile;
                    const index = parseInt(cardEl.dataset.index, 10);
                    let pile = null;
                    if (pileType === 'waste') pile = waste;
                    else if (pileType && pileType.startsWith('tableau')) pile = tableaux[parseInt(pileType.split('-')[1], 10)];
                    else if (pileType && pileType.startsWith('foundation')) pile = foundations[parseInt(pileType.split('-')[1], 10)];
                    if (pile && typeof handleCardDoubleClick === 'function') handleCardDoubleClick(pile, index);
                    lastTapTime = 0;
                    lastTapCard = null;
                    e.preventDefault();
                } else {
                    // single tap: emulate click/select (or stock draw)
                    lastTapTime = now;
                    lastTapCard = cardEl;
                    // small timeout to allow double-tap detection to happen first
                    setTimeout(() => {
                        if (lastTapCard === cardEl) {
                            const pileType = cardEl.dataset.pile;
                            const index = parseInt(cardEl.dataset.index, 10);
                            if (pileType === 'stock') {
                                console.log('Stock card touched');
                                if (!drawInProgress) {
                                    drawCards();
                                }
                            } else {
                                let pile = null;
                                if (pileType === 'waste') pile = waste;
                                else if (pileType && pileType.startsWith('tableau')) pile = tableaux[parseInt(pileType.split('-')[1], 10)];
                                else if (pileType && pileType.startsWith('foundation')) pile = foundations[parseInt(pileType.split('-')[1], 10)];
                                // call handlePileClick as a click
                                if (pile) handlePileClick(pile, index, cardEl.dataset.pile);
                            }
                            lastTapCard = null;
                        }
                    }, 300);
                }
                cardEl.classList.remove('dragging');
                touchDragEl = null;
                touchDragData = null;
                lastTouchedPile = null;
                e.preventDefault();
            }, { passive: false });
    });
}

function getSelectedCardsFromTouch(data) {
    if (!data) return [];
    if (data.pileType === 'waste') {
        return [waste[waste.length - 1]];
    } else if (data.pileType && data.pileType.startsWith('tableau')) {
        const idx = parseInt(data.pileType.split('-')[1], 10);
        return tableaux[idx].slice(data.index);
    } else if (data.pileType && data.pileType.startsWith('foundation')) {
        const idx = parseInt(data.pileType.split('-')[1], 10);
        return [foundations[idx][foundations[idx].length - 1]];
    }
    return [];
}

// --- Handlers que faltaban (pegar justo después de enableDragAndDrop) ---

function onCardDragStart(e) {
    console.log("onCardDragStart ->", this.dataset.pile, this.dataset.index, this.className);
    const pileType = this.dataset.pile;
    const index = parseInt(this.dataset.index, 10);

    try {
        e.dataTransfer.setData('text/plain', JSON.stringify({ pileType, index }));
        e.dataTransfer.effectAllowed = 'move';

        // Visual: marcar cartas arrastradas
        this.classList.add('dragging');
        if (pileType && pileType.startsWith('tableau')) {
            const tIdx = parseInt(pileType.split('-')[1], 10);
            const tableauEl = document.getElementById(`tableau-${tIdx}`);
            if (tableauEl) {
                const children = Array.from(tableauEl.querySelectorAll('.card'));
                for (let i = index; i < children.length; i++) children[i].classList.add('dragging');
            }
        }
        // Crear imagen personalizada de drag para grupo de cartas más simple y confiable
        if (e.dataTransfer.setDragImage && pileType && pileType.startsWith('tableau')) {
            const tIdx = parseInt(pileType.split('-')[1], 10);
            const tableauEl = document.getElementById(`tableau-${tIdx}`);
            if (tableauEl) {
                const children = Array.from(tableauEl.querySelectorAll('.card'));
                const numCards = children.length - index;
                
                if (numCards > 1) {
                    // Crear un elemento temporal que muestre las cartas apiladas
                    const dragPreview = document.createElement('div');
                    dragPreview.style.position = 'absolute';
                    dragPreview.style.top = '-9999px';
                    dragPreview.style.left = '-9999px';
                    dragPreview.style.width = '80px';
                    dragPreview.style.height = `${110 + (numCards - 1) * 25}px`;
                    dragPreview.style.pointerEvents = 'none';
                    
                    for (let i = index; i < children.length; i++) {
                        const cardClone = children[i].cloneNode(true);
                        cardClone.style.position = 'absolute';
                        cardClone.style.top = `${(i - index) * 25}px`;
                        cardClone.style.left = '0px';
                       // cardClone.style.width = '80px';
                      //  cardClone.style.height = '110px';
                        cardClone.style.opacity = '1';
                        dragPreview.appendChild(cardClone);
                    }
                    
                    document.body.appendChild(dragPreview);
                    e.dataTransfer.setDragImage(dragPreview, 40, 55);
                    
                    // Limpiar el elemento temporal después de un momento
                    setTimeout(() => {
                        if (dragPreview.parentNode) {
                            dragPreview.parentNode.removeChild(dragPreview);
                        }
                    }, 100);
                }
            }
        }
    } catch (err) {
        console.error('onCardDragStart error', err);
    }
}

function onCardDragEnd(e) {
    console.log("onCardDragEnd");
    document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));
    document.querySelectorAll('.pile-drag-over').forEach(p => p.classList.remove('pile-drag-over'));

    console.log('Actualizando display, recalculando spacing...');
                
applySpacingToFirstFaceUpCards();
}

function onPileDragOver(e) {
    e.preventDefault(); // necesario para permitir drop
    e.dataTransfer.dropEffect = 'move';
    //console.log("onPileDragOver", this.id);
}

function onPileDragEnter(e) {
    e.preventDefault();
    //console.log("onPileDragEnter", this.id);
    this.classList.add('pile-drag-over');
}

function onPileDragLeave(e) {
    //console.log("onPileDragLeave", this.id);
    this.classList.remove('pile-drag-over');
}

function onTableauDrop(e) {
    console.log("onTableauDrop ->", this.id);
    e.preventDefault();
    this.classList.remove('pile-drag-over');

    const data = e.dataTransfer.getData('text/plain');
    if (!data) { console.log("onTableauDrop: no payload"); return; }

    let parsed;
    try { parsed = JSON.parse(data); } catch (err) { console.error("onTableauDrop: invalid payload", err); return; }

    const sourcePile = parsed.pileType;
    const sourceIndex = parsed.index;

    if (!sourcePile) { playCardSound('error'); return; }

    // Construir selectedCards desde el estado lógico
    if (sourcePile === 'waste') {
        if (waste.length === 0) { playCardSound('error'); return; }
        selectedCards = [waste[waste.length - 1]];
        selectedPile = 'waste';
        selectedIndex = waste.length - 1;
    } else if (sourcePile.startsWith('tableau')) {
        const s = parseInt(sourcePile.split('-')[1], 10);
        if (isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= tableaux[s].length) { playCardSound('error'); return; }
        const candidate = tableaux[s].slice(sourceIndex);
        if (candidate.some(c => !c.faceUp)) { playCardSound('error'); return; }
        for (let i = 0; i < candidate.length - 1; i++) {
            const cur = candidate[i], nxt = candidate[i+1];
            if (cur.color === nxt.color || cur.numValue !== nxt.numValue + 1) { playCardSound('error'); return; }
        }
        selectedCards = candidate;
        selectedPile = `tableau-${s}`;
        selectedIndex = sourceIndex;
    } else if (sourcePile.startsWith('foundation')) {
        const s = parseInt(sourcePile.split('-')[1], 10);
        const len = foundations[s].length;
        if (len === 0) { playCardSound('error'); return; }
        selectedCards = [foundations[s][len - 1]];
        selectedPile = `foundation-${s}`;
        selectedIndex = len - 1;
    } else {
        playCardSound('error'); return;
    }

    const targetIndex = parseInt(this.id.split('-')[1], 10);
    const firstCard = selectedCards[0];

    if (canMoveToTableau(firstCard, tableaux[targetIndex])) {
        removeSelectedCardsFromSource();
        tableaux[targetIndex].push(...selectedCards);
        moves++;
        playCardSound('move');
        checkForFaceUp();
        clearSelection();
        saveState();
        updateDisplay();
    } else {
        playCardSound('error');
        this.classList.add('invalid-drop');
        setTimeout(() => this.classList.remove('invalid-drop'), 250);
        clearSelection();
        updateDisplay();
    }
}

function onFoundationDrop(e) {
    console.log("onFoundationDrop ->", this.id);
    e.preventDefault();
    this.classList.remove('pile-drag-over');

    const data = e.dataTransfer.getData('text/plain');
    if (!data) { console.log("onFoundationDrop: no payload"); return; }

    let parsed;
    try { parsed = JSON.parse(data); } catch (err) { console.error("onFoundationDrop: invalid payload", err); return; }

    const sourcePile = parsed.pileType;
    const sourceIndex = parsed.index;

    if (sourcePile === 'waste') {
        if (waste.length === 0) { playCardSound('error'); return; }
        selectedCards = [waste[waste.length - 1]];
        selectedPile = 'waste';
        selectedIndex = waste.length - 1;
    } else if (sourcePile.startsWith('tableau')) {
        const s = parseInt(sourcePile.split('-')[1], 10);
        // solo permitir mover la carta superior del tableau a foundation
        if (isNaN(sourceIndex) || sourceIndex !== tableaux[s].length - 1) { playCardSound('error'); return; }
        const c = tableaux[s][sourceIndex];
        if (!c.faceUp) { playCardSound('error'); return; }
        selectedCards = [c];
        selectedPile = `tableau-${s}`;
        selectedIndex = sourceIndex;
    } else if (sourcePile.startsWith('foundation')) {
        const s = parseInt(sourcePile.split('-')[1], 10);
        const len = foundations[s].length;
        if (len === 0) { playCardSound('error'); return; }
        selectedCards = [foundations[s][len - 1]];
        selectedPile = `foundation-${s}`;
        selectedIndex = len - 1;
    } else {
        playCardSound('error'); return;
    }

    const targetIndex = parseInt(this.id.split('-')[1], 10);
    const card = selectedCards[0];

    if (canMoveToFoundation(card, foundations[targetIndex])) {
        removeSelectedCardsFromSource();
        foundations[targetIndex].push(card);
        moves++;
        score += 10;
        playCardSound('foundation');
        checkForFaceUp();
        clearSelection();
        saveState();
        updateDisplay();
    } else {
        playCardSound('error');
        this.classList.add('invalid-drop');
        setTimeout(() => this.classList.remove('invalid-drop'), 250);
        clearSelection();
        updateDisplay();
    }
}


let finalScale = 1;


function toggleModal(modalId, open = true) {
  const overlay = document.getElementById("overlay");
  const modal = document.getElementById(modalId);

  if (open) {
    overlay.style.display = "flex";
    modal.style.display = "block";
  } else {
    overlay.style.display = "none";
    modal.style.display = "none";
  }
  closeMenu()
}

// Unified global click handler:
// - If click is directly on the overlay background, close all modals
// - If click is outside the .dropdown, close the dropdown
// - If click is inside the dropdown on a button/link, close the dropdown too
function toggleMenu() {
    document.getElementById("dropdownMenu").classList.toggle("show");
}

window.onclick = function(e) {
    const overlay = document.getElementById("overlay");
    const menu = document.getElementById("dropdownMenu");

    // Click on overlay background -> close all modals
    if (overlay && e.target === overlay) {
        Array.from(overlay.children).forEach(child => child.style.display = "none");
        overlay.style.display = "none";
        console.log("Clic fuera del modal, cerrando.");
        return;
    }

    // Click anywhere: if it's outside the dropdown, close the menu
    try {
        if (!e.target.closest || !e.target.closest('.dropdown')) {
            if (menu) menu.classList.remove('show');
            return;
        }

        // If click is inside the dropdown on a button or link, close the menu
        if (menu && e.target.closest && e.target.closest('#dropdownMenu') && e.target.closest('button, a')) {
            menu.classList.remove('show');
        }
    } catch (err) {
        // defensive: if anything goes wrong just ensure menu is closed
        if (menu) menu.classList.remove('show');
    }
}
function closeMenu() {
  document.getElementById("dropdownMenu").classList.remove("show");
  console.log("closeMenu: menú cerrado" );
}



            console.log('$$$$$$$$$$$$$$$$$$cacawada');

            
//  Función para encontrar la primera carta boca arriba en cada tableau
    function findFirstFaceUpCards() {
       // console.log('tableaux:', tableaux);
        return tableaux.map(pile => {
            const card = pile.find(card => card.faceUp); // Encuentra la primera carta que está boca arriba
          //  console.log('Primera carta boca arriba encontrada:', card);
            return card ? card.id : null; // Retorna el ID de la carta o null si no hay ninguna
        });
    }

const firstFaceUpCards = findFirstFaceUpCards();

function applySpacingToFirstFaceUpCards() {
    console.log('Aplicando espaciado a las primeras cartas boca arriba...');
    
    // Asegurar que spacingDown y spacingUp estén calculados
    if (spacingDown === null || spacingUp === null) {
        console.log('Calculando valores de spacing...');
        getCardStackSpacing(); // Esto calculará spacingDown y spacingUp
    }
    
    const firstFaceUpCards = findFirstFaceUpCards();
    console.log('First face-up cards:', firstFaceUpCards);
    console.log('spacingDown:', spacingDown, 'spacingUp:', spacingUp);

    // Aplicar espaciado personalizado a cada tableau
    for (let i = 0; i < 7; i++) {
        const tableauEl = document.getElementById(`tableau-${i}`);
        if (!tableauEl) continue;
        
        const pile = tableaux[i];
        const firstFaceUpIndex = pile.findIndex(card => card.faceUp);
        
        if (firstFaceUpIndex !== -1) {
          //   //  console.log(`Tableau ${i}: Primera carta boca arriba en índice ${firstFaceUpIndex}`);
            
            // Aplicar espaciado a todas las cartas del tableau
            const cards = tableauEl.querySelectorAll('.card');
            cards.forEach((cardEl, index) => {
                if (index < firstFaceUpIndex) {
                    // Cartas boca abajo - usar spacingDown
                    cardEl.style.top = `${index * spacingDown}px`;
                } else if (index === firstFaceUpIndex) {
                    // Primera carta boca arriba - usar spacingDown para transición suave
                    cardEl.style.top = `${index * spacingDown}px`;
                } else {
                    // Cartas boca arriba siguientes - usar spacingUp
                    // Calcular la posición top en base a la primera carta boca arriba.
                    // Queremos que las cartas boca arriba se apilen con spacingUp
                    // pero tomando como punto de partida la posición donde terminan
                    // las cartas boca abajo: (firstFaceUpIndex * spacingDown).
                    // Entonces:
                    // finalTop = (firstFaceUpIndex * spacingDown) + ((index - firstFaceUpIndex) * spacingUp)
                    const relativeIndex = index - firstFaceUpIndex;
                    const finalTop = (firstFaceUpIndex * spacingDown) + (relativeIndex * spacingUp);
                    // Debug opcional (desactivar o eliminar si no se necesita):
                    // console.log(`tableau ${i} card ${index}: relativeIndex=${relativeIndex}, finalTop=${finalTop}`);
                    cardEl.style.top = `${finalTop}px`;
                }
            });
        } else {
            // Si no hay cartas boca arriba, aplicar spacing normal
            console.log(`Tableau ${i}: Solo cartas boca abajo`);
            const cards = tableauEl.querySelectorAll('.card');
            cards.forEach((cardEl, index) => {
                cardEl.style.top = `${index * spacingDown}px`;
            });
        }
    }
}

// Call this function where necessary, e.g., after initializing or updating the tableau.
// applySpacingToFirstFaceUpCards();

// --- Tutorial Mode ---
let tutorialMode = false;
let tutorialSteps = [];
let tutorialStepIndex = 0;
let tutorialHand = null;
let tutorialInstruction = null;

// Helper: ensure a stable content container inside #tutorialInstruction so
// we can keep persistent controls (like the Close button) while swapping
// the inner content during steps.
function getTutorialContent() {
    if (!tutorialInstruction) tutorialInstruction = document.getElementById('tutorialInstruction');
    if (!tutorialInstruction) return null;
    let content = tutorialInstruction.querySelector('#tutorialContent');
    if (!content) {
        content = document.createElement('div');
        content.id = 'tutorialContent';
        // ensure content sits under any absolute-positioned controls like the Close button
        content.style.position = 'relative';
        tutorialInstruction.appendChild(content);
    }
    return content;
}

let controls = document.getElementsByClassName('controls');


function startTutorial() {
    tutorialMode = true;
        for (let i = 0; i < controls.length; i++) {
            controls[i].style.pointerEvents = 'none';
            controls[i].style.opacity = '0.5';
            }
    tutorialHand = document.getElementById('tutorialHand');
    tutorialInstruction = document.getElementById('tutorialInstruction');
    if (tutorialHand) tutorialHand.style.display = 'block';
    if (tutorialInstruction) {
        tutorialInstruction.style.display = 'block';

        // Ensure the stable content container exists before adding controls
        getTutorialContent();

        // Add a persistent Close (X) button to allow users to dismiss the tutorial at any time
        if (!document.getElementById('tutorialCloseBtn')) {
            const closeBtn = document.createElement('button');
            closeBtn.id = 'tutorialCloseBtn';
            closeBtn.setAttribute('aria-label', 'Close tutorial');
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = function() {
                                endTutorial();
                                newGame();
                                };
            tutorialInstruction.appendChild(closeBtn);
        }
    }
    setupTutorialCards();
    setupTutorialSteps();
    tutorialStepIndex = 0;
    runTutorialStep();
}

function setupTutorialCards() {
    // Full custom layout for tutorial mode
    // Tableau: 7 columns, each with a few cards (faceUp/faceDown as needed)
    tableaux = [
        [
            
            {id:'2ofspades', suit:'♠', value:'2', color:'black', faceUp:false},
            {id:'aofspades', suit:'♠', value:'A', color:'black', faceUp:true}
        ],
        [
            {id:'3ofhearts', suit:'♥', value:'3', color:'red', faceUp:false},
            {id:'4ofhearts', suit:'♥', value:'4', color:'red', faceUp:true}
        ],
        [
            {id:'5ofclubs', suit:'♣', value:'5', color:'black', faceUp:true}
        ],
        [
            {id:'6ofdiamonds', suit:'♦', value:'6', color:'red', faceUp:true}
        ],
        [
            {id:'7ofspades', suit:'♠', value:'7', color:'black', faceUp:true}
        ],
        [
            {id:'8ofhearts', suit:'♥', value:'8', color:'red', faceUp:true}
        ],
        [
            {id:'9ofclubs', suit:'♣', value:'9', color:'black', faceUp:true}
        ]
    ];

    // Foundations: Only the first pile has a card for demo
    foundations = [
        [ ], // Will receive Ace of Spades in step 1
        [],
        [],
        []
    ];

    // Stock: a few cards left to draw
    stock = [
        {id:'10ofhearts', suit:'♥', value:'10', color:'red', faceUp:false},
        {id:'jofspades', suit:'♠', value:'J', color:'black', faceUp:false},
        {id:'qofdiamonds', suit:'♦', value:'Q', color:'red', faceUp:false},
        {id:'kofclubs', suit:'♣', value:'K', color:'black', faceUp:false}
    ];

    // Waste: empty for start
    waste = [];

    updateDisplay();
}

function setupTutorialSteps() {
    // Steps will use dynamic DOM positions
    tutorialSteps = [
        { text: "<img src='img/tutorial_03.png'class=tutorial-img> This is the <strong>Ace of Spades</strong>. Let's move it to the <strong>foundation</strong>!", action: highlightCard },
        { text: "<img src='img/tutorial_01.png'class=tutorial-img> Drag the card here to the <strong>foundation</strong> pile.", action: moveCardToFoundation },
        { text: "<img src='img/tutorial_03.png'class=tutorial-img> Now, click the <strong>stock</strong> pile to <strong>draw a card</strong>.", action: drawCardOnNext },
        { text: "<img src='img/tutorial_02.png'class=tutorial-img> You can move the <strong>5 of Clubs</strong> under the <strong>6 of Diamonds</strong> on the <strong>tableau</strong>.", action: showMove5ofClubs },
        { text: "<img src='img/tutorial_01.png'class=tutorial-img> Now move the <strong>King of Clubs</strong> from the waste pile to the empty <strong>tableau</strong> column.", action: showMoveKingToEmpty },
        { text: "<img src='img/tutorial_02.png'class=tutorial-img> You can move the <strong>4 of Hearts</strong> below the <strong>5 of Clubs</strong>. <br /><strong>Cards must alternate color and go in descending order.</strong>", action: showMove4ofHearts },
        { text: "<img src='img/tutorial_03.png'class=tutorial-img> Now move the <strong>2 of Spades</strong> to the <strong>foundation</strong>.<br /><strong>Foundations are filled in ascending order by suit, starting with Ace.</strong>", action: showMove2ofSpadesToFoundation },
    { text: "<img src='img/tutorial_01.png'class=tutorial-img> Keep moving cards between the <strong>tableau</strong> and the <strong>foundation</strong>, following the rules.<br /><strong>You win when all cards are sorted into the foundation piles in order from Ace to King for each suit!</strong>", action: waitForNextButton },
        { text: "<img src='img/tutorial_02.png'class=tutorial-img> Remember to click on the <strong>Stock</strong> pile to continue drawing cards when you need more options!", action: showStockReminder },
        { text: "<img src='img/tutorial_04.png'class=tutorial-img> Great! You completed the tutorial!", action: finishTutorial }
    ];
// Final tutorial step: reminder to use Stock pile
function showStockReminder() {
    // Optionally animate hand to stock pile
    const stockEl = document.getElementById('stock');
    if (stockEl) {
        moveHandToElement(stockEl, () => {
            // After hand animation, show Next button
            const content = getTutorialContent();
            if (content) {
                content.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                setTimeout(() => {
                    const btn = document.getElementById('tutorialNextBtn');
                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                }, 50);
            }
        });
    } else {
        // If no stock element, just show Next button immediately
        const content = getTutorialContent();
        if (content) {
            content.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
            setTimeout(() => {
                const btn = document.getElementById('tutorialNextBtn');
                if (btn) btn.onclick = function() { nextTutorialStep(); };
            }, 50);
        }
    }
}

// Custom function for tutorial: draw a card when user clicks Next
function drawCardOnNext() {
    // This function is just a marker for the tutorial step; actual draw logic is in nextTutorialStep
}
window.drawCardOnNext = drawCardOnNext;
// Final tutorial step: explanation about winning
function showFinalExplanation() {
    // This function is now replaced by waitForNextButton for the 'Next >' button step.
}

function waitForNextButton() {
    // Do nothing: runTutorialStep will add the 'Next >' button and wait for user click.
}

function runTutorialStep() {
    if (tutorialStepIndex >= tutorialSteps.length) { endTutorial(); return; }
    const step = tutorialSteps[tutorialStepIndex];
    // Show instruction text and add Next button for most steps
    const content = getTutorialContent();
    if (content) {
        content.innerHTML = step.text;
    // For steps that require a Next button (all except those that auto-advance)
    // Steps that auto-advance: 1 (moveCardToFoundation), 4 (showMoveKingToEmpty), 5 (showMove4ofHearts), 6 (showMove2ofSpadesToFoundation)
    // Steps that should wait for Next: 0 (highlightCard), 2 (stock pile), 7 (waitForNextButton), 8 (showStockReminder), 9 (showFinalExplanation)
    // We'll add Next for steps 0, 2, 7, 8, 9 (step 3 handled in showMove5ofClubs)
    if ([0,2,7,8,9].includes(tutorialStepIndex)) {
        const content2 = getTutorialContent();
        if (content2) {
            content2.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
            setTimeout(() => {
                const btn = document.getElementById('tutorialNextBtn');
                if (btn) btn.onclick = function() { nextTutorialStep(); };
            }, 50);
        }
    }
    }
    // Animate hand as before
    if (tutorialStepIndex === 0) {
        const cardEl = document.querySelector('.card[data-id="aofspades"]');
        moveHandToElement(cardEl, () => {
            if (typeof step.action === 'function') step.action();
        });
    } else if (tutorialStepIndex === 1) {
        const cardEl = document.querySelector('.card[data-id="aofspades"]');
        const foundationEl = document.querySelector('.foundation-pile');
        moveHandToElement(cardEl, () => {
            setTimeout(() => {
                moveHandToElement(foundationEl, () => {
                    if (typeof step.action === 'function') step.action();
                });
            }, 700);
        });
    } else if (tutorialStepIndex === 2) {
        const stockEl = document.getElementById('stock');
        moveHandToElement(stockEl, () => {
            if (typeof step.action === 'function') step.action();
        });
    } else if (tutorialStepIndex === 3) {
        // For step 3, move hand to 5 of Clubs, but do not auto-advance
        let fromIdx = -1;
        for (let i = 0; i < tableaux.length; i++) {
            if (tableaux[i].some(c => c.id === '5ofclubs')) fromIdx = i;
        }
        const tableau5El = fromIdx !== -1 ? document.getElementById(`tableau-${fromIdx}`) : null;
        moveHandToElement(tableau5El, () => {
            if (typeof step.action === 'function') step.action();
        });
    } else if (tutorialStepIndex === 4) {
        // For step 4, move hand to waste (King of Clubs) before running the King step
        const wasteEl = document.getElementById('waste');
        moveHandToElement(wasteEl, () => {
            if (typeof step.action === 'function') step.action();
        });
    } else if (tutorialStepIndex === 5) {
        // For step 5, move hand to 4 of Hearts (tableau) before running the 4 of Hearts step
        let fourIdx = -1;
        for (let i = 0; i < tableaux.length; i++) {
            if (tableaux[i].some(c => c.id === '4ofhearts')) fourIdx = i;
        }
        const tableau4El = fourIdx !== -1 ? document.getElementById(`tableau-${fourIdx}`) : null;
        moveHandToElement(tableau4El, () => {
            if (typeof step.action === 'function') step.action();
        });
    } else if (tutorialStepIndex === 6) {
        // For step 6, move hand to 2 of Spades (tableau) before running the 2 of Spades to foundation step
        let twoIdx = -1;
        for (let i = 0; i < tableaux.length; i++) {
            if (tableaux[i].some(c => c.id === '2ofspades')) twoIdx = i;
        }
        const tableau2El = twoIdx !== -1 ? document.getElementById(`tableau-${twoIdx}`) : null;
        moveHandToElement(tableau2El, () => {
            if (typeof step.action === 'function') step.action();
        });
    } else {
        const foundationEl = document.querySelector('.foundation-pile');
        moveHandToElement(foundationEl, () => {
            if (typeof step.action === 'function') step.action();
        });
    }
}
window.runTutorialStep = runTutorialStep;

function highlightCard() {
    // Optionally highlight the card in the UI
    // Wait for user to click Next (handled by runTutorialStep)
}

function showFinalExplanation() {
    // Wait for user to click Next (handled by runTutorialStep)
}

function showStockReminder() {
    // Optionally animate hand to stock pile
    const stockEl = document.getElementById('stock');
    if (stockEl) {
        moveHandToElement(stockEl, () => {
            // Wait for user to click Next (handled by runTutorialStep)
        });
    }
}
}

function nextTutorialStep() {
    // Special case: if current step is the stock pile draw step, draw a card before advancing
    if (tutorialSteps[tutorialStepIndex] && tutorialSteps[tutorialStepIndex].action === drawCardOnNext) {
        // Simulate drawing a card from the stock pile in tutorial mode
        if (stock.length > 0) {
            let card = stock.pop();
            card.faceUp = true;
            waste.push(card);
            updateDisplay();
        }
    }
    tutorialStepIndex++;
    // Only run next step if tutorial is still active
    if (tutorialMode) runTutorialStep();
}

function endTutorial() {
    tutorialMode = false;
    if (tutorialHand) tutorialHand.style.display = 'none';
    if (tutorialInstruction) {
        tutorialInstruction.style.display = 'none';
        // Remove the Close button if present
        const closeBtn = document.getElementById('tutorialCloseBtn');
        if (closeBtn) closeBtn.remove();
    }

    for (let i = 0; i < controls.length; i++) {
  controls[i].style.pointerEvents = 'auto';
  controls[i].style.opacity = '1';
}

    // Optionally reset the game or enable user input
}

// Expose startTutorial globally
window.startTutorial = startTutorial;

function moveCardToFoundation() {
    // Simulate moving the Ace of Spades from tableau[0] to foundations[0]
    if (tableaux[0].length > 0) {
        const card = tableaux[0].pop();
        card.faceUp = true;
        foundations[0].push(card);
        // Flip the next card in tableau[0] face up if it exists
        if (tableaux[0].length > 0) {
            tableaux[0][tableaux[0].length - 1].faceUp = true;
        }
        updateDisplay();
    }
    setTimeout(() => { nextTutorialStep(); }, 1200);
}

function showStockClick() {
    // Simulate drawing a card from the stock pile in tutorial mode
    setTimeout(() => {
        if (stock.length > 0) {
            let card = stock.pop();
            card.faceUp = true;
            waste.push(card);
            updateDisplay();
        }
        nextTutorialStep();
    }, 700); // Wait for hand animation, then draw
}

function showMove5ofClubs() {
    // Find tableau indices for 5 of Clubs and 6 of Diamonds
    let fromIdx = -1, toIdx = -1;
    for (let i = 0; i < tableaux.length; i++) {
        if (tableaux[i].some(c => c.id === '5ofclubs')) fromIdx = i;
        if (tableaux[i].some(c => c.id === '6ofdiamonds')) toIdx = i;
    }
    const tableau5El = document.getElementById(`tableau-${fromIdx}`);
    const tableau6El = document.getElementById(`tableau-${toIdx}`);
    if (tableau5El && tableau6El && fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        moveHandToElement(tableau5El, () => {
            setTimeout(() => {
                moveHandToElement(tableau6El, () => {
                    setTimeout(() => {
                        // Actually move the 5 of Clubs under the 6 of Diamonds
                        let fromPile = tableaux[fromIdx];
                        let cardIdx = fromPile.findIndex(c => c.id === '5ofclubs');
                        if (cardIdx !== -1) {
                            let [card] = fromPile.splice(cardIdx, 1);
                            card.faceUp = true;
                            let toPile = tableaux[toIdx];
                            let sixIdx = toPile.findIndex(c => c.id === '6ofdiamonds');
                            if (sixIdx !== -1) {
                                toPile.splice(sixIdx + 1, 0, card);
                            } else {
                                toPile.push(card);
                            }
                            updateDisplay();
                        }
                        // Now show the Next button for this step
                        const content3 = getTutorialContent();
                        if (content3) {
                            content3.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                            setTimeout(() => {
                                const btn = document.getElementById('tutorialNextBtn');
                                if (btn) btn.onclick = function() { nextTutorialStep(); };
                            }, 50);
                        }
                    }, 900);
                });
            }, 900);
        });
    } else {
        // If the animation can't be performed, just leave the hand in place and wait for Next
        const contentFallback = getTutorialContent();
        if (contentFallback) {
            contentFallback.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
            setTimeout(() => {
                const btn = document.getElementById('tutorialNextBtn');
                if (btn) btn.onclick = function() { nextTutorialStep(); };
            }, 50);
        }
    }
}

function showMoveKingToEmpty() {
    // Find the King of Clubs in waste and the first empty tableau
    const kingIdx = waste.findIndex(c => c.id === 'kofclubs');
    let emptyIdx = -1;
    for (let i = 0; i < tableaux.length; i++) {
        if (tableaux[i].length === 0) { emptyIdx = i; break; }
    }
    const wasteEl = document.getElementById('waste');
    const tableauEl = emptyIdx !== -1 ? document.getElementById(`tableau-${emptyIdx}`) : null;
    if (kingIdx !== -1 && wasteEl && tableauEl) {
        moveHandToElement(wasteEl, () => {
            setTimeout(() => {
                moveHandToElement(tableauEl, () => {
                    setTimeout(() => {
                        // Move the King from waste to the empty tableau
                        let king = waste.splice(kingIdx, 1)[0];
                        king.faceUp = true;
                        tableaux[emptyIdx].push(king);
                        updateDisplay();
                        // Now show the Next button for this step
                        if (tutorialInstruction) {
                            const content4 = getTutorialContent();
                            if (content4) {
                                content4.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                                setTimeout(() => {
                                    const btn = document.getElementById('tutorialNextBtn');
                                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                                }, 50);
                            }
                        }
                    }, 900);
                });
            }, 900);
        });
    } else {
        // If the animation can't be performed, just leave the hand in place and wait for Next
        if (tutorialInstruction) {
            const content5 = getTutorialContent();
            if (content5) {
                content5.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                setTimeout(() => {
                    const btn = document.getElementById('tutorialNextBtn');
                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                }, 50);
            }
        }
    }
}

function showMove4ofHearts() {
    // Find tableau with 5 of Clubs and 4 of Hearts
    let fiveIdx = -1, fourIdx = -1;
    for (let i = 0; i < tableaux.length; i++) {
        if (tableaux[i].some(c => c.id === '5ofclubs')) fiveIdx = i;
        if (tableaux[i].some(c => c.id === '4ofhearts')) fourIdx = i;
    }
    const tableau5El = fiveIdx !== -1 ? document.getElementById(`tableau-${fiveIdx}`) : null;
    const tableau4El = fourIdx !== -1 ? document.getElementById(`tableau-${fourIdx}`) : null;
    if (tableau4El && tableau5El && fiveIdx !== -1 && fourIdx !== -1 && fiveIdx !== fourIdx) {
        moveHandToElement(tableau4El, () => {
            setTimeout(() => {
                moveHandToElement(tableau5El, () => {
                    setTimeout(() => {
                        // Move 4 of Hearts below 5 of Clubs
                        let fromPile = tableaux[fourIdx];
                        let cardIdx = fromPile.findIndex(c => c.id === '4ofhearts');
                        if (cardIdx !== -1) {
                            let [card] = fromPile.splice(cardIdx, 1);
                            card.faceUp = true;
                            let toPile = tableaux[fiveIdx];
                            let fiveIdxInTo = toPile.findIndex(c => c.id === '5ofclubs');
                            if (fiveIdxInTo !== -1) {
                                toPile.splice(fiveIdxInTo + 1, 0, card);
                            } else {
                                toPile.push(card);
                            }
                            updateDisplay();
                        }
                        // Now show the Next button for this step
                        if (tutorialInstruction) {
                            const content6 = getTutorialContent();
                            if (content6) {
                                content6.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                                setTimeout(() => {
                                    const btn = document.getElementById('tutorialNextBtn');
                                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                                }, 50);
                            }
                        }
                    }, 900);
                });
            }, 900);
        });
    } else {
        // If the animation can't be performed, just leave the hand in place and wait for Next
        if (tutorialInstruction) {
            const content7 = getTutorialContent();
            if (content7) {
                content7.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                setTimeout(() => {
                    const btn = document.getElementById('tutorialNextBtn');
                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                }, 50);
            }
        }
    }
}

function showMove2ofSpadesToFoundation() {
    // Find tableau with 2 of Spades and the first foundation pile
    let tableauIdx = -1;
    for (let i = 0; i < tableaux.length; i++) {
        if (tableaux[i].some(c => c.id === '2ofspades')) tableauIdx = i;
    }
    const tableauEl = tableauIdx !== -1 ? document.getElementById(`tableau-${tableauIdx}`) : null;
    const foundationEl = document.querySelector('.foundation-pile');
    if (tableauEl && foundationEl && tableauIdx !== -1) {
        moveHandToElement(tableauEl, () => {
            setTimeout(() => {
                moveHandToElement(foundationEl, () => {
                    setTimeout(() => {
                        // Move 2 of Spades to foundation
                        let fromPile = tableaux[tableauIdx];
                        let cardIdx = fromPile.findIndex(c => c.id === '2ofspades');
                        if (cardIdx !== -1) {
                            let [card] = fromPile.splice(cardIdx, 1);
                            card.faceUp = true;
                            foundations[0].push(card);
                            updateDisplay();
                        }
                        // Now show the Next button for this step
                        if (tutorialInstruction) {
                            const content8 = getTutorialContent();
                            if (content8) {
                                content8.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                                setTimeout(() => {
                                    const btn = document.getElementById('tutorialNextBtn');
                                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                                }, 50);
                            }
                        }
                    }, 900);
                });
            }, 900);
        });
    } else {
        // If the animation can't be performed, just leave the hand in place and wait for Next
        if (tutorialInstruction) {
            const content9 = getTutorialContent();
            if (content9) {
                content9.innerHTML += '<br><button id="tutorialNextBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">Next &gt;</button>';
                setTimeout(() => {
                    const btn = document.getElementById('tutorialNextBtn');
                    if (btn) btn.onclick = function() { nextTutorialStep(); };
                }, 50);
            }
        }
    }
}

function finishTutorial() {
    if (tutorialInstruction) {
    const contentFinal = getTutorialContent();
    if (contentFinal) contentFinal.innerHTML = '<img src="img/tutorial_04.png" class="tutorial-img"> Great! You completed the tutorial!<br><button id="tutorialNewGameBtn" style="margin-top:16px;padding:8px 18px;font-size:1em;cursor:pointer;">New Game</button>';
        const btn = document.getElementById('tutorialNewGameBtn');
        if (btn) btn.onclick = function() {
            endTutorial();
            newGame();
        };
    }
    // Optionally hide the hand
    if (tutorialHand) tutorialHand.style.display = 'none';
}

function moveHandToElement(el, callback) {
    if (!tutorialHand || !el) { if (callback) callback(); return; }
    // Get bounding rect relative to .game-container
    const container = document.querySelector('.game-container');
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // Center the hand on the element
    const x = rect.left - containerRect.left + rect.width / 2 - tutorialHand.offsetWidth / 2;
    const y = rect.top - containerRect.top + rect.height / 2 - tutorialHand.offsetHeight / 2;
    moveHandTo(x, y, callback);
}

function moveHandTo(x, y, callback) {
    if (!tutorialHand) return;
    tutorialHand.style.transition = 'left 0.7s cubic-bezier(.4,2,.6,1), top 0.7s cubic-bezier(.4,2,.6,1)';
    tutorialHand.style.left = x + 'px';
    tutorialHand.style.top = y + 'px';
    setTimeout(() => { if (callback) callback(); }, 750);
}

// Persist which unique day prizes have been awarded (e.g. day1, day2)
function getUniquePrizes() {
    try { return JSON.parse(_safeGet('dailyUniquePrizes', '{}')) || {}; } catch (e) { return {}; }
}

function setUniquePrizes(obj) {
    try { _safeSet('dailyUniquePrizes', JSON.stringify(obj || {})); } catch (e) {}
}

// Map front skin keys to deck folders
const FRONT_SKIN_MAP = {
    'front_default': 'deck01',
    'front_autumn': 'deck02'
};

function getFrontDeckDir() {
    return FRONT_SKIN_MAP[frontSkin] || 'deck01';
}

function selectFrontSkin(skin) {
    if (!skin || typeof skin !== 'string') return;
    const allowed = Object.keys(FRONT_SKIN_MAP);
    if (!allowed.includes(skin)) {
        console.warn('selectFrontSkin: unknown skin, falling back to default:', skin);
        skin = 'front_default';
    }
    frontSkin = skin;
    try { localStorage.setItem('cardFrontSkin', frontSkin); } catch (e) {}

    // Update thumbnail UI for front skins
    try {
        document.querySelectorAll('#selectFrontSkin .skin-image').forEach(imgEl => {
            if (imgEl.getAttribute('onclick') && imgEl.getAttribute('onclick').includes(skin)) imgEl.classList.add('selected');
            else imgEl.classList.remove('selected');
        });
    } catch (e) {}

    // Recreate/update display so cards use the new deck images
    try { updateDisplay(); } catch (e) {}

    // Preload new front deck images in background
    try {
        const suits = ['hearts','diamonds','clubs','spades'];
        const values = ['a','2','3','4','5','6','7','8','9','10','j','q','k'];
        const dir = getFrontDeckDir();
        suits.forEach(suit => {
            values.forEach(value => {
                const img = new Image();
                img.src = `img/cards/${dir}/${value}of${suit}.jpg`;
            });
        });
    } catch (e) {}
}