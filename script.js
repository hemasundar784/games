const pieceNames = {
    'p': 'Void Kitten',      'n': 'Masked Horse',    'b': 'Midnight Wolf', 
    'r': 'Shadow Elephant',      'q': 'Vampire Queen',    'k': 'Void Overlord',
    'P': 'Daylight Kitten',  'N': 'Unicorn Knight',   'B': 'Cunning Fox',      
    'R': 'Roring Bull',     'Q': 'Calico Tigress Queen',     'K': 'Sphynx Lion King'
};

const catPieces = {
    'p': '🐈‍⬛', 'n': '🦓', 'b': '🐺', 'r': '🐘', 'q': '👸🏼', 'k': '🤴🏻',
    'P': '🐈', 'N': '🦄', 'B': '🦊', 'R': '🦬', 'Q': '🐯', 'K': '🦁'
};

const pieceValues = {
    'p': 10, 'n': 30, 'b': 30, 'r': 50, 'q': 90, 'k': 1000,
    'P': 10, 'N': 30, 'B': 30, 'R': 50, 'Q': 90, 'K': 1000
};

let boardState = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let currentTurn = 'White';
let selectedCoords = null;
let validMoves = [];
let isAiThinking = false;
let lastMovePath = [];

const boardElement = document.getElementById('chessboard');
const turnDisplay = document.getElementById('turn-display');
const fxOverlay = document.getElementById('fx-overlay');
const scratchMarks = document.getElementById('scratch-marks');
const killText = document.getElementById('kill-text');
const gameContainer = document.querySelector('.game-container');

function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 1 ? 'dark' : 'light');
            square.dataset.row = row;
            square.dataset.col = col;

            if (lastMovePath.some(p => p.row === row && p.col === col)) {
                square.classList.add('path-trail');
            }

            const piece = boardState[row][col];
            if (piece) {
                const catSpan = document.createElement('span');
                catSpan.textContent = catPieces[piece];
                catSpan.style.filter = piece === piece.toUpperCase() 
                    ? 'drop-shadow(2px 2px 2px #fff)' 
                    : 'drop-shadow(0px 0px 4px #00ffff) drop-shadow(2px 2px 2px #000)';

                square.appendChild(catSpan);

                const tooltipSpan = document.createElement('span');
                tooltipSpan.classList.add('tooltip');
                tooltipSpan.textContent = pieceNames[piece];
                square.appendChild(tooltipSpan);
            }

            if (validMoves.some(m => m.row === row && m.col === col)) square.classList.add('highlight');
            if (selectedCoords && selectedCoords.row === row && selectedCoords.col === col) square.classList.add('selected');

            square.addEventListener('click', handleSquareClick);
            boardElement.appendChild(square);
        }
    }
}

function generatePathArray(fromR, fromC, toR, toC) {
    let path = [];
    let rowStep = Math.sign(toR - fromR);
    let colStep = Math.sign(toC - fromC);
    let currentR = fromR, currentC = fromC;
    while (currentR !== toR || currentC !== toC) {
        path.push({ row: currentR, col: currentC });
        if (currentR !== toR) currentR += rowStep;
        if (currentC !== toC) currentC += colStep;
    }
    path.push({ row: toR, col: toC });
    return path;
}

