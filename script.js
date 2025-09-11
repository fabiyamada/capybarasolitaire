
window.onload = async () => {
    initAudio();
    totalWins = parseInt(localStorage.getItem('solitaireWins')) || 0;
    updateHiddenImage();
    initGame();


    // Start the game loop/timer
    console.log("5. Starting game interval...");
    setInterval(() => { if (!gameWon) { updateTimeDisplay(); } }, 1000);

    function updateTimeDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('time').textContent = `Time: ${minutes}:${seconds}`;
}

    // 6. Enable all "New Game" buttons
    console.log("6. Enabling 'New Game' buttons.");
    const newGameButtons = document.querySelectorAll('#newGameButton');
    newGameButtons.forEach(button => {
        button.disabled = false;
    });
};

        // Variables del juego
        let deck = [], stock = [], waste = [], foundations = [[], [], [], []], tableaux = [[], [], [], [], [], [], []];
        let selectedCards = [], selectedPile = null, selectedIndex = null;
        let score = 0, moves = 0, startTime = Date.now(), gameWon = false;
        let audioContext = null, soundEnabled = true;
        let totalWins = 0, winCountedThisGame = false;

        let gameHistory = [];
        const MAX_HISTORY_SIZE = 50;

        let undoCount = 20;

        function saveState() {
    // Check if the game state has actually changed
    if (gameHistory.length > 0) {
        const lastState = gameHistory[gameHistory.length - 1];
        if (JSON.stringify(lastState.tableaux) === JSON.stringify(tableaux) &&
            lastState.stock.length === stock.length) {
            return; // Don't save if nothing changed
        }
    }

    const state = {
        stock: [...stock],
        waste: [...waste],
        foundations: foundations.map(f => [...f]),
        tableaux: tableaux.map(t => [...t]),
        score: score,
        moves: moves,
        // Don't save startTime as it would break the timer
    };
    gameHistory.push(state);
    // Add this line to log the current history size
    console.log(`State saved. History size: ${gameHistory.length}`); 

    // Keep the history size manageable
    if (gameHistory.length > MAX_HISTORY_SIZE) {
        gameHistory.shift();
    }
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
        function toggleSound() { soundEnabled = !soundEnabled; const button = document.getElementById('soundToggle'); button.textContent = soundEnabled ? '🔊' : '🔇'; if (soundEnabled && !audioContext) initAudio(); if (soundEnabled) playCardSound('select'); }
        function createDeck() { const suits = ['♠', '♥', '♦', '♣']; const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']; const colors = ['black', 'red', 'red', 'black']; deck = []; for (let s = 0; s < suits.length; s++) { for (let v = 0; v < values.length; v++) { deck.push({ suit: suits[s], value: values[v], color: colors[s], faceUp: false, numValue: v + 1 }); } } }
        function shuffleDeck() { playCardSound('shuffle'); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }
        function initGame() {
            createDeck(); shuffleDeck();
            stock = [...deck]; waste = []; foundations = [[], [], [], []]; tableaux = [[], [], [], [], [], [], []];
            for (let col = 0; col < 7; col++) { for (let row = 0; row <= col; row++) { const card = stock.pop(); if (row === col) card.faceUp = true; tableaux[col].push(card); } }
            score = 0; moves = 0; startTime = Date.now(); gameWon = false; winCountedThisGame = false;
            clearSelection(); updateDisplay();
            updateUndoDisplay(); 
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
      img.src = `img/cards/${value}of${suit}.jpg`
    }
  }

  // Precarga la imagen del reverso de la carta
  const backImg = new Image()
  backImg.src = 'img/cards/back.jpg'
}
document.addEventListener('DOMContentLoaded', preloadCardImages)

