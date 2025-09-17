// Aguarda o carregamento do DOM para iniciar o jogo
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const boardElement = document.getElementById('chessboard');
    const statusElement = document.getElementById('game-status');
    const promotionModal = document.getElementById('promotion-modal');
    const resetButton = document.getElementById('reset-button');

    // --- DEFINIÇÃO DAS PEÇAS ---
    const PIECES = {
        white_pawn: { symbol: '♙', color: 'white' }, white_rook: { symbol: '♖', color: 'white' },
        white_knight: { symbol: '♘', color: 'white' }, white_bishop: { symbol: '♗', color: 'white' },
        white_queen: { symbol: '♕', color: 'white' }, white_king: { symbol: '♔', color: 'white' },
        black_pawn: { symbol: '♟', color: 'black' }, black_rook: { symbol: '♜', color: 'black' },
        black_knight: { symbol: '♞', color: 'black' }, black_bishop: { symbol: '♝', color: 'black' },
        black_queen: { symbol: '♛', color: 'black' }, black_king: { symbol: '♚', color: 'black' }
    };
    
    // --- ESTADO DO JOGO ---
    let boardState, isWhiteTurn, selectedSquare, enPassantTarget, castlingRights, promotionResolver;

    function getInitialBoard() {
        return [
            ['black_rook', 'black_knight', 'black_bishop', 'black_queen', 'black_king', 'black_bishop', 'black_knight', 'black_rook'],
            ['black_pawn', 'black_pawn', 'black_pawn', 'black_pawn', 'black_pawn', 'black_pawn', 'black_pawn', 'black_pawn'],
            [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
            ['white_pawn', 'white_pawn', 'white_pawn', 'white_pawn', 'white_pawn', 'white_pawn', 'white_pawn', 'white_pawn'],
            ['white_rook', 'white_knight', 'white_bishop', 'white_queen', 'white_king', 'white_bishop', 'white_knight', 'white_rook']
        ];
    }

    // --- FUNÇÃO DE INICIALIZAÇÃO ---
    function initializeGame() {
        boardState = getInitialBoard();
        isWhiteTurn = true;
        selectedSquare = null;
        enPassantTarget = null;
        castlingRights = { w: { k: true, q: true }, b: { k: true, q: true } };
        promotionResolver = null;
        statusElement.innerText = 'Turno das Brancas';
        promotionModal.classList.add('hidden');
        renderBoard();
    }
    
    // --- RENDERIZAÇÃO E EVENTOS ---
    function renderBoard() {
        boardElement.innerHTML = '';
        boardState.forEach((row, r) => {
            row.forEach((pieceName, c) => {
                const square = document.createElement('div');
                square.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = r;
                square.dataset.col = c;
                
                if (pieceName) {
                    const piece = PIECES[pieceName];
                    const pieceElement = document.createElement('span');
                    pieceElement.classList.add('piece', piece.color === 'white' ? 'white-piece' : 'black-piece');
                    pieceElement.innerText = piece.symbol;
                    if (piece.color === (isWhiteTurn ? 'white' : 'black')) {
                        pieceElement.draggable = true;
                    }
                    pieceElement.addEventListener('dragstart', (e) => handleDragStart(e, r, c));
                    square.appendChild(pieceElement);
                }
                
                square.addEventListener('click', () => onSquareClick(r, c));
                square.addEventListener('dragover', handleDragOver);
                square.addEventListener('drop', (e) => handleDrop(e, r, c));
                boardElement.appendChild(square);
            });
        });
    }

    // --- LÓGICA DE MOVIMENTO (DRAG & DROP E CLIQUE) ---
    function onSquareClick(row, col) {
        if (promotionResolver) return;
        if (selectedSquare) {
            if (tryMove(selectedSquare.row, selectedSquare.col, row, col)) {
                // O movimento foi bem-sucedido, a lógica continua em finalizeTurn
            }
            clearSelection();
        } else {
            const pieceName = boardState[row][col];
            if (pieceName && PIECES[pieceName].color === (isWhiteTurn ? 'white' : 'black')) {
                selectedSquare = { row, col };
                getSquareElement(row, col).classList.add('selected');
                highlightValidMoves(row, col);
            }
        }
    }
    
    function handleDragStart(e, row, col) {
        if (promotionResolver) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', JSON.stringify({ row, col }));
        e.target.classList.add('dragging');
        setTimeout(() => highlightValidMoves(row, col), 0);
    }
    
    function handleDragOver(e) { e.preventDefault(); }
    
    function handleDrop(e, row, col) {
        e.preventDefault();
        if (promotionResolver) return;
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        const startData = JSON.parse(e.dataTransfer.getData('text/plain'));
        tryMove(startData.row, startData.col, row, col);
        clearSelection();
    }

    // --- NÚCLEO DA LÓGICA DO JOGO ---
    function tryMove(startRow, startCol, endRow, endCol) {
        const legalMoves = getAllLegalMoves(isWhiteTurn ? 'white' : 'black');
        const move = legalMoves.find(m => m.startRow === startRow && m.startCol === startCol && m.endRow === endRow && m.endCol === endCol);
        
        if (move) {
            movePiece(move);
            return true;
        }
        return false;
    }

    function movePiece(move) {
        const { startRow, startCol, endRow, endCol } = move;
        const pieceName = boardState[startRow][startCol];
        const piece = PIECES[pieceName];
        
        // En Passant
        if (pieceName.includes('pawn') && move.enPassant) {
            const capturedPawnRow = isWhiteTurn ? endRow + 1 : endRow - 1;
            boardState[capturedPawnRow][endCol] = null;
        }
        enPassantTarget = pieceName.includes('pawn') && Math.abs(startRow - endRow) === 2 ? { row: (startRow + endRow) / 2, col: endCol } : null;
        
        // Roque
        if (pieceName.includes('king') && move.castling) {
            const rookCol = endCol > startCol ? 7 : 0;
            const newRookCol = endCol > startCol ? 5 : 3;
            boardState[startRow][newRookCol] = boardState[startRow][rookCol];
            boardState[startRow][rookCol] = null;
        }
        if (pieceName.includes('king')) { castlingRights[piece.color[0]].k = castlingRights[piece.color[0]].q = false; }
        if (pieceName.includes('rook')) {
            if (startCol === 0) castlingRights[piece.color[0]].q = false;
            if (startCol === 7) castlingRights[piece.color[0]].k = false;
        }
        
        boardState[endRow][endCol] = pieceName;
        boardState[startRow][startCol] = null;
        
        if (pieceName.includes('pawn') && (endRow === 0 || endRow === 7)) {
            handlePawnPromotion(endRow, endCol);
        } else {
            finalizeTurn();
        }
    }

    function handlePawnPromotion(row, col) {
        promotionModal.classList.remove('hidden');
        const color = isWhiteTurn ? 'white' : 'black';
        promotionModal.querySelectorAll('.promotion-choice').forEach(choice => {
            const pieceType = choice.dataset.piece;
            choice.innerText = PIECES[`${color}_${pieceType}`].symbol;
            const handler = () => {
                boardState[row][col] = `${color}_${pieceType}`;
                promotionModal.classList.add('hidden');
                finalizeTurn();
                promotionModal.querySelectorAll('.promotion-choice').forEach(c => c.replaceWith(c.cloneNode(true)));
            };
            choice.addEventListener('click', handler, { once: true });
        });
    }

    function finalizeTurn() {
        isWhiteTurn = !isWhiteTurn;
        checkForGameOver();
    }

    function checkForGameOver() {
        const currentColor = isWhiteTurn ? 'white' : 'black';
        const legalMoves = getAllLegalMoves(currentColor);
        
        if (legalMoves.length === 0) {
            if (isKingInCheck(currentColor, boardState)) {
                statusElement.innerText = `Xeque-mate! ${isWhiteTurn ? 'Pretas' : 'Brancas'} venceram.`;
            } else {
                statusElement.innerText = 'Empate por Afogamento!';
            }
        } else {
            statusElement.innerText = `Turno das ${isWhiteTurn ? 'Brancas' : 'Pretas'}`;
            if (isKingInCheck(currentColor, boardState)) {
                statusElement.innerText += ' (Xeque!)';
            }
        }
        renderBoard();
    }

    // --- VALIDAÇÃO DE REGRAS ---
    function getAllLegalMoves(color) {
        let legalMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const pieceName = boardState[r][c];
                if (pieceName && PIECES[pieceName].color === color) {
                    const pseudoLegalMoves = getPseudoLegalMoves(r, c);
                    pseudoLegalMoves.forEach(move => {
                        const tempBoard = JSON.parse(JSON.stringify(boardState));
                        tempBoard[move.endRow][move.endCol] = tempBoard[r][c];
                        tempBoard[r][c] = null;
                        if (!isKingInCheck(color, tempBoard)) {
                            legalMoves.push({ startRow: r, startCol: c, ...move });
                        }
                    });
                }
            }
        }
        return legalMoves;
    }

    function getPseudoLegalMoves(r, c) {
        const pieceName = boardState[r][c], piece = PIECES[pieceName], moves = [], color = piece.color;
        const add = (endR, endC, props = {}) => {
            if (endR >= 0 && endR < 8 && endC >= 0 && endC < 8) {
                const target = boardState[endR][endC];
                if (!target || PIECES[target].color !== color) moves.push({ endRow: endR, endCol: endC, ...props });
            }
        };
        const addLine = (dr, dc) => {
            let cr = r + dr, cc = c + dc;
            while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8) {
                const target = boardState[cr][cc];
                if (target) {
                    if (PIECES[target].color !== color) add(cr, cc);
                    break;
                }
                add(cr, cc);
                cr += dr; cc += dc;
            }
        };

        if (pieceName.includes('pawn')) {
            const dir = color === 'white' ? -1 : 1;
            if (!boardState[r + dir]?.[c]) {
                add(r + dir, c);
                if ((r === 6 && color === 'white') || (r === 1 && color === 'black')) {
                    if (!boardState[r + 2 * dir]?.[c]) add(r + 2 * dir, c);
                }
            }
            [-1, 1].forEach(dc => {
                const target = boardState[r + dir]?.[c + dc];
                if (target && PIECES[target].color !== color) add(r + dir, c + dc);
                if (enPassantTarget && r + dir === enPassantTarget.row && c + dc === enPassantTarget.col) add(r + dir, c + dc, { enPassant: true });
            });
        } else if (pieceName.includes('knight')) {
            [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]].forEach(([dr, dc]) => add(r + dr, c + dc));
        } else if (pieceName.includes('king')) {
            [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]].forEach(([dr, dc]) => add(r + dr, c + dc));
            const cr = castlingRights[color[0]];
            if (cr.k && !boardState[r][c+1] && !boardState[r][c+2] && !isSquareAttacked(r, c, color) && !isSquareAttacked(r, c+1, color) && !isSquareAttacked(r, c+2, color)) add(r, c+2, { castling: true });
            if (cr.q && !boardState[r][c-1] && !boardState[r][c-2] && !boardState[r][c-3] && !isSquareAttacked(r, c, color) && !isSquareAttacked(r, c-1, color) && !isSquareAttacked(r, c-2, color)) add(r, c-2, { castling: true });
        } else {
            const dirs = [];
            if (pieceName.includes('rook') || pieceName.includes('queen')) dirs.push([-1,0], [1,0], [0,-1], [0,1]);
            if (pieceName.includes('bishop') || pieceName.includes('queen')) dirs.push([-1,-1], [-1,1], [1,-1], [1,1]);
            dirs.forEach(([dr, dc]) => addLine(dr, dc));
        }
        return moves;
    }
    
    function isKingInCheck(kingColor, board) {
        const kingPos = findKing(kingColor, board);
        return kingPos ? isSquareAttacked(kingPos.row, kingPos.col, kingColor, board) : false;
    }
    
    function isSquareAttacked(row, col, attackedColor, board) {
        const opponentColor = attackedColor === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const pieceName = board[r][c];
                if (pieceName && PIECES[pieceName].color === opponentColor) {
                    const moves = getPseudoLegalMoves(r, c); // Re-using this is fine for attack checks
                    if (moves.some(move => move.endRow === row && move.endCol === col)) return true;
                }
            }
        }
        return false;
    }
    
    function findKing(color, board) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === `${color}_king`) return { row: r, col: c };
            }
        }
        return null;
    }
    
    // --- FUNÇÕES AUXILIARES ---
    function clearSelection() {
        if (selectedSquare) {
            getSquareElement(selectedSquare.row, selectedSquare.col)?.classList.remove('selected');
        }
        selectedSquare = null;
        document.querySelectorAll('.valid-move').forEach(el => el.classList.remove('valid-move'));
    }

    function highlightValidMoves(startRow, startCol) {
        const legalMoves = getAllLegalMoves(isWhiteTurn ? 'white' : 'black');
        legalMoves.forEach(move => {
            if (move.startRow === startRow && move.startCol === startCol) {
                getSquareElement(move.endRow, move.endCol).classList.add('valid-move');
            }
        });
    }

    function getSquareElement(row, col) {
        return boardElement.querySelector(`[data-row='${row}'][data-col='${col}']`);
    }

    // --- INICIALIZAÇÃO ---
    initializeGame();
    resetButton.addEventListener('click', initializeGame);
});