function executeMove(fromRow, fromCol, toRow, toCol) {
    isAiThinking = true;
    lastMovePath = generatePathArray(fromRow, fromCol, toRow, toCol);
    
    const sourceSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
    const targetSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
    
    const movingPieceElement = sourceSquare.querySelector('span:not(.tooltip)');
    const targetPieceElement = targetSquare.querySelector('span:not(.tooltip)');
    
    const rawAttackerToken = boardState[fromRow][fromCol]; 
    const isCapture = targetPieceElement !== null;

    let moveDuration = 400; 

    if (movingPieceElement) {
        const deltaX = targetSquare.offsetLeft - sourceSquare.offsetLeft;
        const deltaY = targetSquare.offsetTop - sourceSquare.offsetTop;
        
        movingPieceElement.classList.add('real-walking');
        movingPieceElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        playWalkSound();
        let stepInterval = setInterval(() => {
            if (movingPieceElement && movingPieceElement.classList.contains('real-walking')) {
                playWalkSound();
            } else {
                clearInterval(stepInterval);
            }
        }, 140);
        setTimeout(() => clearInterval(stepInterval), moveDuration);
    }

    setTimeout(() => {
        let pieceToMove = boardState[fromRow][fromCol];
        if (pieceToMove.toLowerCase() === 'p' && (toRow === 0 || toRow === 7)) {
            pieceToMove = pieceToMove === 'P' ? 'Q' : 'q';
        }

        boardState[toRow][toCol] = pieceToMove;
        boardState[fromRow][fromCol] = '';

        if (isCapture) {
            movingPieceElement.classList.remove('real-walking');
            targetPieceElement.classList.add('fainting');
            triggerCombatFX(rawAttackerToken);
        }
        
        setTimeout(() => {
            selectedCoords = null;
            validMoves = [];
            
            // Switch team turn variables
            currentTurn = currentTurn === 'White' ? 'Black' : 'White';
            
            // 🚨 ENGINE STATE EVALUATION: Verify if the next player is in Check or Checkmate
            const nextPlayerIsWhite = (currentTurn === 'White');
            const inCheck = isKingInCheck(nextPlayerIsWhite);
            const hasMoves = playerHasAnyLegalMoves(nextPlayerIsWhite);

            if (inCheck && !hasMoves) {
                triggerSpecialStateFX("CHECKMATE");
                turnDisplay.textContent = `💥 CHECKMATE! ${nextPlayerIsWhite ? 'Black (AI)' : 'White (You)'} wins!`;
                isAiThinking = true; // Permanently lock inputs
                createBoard();
                return;
            } else if (inCheck) {
                triggerSpecialStateFX("CHECK");
                turnDisplay.textContent = `${currentTurn} (⚠️ IN CHECK!)`;
            } else if (!hasMoves) {
                triggerSpecialStateFX("STALEMATE");
                turnDisplay.textContent = "Stalemate! The cats called a draw.";
                isAiThinking = true;
                createBoard();
                return;
            } else {
                turnDisplay.textContent = currentTurn === 'White' ? 'White' : 'Black (AI Thinking...)';
            }

            isAiThinking = false;
            createBoard();

            if (currentTurn === 'Black') {
                isAiThinking = true;
                setTimeout(makeAiMove, 800); 
            }
        }, isCapture ? 600 : 50);

    }, moveDuration - 50);
}

function triggerCombatFX(attackerToken) {
    fxOverlay.classList.add('danger-flash');
    gameContainer.classList.add('shake');

    let strikeText = "🐾 MEOW KILL! 🐾";
    let textStyleClass = "text-cat";

    const isTigerAttacking = (attackerToken === 'R' || attackerToken === 'r');
    playKillSound(isTigerAttacking);

    switch (attackerToken) {
        case 'P': strikeText = "🐾 MEOW KILL! 🐾"; textStyleClass = "text-cat"; break;
        case 'N': strikeText = "✨ MYSTICAL STRIKE! ✨"; textStyleClass = "text-unicorn"; break;
        case 'B': strikeText = "🦁 ROARING SHRED! 🦁"; textStyleClass = "text-lion"; break;
        case 'R': strikeText = "🐯 TIGER SCRATCH! 🐯"; textStyleClass = "text-tiger"; scratchMarks.classList.add('slash-active'); break;
        case 'Q': strikeText = "🦊 SLY DECEPTION! 🦊"; textStyleClass = "text-fox"; break;
        case 'K': strikeText = "👑 ROYAL EXECUTION! 👑"; textStyleClass = "text-king"; break;
        case 'p': strikeText = "🐾 MEOW KILL! 🐾"; textStyleClass = "text-cat"; break;
        case 'n': strikeText = "🥷 TRICKSTER AMBUSH! 🥷"; textStyleClass = "text-bandit"; break;
        case 'b': strikeText = "🐾 SHADOW POUNCE! 🐾"; textStyleClass = "text-panther"; break;
        case 'r': strikeText = "🐺 LUNAR Tunder KILL! 🐺"; textStyleClass = "text-wolf"; break;
        case 'q': strikeText = "🩸 BLOOD DRAIN CATNIP! 🩸"; textStyleClass = "text-vampire"; break;
        case 'k': strikeText = "🎩 TOTAL DOMINATION! 🎩"; textStyleClass = "text-overlord"; break;
    }

    killText.textContent = strikeText;
    killText.className = `arcade-text ${textStyleClass} show`;
    speakWord(strikeText);

    setTimeout(() => {
        fxOverlay.classList.remove('danger-flash');
        gameContainer.classList.remove('shake');
        killText.classList.remove('show');
        scratchMarks.classList.remove('slash-active');
    }, 700);
}