function createCardElement(card, index = 0) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.color}`;

    if (!card.faceUp) {
        cardEl.className += ' face-down';
    } else {
        const value = card.value.toLowerCase();
        const suit = card.suit === '♥' ? 'hearts' : 
                     card.suit === '♦' ? 'diamonds' : 
                     card.suit === '♣' ? 'clubs' : 'spades';
        const imagePath = `img/cards/${value}of${suit}.jpg`;
       // const imagePath = `img/cards/aofhearts.jpg`;
        
        cardEl.style.backgroundImage = `url('${imagePath}')`;
        cardEl.style.backgroundSize = 'cover';
        cardEl.style.backgroundPosition = 'center';
        
        // Añade el valor y el palo de la carta dentro de un span
        const rankAndSuit = document.createElement('span');
        rankAndSuit.className = 'card-label';
        rankAndSuit.innerHTML = `${card.value}<br>${card.suit}`;
        cardEl.appendChild(rankAndSuit);
    }

    cardEl.style.top = `${index * 25}px`;
    cardEl.style.zIndex = index + 1;
    return cardEl;
}


// Modificar la función updateDisplay para hacer clickeable las cartas de foundation
function updateDisplay() {
    const stockEl = document.getElementById('stock'); stockEl.innerHTML = '';
    if (stock.length > 0) {
        const cardEl = createCardElement({...stock[0], faceUp: false});
        cardEl.style.top = '5px';
        stockEl.appendChild(cardEl);
    }

    const wasteEl = document.getElementById('waste'); wasteEl.innerHTML = '';
    if (waste.length > 0) {
        const card = waste[waste.length - 1];
        const cardEl = createCardElement(card);
        cardEl.style.top = '5px';
        cardEl.onclick = () => handlePileClick(waste, waste.length - 1, 'waste');
        cardEl.ondblclick = () => handleCardDoubleClick(waste, waste.length - 1);
        if (selectedPile === 'waste' && selectedIndex === waste.length - 1) { 
            cardEl.classList.add('selected'); 
        }
        wasteEl.appendChild(cardEl);
    }

    for (let i = 0; i < 4; i++) {
        const foundEl = document.getElementById(`foundation-${i}`);
        foundEl.innerHTML = '';
        foundEl.className = 'card-pile foundation';
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
                tableauEl.onclick = (e) => {
                    if (e.target === tableauEl) {
                        handlePileClick(tableaux[i], -1, `tableau-${i}`);
                    }
                };
                tableaux[i].forEach((card, index) => {
                    const cardEl = createCardElement(card, index);
                    cardEl.onclick = () => handlePileClick(tableaux[i], index, `tableau-${i}`);
                    cardEl.ondblclick = () => handleCardDoubleClick(tableaux[i], index);
                    if (selectedPile === `tableau-${i}` && index >= selectedIndex) {
                        cardEl.classList.add('selected');
                    }
                    tableauEl.appendChild(cardEl);
                });
            }

            document.getElementById('score').textContent = `Points: ${score}`;
            document.getElementById('moves').textContent = `Moves: ${moves}`;
           

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
                


                saveScoreDB();





            }
        }

async function saveScoreDB() {
    let elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    let playerName = prompt("Ingresa tu nombre:") || "Jugador";

    try {
        // Guardar score
        const saveResponse = await fetch("/.netlify/functions/addScore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: playerName, time: elapsedTime })
        });

        if (!saveResponse.ok) {
            throw new Error(`Error al guardar: ${saveResponse.status}`);
        }

        // Obtener leaderboard actualizado
        const leaderboardResponse = await fetch("/.netlify/functions/getLeaderboard");
        const leaderboard = await leaderboardResponse.json();
        
        renderLeaderboard(leaderboard);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar el puntaje');
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

            saveScoreDB();
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
            saveState();
        } else if (pileType.startsWith('foundation')) {
            const targetIndex = parseInt(pileType.split('-')[1]);
            moveToFoundation(targetIndex);
            saveState();
        } else {
            playCardSound('error');
            clearSelection();
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

        function drawCards() {
    clearSelection();
    if (stock.length > 0) {
        const card = stock.pop();
        
        card.faceUp = true;
        waste.push(card);
        moves++;
        saveState(); 
        playCardSound('flip');
    } else if (waste.length > 0) {
        
        stock = waste.reverse();
        waste = [];
        stock.forEach(card => card.faceUp = false);
        moves++;
        saveState();
        playCardSound('shuffle');
    }
    
    updateDisplay();
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
        console.log("No more free undos. Watch an ad for a new one!");
        // The user will click a separate button to watch the ad.
        return; 
    }

    if (gameHistory.length > 1) {
        gameHistory.pop();
        const lastState = gameHistory[gameHistory.length - 1];
        
        stock = [...lastState.stock];
        waste = [...lastState.waste]; 
        foundations = lastState.foundations.map(f => [...f]);
        tableaux = lastState.tableaux.map(t => [...t]);
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
    const adButton = document.getElementById('adButton');
    const undoCountDisplay = document.getElementById('undoCountDisplay');

    // Update the text to show the current count
    undoCountDisplay.textContent = `(${undoCount})`;

    // Disable the button if the count is zero
    if (undoCount <= 0) {
        undoButton.disabled = true;
        adButton.style.display = 'block';
    } else {
        undoButton.disabled = false;
        adButton.style.display = 'none';
    }
}


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


