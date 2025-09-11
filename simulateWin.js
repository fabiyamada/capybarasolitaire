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