// 🚨 NEW: FX LAYER TRIGGER FOR CHECK & CHECKMATE WARNINGS
function triggerSpecialStateFX(state) {
    fxOverlay.classList.add('danger-flash');
    gameContainer.classList.add('shake');

    playWarningAlarm(state === "CHECKMATE");

    if (state === "CHECKMATE") {
        killText.textContent = "💥 CHECKMATE! 💥";
        killText.className = "arcade-text text-checkmate show";
        speakWord("Checkmate! Game Over.");
    } else if (state === "CHECK") {
        killText.textContent = "⚠️ KING UNDER ATTACK! ⚠️";
        killText.className = "arcade-text text-check { show";
        speakWord("Warning! Your King is in check.");
    }

    setTimeout(() => {
        fxOverlay.classList.remove('danger-flash');
        gameContainer.classList.remove('shake');
        killText.classList.remove('show');
    }, 1000);
}

function handleSquareClick(e) {
    if (currentTurn === 'Black' || isAiThinking) return; 
    const row = parseInt(e.currentTarget.dataset.row);
    const col = parseInt(e.currentTarget.dataset.col);
    const piece = boardState[row][col];
    const pieceColor = piece ? (piece === piece.toUpperCase() ? 'White' : 'Black') : null;

    if (validMoves.some(m => m.row === row && m.col === col)) {
        executeMove(selectedCoords.row, selectedCoords.col, row, col);
        return;
    }

    if (pieceColor === currentTurn) {
        selectedCoords = { row, col };
        validMoves = calculateLegalMoves(row, col, piece, true);
        createBoard();
    } else {
        selectedCoords = null; validMoves = []; createBoard();
    }
}

// --- 🤖 AI ENGINE & CORE MOVEMENT VALIDATION MATRIX ---
function makeAiMove() {
    let allLegalMoves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece === piece.toLowerCase()) { 
                const moves = calculateLegalMoves(row, col, piece, true);
                moves.forEach(m => { allLegalMoves.push({ from: { row, col }, to: m }); });
            }
        }
    }
    if (allLegalMoves.length === 0) return; // Prevent crashing if AI is in checkmate

    let bestMove = null; let bestScore = -Infinity;
    allLegalMoves.forEach(move => {
        let score = 0; const targetPiece = boardState[move.to.row][move.to.col];
        if (targetPiece) score += pieceValues[targetPiece] * 10; 
        score += move.to.row; score += Math.random() * 2; 
        if (score > bestScore) { bestScore = score; bestMove = move; }
    });
    if (bestMove) { executeMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col); }
}

function calculateLegalMoves(row, col, piece, filterChecks = true) {
    let moves = []; const type = piece.toLowerCase(); const isWhite = piece === piece.toUpperCase();
    if (type === 'p') {
        const dir = isWhite ? -1 : 1; const startRow = isWhite ? 6 : 1;
        if (isEmpty(row + dir, col)) {
            moves.push({ row: row + dir, col });
            if (row === startRow && isEmpty(row + 2 * dir, col)) moves.push({ row: row + 2 * dir, col });
        }
        if (isEnemy(row + dir, col - 1, isWhite)) moves.push({ row: row + dir, col: col - 1 });
        if (isEnemy(row + dir, col + 1, isWhite)) moves.push({ row: row + dir, col: col + 1 });
    }
    if (type === 'n') {
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        offsets.forEach(([rO, cO]) => {
            const targetR = row + rO, targetC = col + cO;
            if (onBoard(targetR, targetC) && (!boardState[targetR][targetC] || isEnemy(targetR, targetC, isWhite))) moves.push({ row: targetR, col: targetC });
        });
    }
    if (type === 'b' || type === 'q') {
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        dirs.forEach(([rD, cD]) => {
            let r = row + rD, c = col + cD;
            while (onBoard(r, c)) {
                if (isEmpty(r, c)) { moves.push({ row: r, col: c }); }
                else { if (isEnemy(r, c, isWhite)) moves.push({ row: r, col: c }); break; }
                r += rD; c += cD;
            }
        });
    }
    if (type === 'r' || type === 'q') {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        dirs.forEach(([rD, cD]) => {
            let r = row + rD, c = col + cD;
            while (onBoard(r, c)) {
                if (isEmpty(r, c)) { moves.push({ row: r, col: c }); }
                else { if (isEnemy(r, c, isWhite)) moves.push({ row: r, col: c }); break; }
                r += rD; c += cD;
            }
        });
    }
    if (type === 'k') {
        for (let rD = -1; rD <= 1; rD++) {
            for (let cD = -1; cD <= 1; cD++) {
                if (rD === 0 && cD === 0) continue;
                const targetR = row + rD, targetC = col + cD;
                if (onBoard(targetR, targetC) && (!boardState[targetR][targetC] || isEnemy(targetR, targetC, isWhite))) moves.push({ row: targetR, col: targetC });
            }
        }
    }

    if (filterChecks) {
        return moves.filter(m => {
            const originalSource = boardState[row][col]; const originalDestination = boardState[m.row][m.col];
            boardState[m.row][m.col] = originalSource; boardState[row][col] = '';
            const kingInDanger = isKingInCheck(isWhite);
            boardState[row][col] = originalSource; boardState[m.row][m.col] = originalDestination;
            return !kingInDanger;
        });
    }
    return moves;
}

// Helper validation functions
function isKingInCheck(isWhiteKing) {
    let kingRow = -1, kingCol = -1;
    const targetKingToken = isWhiteKing ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (boardState[r][c] === targetKingToken) { kingRow = r; kingCol = c; break; }
        }
        if (kingRow !== -1) break;
    }
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && (piece === piece.toUpperCase()) !== isWhiteKing) {
                const enemyMoves = calculateLegalMoves(r, c, piece, false);
                if (enemyMoves.some(em => em.row === kingRow && em.col === kingCol)) return true;
            }
        }
    }
    return false;
}

function playerHasAnyLegalMoves(isWhitePlayer) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && (piece === piece.toUpperCase()) === isWhitePlayer) {
                const moves = calculateLegalMoves(r, c, piece, true);
                if (moves.length > 0) return true;
            }
        }
    }
    return false;
}

function onBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function isEmpty(r, c) { return onBoard(r, c) && boardState[r][c] === ''; }
function isEnemy(r, c, isWhiteSelf) {
    if (!onBoard(r, c) || boardState[r][c] === '') return false;
    const isTargetWhite = boardState[r][c] === boardState[r][c].toUpperCase();
    return isWhiteSelf !== isTargetWhite;
}

// --- 🔊 AUDIO AND WAVE FREQUENCY GENERATOR CONFIG ---
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playWalkSound() {
    initAudio(); if (!audioCtx) return;
    const now = audioCtx.currentTime;
    let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    gain.gain.setValueAtTime(0.15, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.08);
}

function playKillSound(isTiger) {
    initAudio(); if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (isTiger) {
        let osc1 = audioCtx.createOscillator(); let gain1 = audioCtx.createGain();
        osc1.type = 'sawtooth'; osc1.frequency.setValueAtTime(90, now);
        osc1.frequency.linearRampToValueAtTime(40, now + 0.5);
        let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(300, now);
        gain1.gain.setValueAtTime(0.5, now); gain1.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc1.connect(filter); filter.connect(gain1); gain1.connect(audioCtx.destination);
        osc1.start(now); osc1.stop(now + 0.5);
    } else {
        let osc2 = audioCtx.createOscillator(); let gain2 = audioCtx.createGain();
        osc2.type = 'triangle'; osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain2.gain.setValueAtTime(0.4, now); gain2.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        osc2.start(now); osc2.stop(now + 0.3);
    }
}

// 🚨 NEW: PIERCING HIGH-FREQUENCY WARNING SYSTEM SYNTHESIZER
function playWarningAlarm(isCheckmate) {
    initAudio(); if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (isCheckmate) {
        // 💥 DEVASATING MULTI-TONE DOWNWARD ALARM LOOP FOR CHECKMATE
        for (let i = 0; i < 3; i++) {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            // Piercing high-frequency dissonance (900Hz, 950Hz, etc.)
            osc.frequency.setValueAtTime(900 + (i * 50), now);
            osc.frequency.linearRampToValueAtTime(200, now + 0.8);
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.8);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.8);
        }
    } else {
        // ⚠️ TWO-TONE HIGH FREQUENCY WARNING SIREN PULSE FOR CHECK
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'square'; // Harsh square wave structure for alerts
        
        osc.frequency.setValueAtTime(1200, now); // Very high pitch warning
        osc.frequency.setValueAtTime(800, now + 0.15); // Rapid oscillate drop
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.4);
    }
}

function speakWord(text) {
    const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '');
    window.speechSynthesis.cancel();
    let utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1; utterance.pitch = 0.8;
    window.speechSynthesis.speak(utterance);
}

createBoard();