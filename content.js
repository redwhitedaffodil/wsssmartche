// Smart Chess Bot - Chrome Extension Content Script
// Converted from userscript for Chrome extension compatibility

// Helper function to safely check if the current page is a chess site
// Uses URL parsing to prevent URL spoofing attacks
function isOnChessSite(siteType) {
  try {
    const hostname = window.location.hostname.toLowerCase();
    if (siteType === 'lichess') {
      return hostname === 'lichess.org' || hostname === 'www.lichess.org' || hostname.endsWith('.lichess.org');
    } else if (siteType === 'chess.com') {
      return hostname === 'chess.com' || hostname === 'www.chess.com' || hostname.endsWith('.chess.com');
    }
    return false;
  } catch (e) {
    return false;
  }
}

// VARS
const repositoryRawURL = 'https://raw.githubusercontent.com/sayfpack13/chess-analysis-bot/main/tampermonkey%20script';
const LICHESS_API = "https://lichess.org/api/cloud-eval";
const CHESS_COM = 0;
const LICHESS_ORG = 1;


const MAX_DEPTH = 20;
const MIN_DEPTH = 1;
const MAX_MOVETIME = 2000;
const MIN_MOVETIME = 50;
const MAX_ELO = 3500;
const DEPTH_MODE = 0;
const MOVETIME_MODE = 1;
const MATE_SCORE = 10000;
const rank = ["Beginner", "Intermediate", "Advanced", "Expert", "Master", "Grand Master"];
const WEB_ENGINE_IDS = [0, 1, 2];
const ENGINE_INITIALIZATION_TIMEOUT = 5000;



var nightMode = false;
var engineMode = 0;
var engineIndex = 0;
var reload_every = 10;
var reload_engine = false;
var enableUserLog = true;
var enableEngineLog = true;
var displayMovesOnSite = false;
var show_opposite_moves = false;
var use_book_moves = false;
var node_engine_url = "http://localhost:5000";
var node_engine_name = "stockfish-15"; // Platform-agnostic engine name (no .exe extension)
var websocket_engine_url = "wss://ProtonnDev-engine.hf.space";
var websocket_engine_type = "stockfish"; // stockfish, maia, rodent3, patricia
var websocket_engine_version = "16"; // version/elo/personality based on type
var current_depth = Math.round(MAX_DEPTH / 2);
var current_movetime = Math.round(MAX_MOVETIME / 3);
var max_best_moves = Math.floor(current_depth / 2);
var bestMoveColors = [];

var bullet_mode = false;
var bullet_depth = 4;
var bullet_movetime = 100;

var lastBestMoveID = 0;

// WebSocket engine state
var websocketEngine = null;
var websocketEngineReady = false;
var websocketPendingRequest = null;
var websocketResponseBuffer = "";



const dbValues = {
    nightMode: 'nightMode',
    engineMode: 'engineMode',
    engineIndex: 'engineIndex',
    reload_every: 'reload_every',
    reload_engine: 'reload_engine',
    enableUserLog: 'enableUserLog',
    enableEngineLog: 'enableEngineLog',
    displayMovesOnSite: 'displayMovesOnSite',
    show_opposite_moves: "show_opposite_moves",
    use_book_moves: "use_book_moves",
    node_engine_url: "node_engine_url",
    node_engine_name: "node_engine_name",
    websocket_engine_url: "websocket_engine_url",
    websocket_engine_type: "websocket_engine_type",
    websocket_engine_version: "websocket_engine_version",
    current_depth: "current_depth",
    current_movetime: "current_movetime",
    max_best_moves: "max_best_moves",
    bestMoveColors: "bestMoveColors",
    bullet_mode: "bullet_mode",
    bullet_depth: "bullet_depth",
    bullet_movetime: "bullet_movetime"
};


var Gui = null;
var closedGui = false;
var reload_count = 1;
var node_engine_id = 3;
var lichess_cloud_engine_id = 4;
var websocket_engine_id = 5;
var Interface = null;
var LozzaUtils = null;
var CURRENT_SITE = null;
var boardElem = null;
var firstPieceElem = null;
const MAX_LOGS = 50;


var initialized = false;
var firstMoveMade = false;

var forcedBestMove = false;
var engine = null;
var engineObjectURL = null;
var lastEngine = engineIndex;

var chessBoardElem = null;
var turn = '-';
var last_turn = null;
var playerColor = null;
var lastPlayerColor = null;
var isPlayerTurn = null;
var lastFen = null;

var uiChessBoard = null;

var activeGuiMoveHighlights = [];
var activeSiteMoveHighlights = [];

var lastHighlightedFen = null;
var lastHighlightTime = 0;
const MIN_HIGHLIGHT_DISPLAY_MS = 500; // Show highlights for at least 500ms

// Request throttling to prevent excessive analysis requests
var lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 200; // Max 5 requests per second

const MIN_DEPTH_THRESHOLD = 10;

var engineLogNum = 1;
var userscriptLogNum = 1;
var enemyScore = 0;
var myScore = 0;

var possible_moves = [];

var updatingBestMove = false;

const defaultFromSquareStyle = 'border: 4px solid rgb(0 0 0 / 50%);';
const defaultToSquareStyle = 'border: 4px dashed rgb(0 0 0 / 50%);';


// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSetting') {
        updateSettingFromPopup(request.key, request.value);
        sendResponse({ success: true });
    } else if (request.action === 'openGui') {
        if (chessBoardElem) {
            initialize();
        }
        sendResponse({ success: true });
    } else if (request.action === 'getBestMove') {
        if (chessBoardElem && Interface) {
            forcedBestMove = true;
            updateBoard();
            sendBestMove();
        }
        sendResponse({ success: true });
    } else if (request.action === 'refreshHighlights') {
        if (chessBoardElem && Interface) {
            refreshHighlights();
        }
        sendResponse({ success: true });
    }
    return true;
});

function updateSettingFromPopup(key, value) {
    switch(key) {
        case 'bullet_mode':
            bullet_mode = value;
            break;
        case 'displayMovesOnSite':
            displayMovesOnSite = value;
            break;
        case 'engineIndex':
            lastEngine = engineIndex;
            engineIndex = value;
            if (engineObjectURL) {
                URL.revokeObjectURL(engineObjectURL);
                engineObjectURL = null;
            }
            reloadChessEngine(true, () => {
                if (Interface) {
                    Interface.boardUtils.removeBestMarkings();
                    removeSiteMoveMarkings();
                    Interface.boardUtils.updateBoardPower(0, 0);
                }
            });
            break;
        case 'node_engine_url':
            node_engine_url = value;
            break;
        case 'node_engine_name':
            node_engine_name = value;
            break;
        case 'websocket_engine_url':
            websocket_engine_url = value;
            // Reconnect if currently using WebSocket engine
            if (engineIndex === websocket_engine_id) {
                connectWebSocketEngine();
            }
            break;
        case 'websocket_engine_type':
            websocket_engine_type = value;
            // Reconnect if currently using WebSocket engine
            if (engineIndex === websocket_engine_id) {
                connectWebSocketEngine();
            }
            break;
        case 'websocket_engine_version':
            websocket_engine_version = value;
            // Reconnect if currently using WebSocket engine
            if (engineIndex === websocket_engine_id) {
                connectWebSocketEngine();
            }
            break;
    }
}


// Note: This function was used in the userscript for Firefox compatibility
// Chrome extensions only run in Chromium-based browsers, so this always returns false
function isNotCompatibleBrowser() {
    return false; // Chrome extensions don't support Firefox
}

// Start function
window.addEventListener('load', function() {
    const waitingMessage = document.createElement('div');
    waitingMessage.style.position = 'fixed';
    waitingMessage.style.bottom = '0';
    waitingMessage.style.left = '0';
    waitingMessage.style.right = '0';
    waitingMessage.style.backgroundColor = 'rgba(255, 54, 54, 0.7)';
    waitingMessage.style.color = '#fff';
    waitingMessage.style.padding = '10px';
    waitingMessage.style.fontSize = '2rem';
    waitingMessage.style.textAlign = 'center';
    waitingMessage.textContent = '♟️ Smart Chess Bot is waiting for your game ♟️';
    waitingMessage.style.zIndex = "100000";
    document.body.appendChild(waitingMessage);



    const waitForChessBoard = setInterval(() => {
        if (CURRENT_SITE) {
            return;
        }

        if (isOnChessSite('lichess')) {
            const mainBoard = document.querySelector('.round__app__board.main-board');
            if (mainBoard && mainBoard.querySelector('piece')) {
                CURRENT_SITE = LICHESS_ORG;
                boardElem = mainBoard;
                firstPieceElem = mainBoard.querySelector('piece');
            }
        }
        else if (isOnChessSite('chess.com')) {
            const board = document.querySelector('.board');
            if (board && board.querySelector(".piece")) {
                CURRENT_SITE = CHESS_COM;
                boardElem = board;
                firstPieceElem = document.querySelector('.piece');
            }
        }

        if (boardElem && firstPieceElem && chessBoardElem != boardElem) {
            chessBoardElem = boardElem;

            initialize();

            waitingMessage.style.display = 'none';

            clearInterval(waitForChessBoard);
        }
    }, 2000);
});




function moveResult(from, to, power, clear = true, depth = null) {
    if (from.length < 2 || to.length < 2) {
        return;
    }

    if (clear) {
        clearBoard(true); // Force clear for new move result
    }

    lastHighlightedFen = lastFen;
    lastHighlightTime = Date.now();

    if (!forcedBestMove) {
        if (isPlayerTurn)
            myScore = myScore + Number(power);
        else
            enemyScore = enemyScore + Number(power);

        Interface.boardUtils.updateBoardPower(myScore, enemyScore);
    } else {
        forcedBestMove = false;
    }

    if (depth !== null && Number(depth) < MIN_DEPTH_THRESHOLD) {
        Interface.log(`⚠️ Warning: Analysis depth only ${depth}, results may be unreliable`);
    }

    const color = hexToRgb(bestMoveColors[0]);
    Interface.boardUtils.markMove(from, to, color);


    for (let a = 0; a < possible_moves.length; a++) {
        const color = hexToRgb(bestMoveColors[a]);
        Interface.boardUtils.markMove(possible_moves[a].slice(0, 2), possible_moves[a].slice(2, 4), color);
    }

    // Send analysis result to popup
    const move = from + to;
    try {
        chrome.runtime.sendMessage({
            type: 'analysisComplete',
            move: move,
            depth: depth,
            score: power
        });
    } catch (e) {
        // Expected when popup is not open - chrome.runtime.lastError is set
        // Only log unexpected errors
        if (e.message && !e.message.includes('receiving end does not exist')) {
            console.warn('[SmartChessBot] Error sending message to popup:', e.message);
        }
    }

    Interface.stopBestMoveProcessingAnimation();
}

function hexToRgb(hex) {
    if (!hex) {
        return [0, 255, 0, 0.5];
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 0.5];
}



function getBookMoves(request) {
    Interface.log('Checking book moves from Lichess API...');

    fetch(LICHESS_API + "?fen=" + encodeURIComponent(request.fen) + "&multiPv=1&variant=fromPosition", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => {
        const FenUtil = new FenUtils();
        const currentFen = FenUtil.getFen();
        if (currentFen !== request.fen) {
            Interface.log('Position changed, discarding book move response');
            return null;
        }
        return response.json();
    })
    .then(data => {
        if (!data) return;
        
        if (lastBestMoveID != request.id) {
            Interface.log('Ignoring stale book move response');
            return;
        }

        if (data.error || !data.pvs || data.pvs.length === 0) {
            Interface.log('No book move found, using engine analysis...');
            getBestMoves(request);
            return;
        }

        let nextMove = data.pvs[0].moves.split(' ')[0];
        let depth = data.depth || current_depth;

        Interface.log(`Book move found: ${nextMove} (depth ${depth})`);

        possible_moves = [];
        moveResult(nextMove.slice(0, 2), nextMove.slice(2, 4), depth, true, depth);
    })
    .catch(error => {
        if (lastBestMoveID != request.id) {
            return;
        }
        getBestMoves(request);
    });
}

function getLichessCloudBestMoves(request) {
    const multiPv = Math.min(max_best_moves + 1, 5);

    const fullUrl = LICHESS_API + "?fen=" + encodeURIComponent(request.fen) + "&multiPv=" + multiPv + "&variant=fromPosition";
    Interface.log(`Lichess Cloud request URL: ${fullUrl}`);

    fetch(fullUrl, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => {
        const FenUtil = new FenUtils();
        const currentFen = FenUtil.getFen();
        if (currentFen !== request.fen) {
            Interface.log('Position changed, discarding Lichess Cloud analysis');
            return null;
        }
        
        if (lastBestMoveID != request.id) {
            Interface.log('Ignoring stale response (request ID mismatch)');
            return null;
        }

        Interface.log('Received response from Lichess Cloud API');

        if (!response.ok) {
            Interface.log('Lichess Cloud API unavailable, falling back to Node Server...');
            getNodeBestMoves(request);
            return null;
        }
        
        return response.json();
    })
    .then(data => {
        if (!data) return;

        if (!data.pvs || data.pvs.length === 0) {
            Interface.log('No analysis available from Lichess Cloud, trying Node Server...');
            getNodeBestMoves(request);
            return;
        }

        let bestPv = data.pvs[0];
        let nextMove = bestPv.moves.split(' ')[0];
        let depth = data.depth || current_depth;
        let score = bestPv.cp !== undefined ? bestPv.cp : (bestPv.mate !== undefined ? (bestPv.mate > 0 ? MATE_SCORE : -MATE_SCORE) : 0);

        possible_moves = [];
        for (let i = 1; i < data.pvs.length && i <= max_best_moves; i++) {
            let pvMove = data.pvs[i].moves.split(' ')[0];
            if (pvMove && pvMove.length >= 4) {
                possible_moves.push(pvMove);
            }
        }

        Interface.updateBestMoveProgress(`Cloud Depth: ${depth}`);
        Interface.engineLog("bestmove " + nextMove + " (Lichess Cloud, depth " + depth + ", score " + score + ")");
        Interface.log(`Analysis complete: depth ${depth}, move ${nextMove}`);

        moveResult(nextMove.slice(0, 2), nextMove.slice(2, 4), depth, true, depth);
    })
    .catch(error => {
        if (lastBestMoveID != request.id) {
            return;
        }
        Interface.log('Lichess Cloud API error, falling back to Node Server...');
        getNodeBestMoves(request);
    });
}

function getNodeBestMoves(request) {
    const effectiveDepth = bullet_mode ? Math.min(current_depth, bullet_depth) : current_depth;
    const effectiveMovetime = bullet_mode ? bullet_movetime : current_movetime;
    
    const bulletParam = bullet_mode ? '&bullet_mode=true' : '';
    
    const engineTurn = last_turn ? (last_turn === 'w' ? 'b' : 'w') : turn;
    
    const fullUrl = node_engine_url + "/getBestMove?fen=" + encodeURIComponent(request.fen) + "&engine_mode=" + engineMode + "&depth=" + effectiveDepth + "&movetime=" + effectiveMovetime + "&turn=" + engineTurn + "&engine_name=" + node_engine_name + bulletParam;
    Interface.log(`Node Server request URL: ${fullUrl}`);

    fetch(fullUrl, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.success == "false") {
            forcedBestMove = false;
            return Interface.log("Error: " + result.data);
        }

        const FenUtil = new FenUtils();
        const currentFen = FenUtil.getFen();
        if (currentFen !== request.fen) {
            Interface.log('Position changed, discarding Node Server analysis');
            return;
        }
        
        if (lastBestMoveID != request.id) {
            Interface.log('Ignoring stale response (request ID mismatch)');
            return;
        }

        Interface.log('Received response from Node Server');

        let data = result.data;
        let depth = data.depth;
        let movetime = data.movetime;
        let power = data.score;
        let move = data.bestMove;
        let ponder = data.ponder;

        if (engineMode == DEPTH_MODE) {
            Interface.updateBestMoveProgress(`Depth: ${depth}`);
            Interface.log(`Analysis complete: requested depth ${effectiveDepth}, achieved depth ${depth}`);
        } else {
            Interface.updateBestMoveProgress(`Move time: ${movetime} ms`);
            Interface.log(`Analysis complete: movetime ${movetime}ms, depth ${depth}`);
        }

        Interface.engineLog("bestmove " + move + " ponder " + ponder + " (depth " + depth + ", score " + power + ")");


        possible_moves = [];
        moveResult(move.slice(0, 2), move.slice(2, 4), power, true, depth);
    })
    .catch(error => {
        forcedBestMove = false;
        Interface.log("make sure node server is running !!");
    });
}

function connectWebSocketEngine() {
    if (websocketEngine) {
        try {
            websocketEngine.close();
        } catch (e) {
            // Ignore close errors
        }
        websocketEngine = null;
    }
    
    websocketEngineReady = false;
    websocketResponseBuffer = "";
    
    // Build WebSocket URL based on engine type and version
    let wsUrl = websocket_engine_url;
    
    // Ensure base URL doesn't end with slashes
    wsUrl = wsUrl.replace(/\/+$/, '');
    
    // Append engine path based on type
    if (websocket_engine_type === 'stockfish') {
        wsUrl += `/stockfish-${websocket_engine_version}`;
    } else if (websocket_engine_type === 'maia') {
        wsUrl += `/maia-${websocket_engine_version}`;
    } else if (websocket_engine_type === 'rodent3') {
        wsUrl += `/rodent3-${websocket_engine_version}`;
    } else if (websocket_engine_type === 'patricia') {
        wsUrl += `/patricia-${websocket_engine_version}`;
    }
    
    Interface.log(`Connecting to WebSocket engine: ${wsUrl}`);
    
    try {
        websocketEngine = new WebSocket(wsUrl);
        
        websocketEngine.onopen = () => {
            Interface.log('WebSocket engine connected');
            // Initialize UCI protocol
            websocketEngine.send('uci');
            websocketEngine.send('isready');
        };
        
        websocketEngine.onmessage = (event) => {
            const data = event.data;
            Interface.engineLog(data);
            
            websocketResponseBuffer += data + '\n';
            
            // Check for readyok - engine is ready for commands
            if (data.includes('readyok')) {
                websocketEngineReady = true;
                Interface.log('WebSocket engine ready');
                
                // Process pending request if any
                if (websocketPendingRequest) {
                    const request = websocketPendingRequest;
                    websocketPendingRequest = null;
                    getWebSocketBestMoves(request);
                }
            }
            
            // Check for bestmove response
            if (data.includes('bestmove') && websocketPendingRequest) {
                handleWebSocketBestMove(data, websocketPendingRequest);
                websocketPendingRequest = null;
            }
        };
        
        websocketEngine.onerror = (error) => {
            Interface.log('WebSocket error - check connection and URL');
            console.error('WebSocket error:', error);
            websocketEngineReady = false;
        };
        
        websocketEngine.onclose = () => {
            Interface.log('WebSocket engine disconnected');
            websocketEngineReady = false;
            
            // Auto-reconnect after 2 seconds if engine index is still WebSocket
            if (engineIndex === websocket_engine_id) {
                setTimeout(() => {
                    if (engineIndex === websocket_engine_id) {
                        Interface.log('Attempting to reconnect WebSocket engine...');
                        connectWebSocketEngine();
                    }
                }, 2000);
            }
        };
    } catch (error) {
        Interface.log('Failed to create WebSocket connection');
        console.error('WebSocket connection error:', error);
    }
}

function handleWebSocketBestMove(data, request) {
    const FenUtil = new FenUtils();
    const currentFen = FenUtil.getFen();
    if (currentFen !== request.fen) {
        Interface.log('Position changed, discarding WebSocket analysis');
        websocketResponseBuffer = "";
        return;
    }
    
    if (lastBestMoveID !== request.id) {
        Interface.log('Ignoring stale WebSocket response');
        websocketResponseBuffer = "";
        return;
    }
    
    // Parse bestmove from UCI output
    const bestmoveMatch = data.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (!bestmoveMatch) {
        Interface.log('Invalid bestmove response from WebSocket engine');
        websocketResponseBuffer = "";
        return;
    }
    
    const move = bestmoveMatch[1];
    
    // Parse depth and score from info lines in buffer
    let depth = current_depth;
    let score = 0;
    
    const infoLines = websocketResponseBuffer.split('\n').filter(line => line.includes('info'));
    if (infoLines.length > 0) {
        // Get the last info line with depth
        for (let i = infoLines.length - 1; i >= 0; i--) {
            const line = infoLines[i];
            const depthMatch = line.match(/depth\s+(\d+)/);
            if (depthMatch) {
                depth = parseInt(depthMatch[1]);
            }
            
            // Try to get score cp (centipawns)
            const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
            if (cpMatch) {
                score = parseInt(cpMatch[1]);
                break;
            }
            
            // Check for mate score
            const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
            if (mateMatch) {
                const mateIn = parseInt(mateMatch[1]);
                score = mateIn > 0 ? MATE_SCORE : -MATE_SCORE;
                break;
            }
        }
    }
    
    Interface.log(`WebSocket analysis complete: depth ${depth}, move ${move}, score ${score}`);
    Interface.updateBestMoveProgress(`WS Depth: ${depth}`);
    Interface.engineLog(`bestmove ${move} (WebSocket, depth ${depth}, score ${score})`);
    
    // Parse possible moves from pv lines (multipv 2, 3, 4, ... are alternative moves)
    possible_moves = [];
    const pvMatches = websocketResponseBuffer.matchAll(/multipv\s+(\d+).*?pv\s+([a-h][1-8][a-h][1-8][qrbn]?)/g);
    for (const match of pvMatches) {
        const multiPvNum = parseInt(match[1]);
        // Skip multipv 1 (that's the best move), include 2 onwards up to max_best_moves+1
        if (multiPvNum > 1 && multiPvNum <= max_best_moves + 1) {
            possible_moves.push(match[2]);
        }
    }
    
    websocketResponseBuffer = "";
    moveResult(move.slice(0, 2), move.slice(2, 4), depth, true, depth);
}

function getWebSocketBestMoves(request) {
    if (!websocketEngine || websocketEngine.readyState !== WebSocket.OPEN) {
        Interface.log('WebSocket engine not connected, attempting to connect...');
        websocketPendingRequest = request;
        connectWebSocketEngine();
        return;
    }
    
    if (!websocketEngineReady) {
        Interface.log('WebSocket engine not ready, waiting...');
        websocketPendingRequest = request;
        return;
    }
    
    const effectiveDepth = bullet_mode ? Math.min(current_depth, bullet_depth) : current_depth;
    const effectiveMovetime = bullet_mode ? bullet_movetime : current_movetime;
    
    Interface.log(`Using WebSocket engine (depth: ${effectiveDepth}, movetime: ${effectiveMovetime})...`);
    
    websocketResponseBuffer = "";
    websocketPendingRequest = request;
    
    // Send UCI commands
    try {
        websocketEngine.send('ucinewgame');
        websocketEngine.send(`position fen ${request.fen}`);
        
        // Set MultiPV if supported (for alternative moves)
        const multiPv = Math.min(max_best_moves + 1, 5);
        websocketEngine.send(`setoption name MultiPV value ${multiPv}`);
        
        if (bullet_mode) {
            websocketEngine.send(`go movetime ${effectiveMovetime}`);
        } else if (engineMode === DEPTH_MODE) {
            websocketEngine.send(`go depth ${effectiveDepth}`);
        } else {
            websocketEngine.send(`go movetime ${effectiveMovetime}`);
        }
    } catch (error) {
        Interface.log('Error sending commands to WebSocket engine');
        console.error('WebSocket send error:', error);
        websocketPendingRequest = null;
    }
}

function getElo() {
    let elo;
    if (engineMode == DEPTH_MODE) {
        elo = MAX_ELO / MAX_DEPTH;
        elo *= current_depth;
    } else {
        elo = MAX_ELO / MAX_MOVETIME;
        elo *= current_movetime;
    }
    elo = Math.round(elo);

    return elo;
}

function getRank() {
    let part;
    if (engineMode == DEPTH_MODE) {
        part = current_depth / (MAX_DEPTH / rank.length);
    } else {
        part = current_movetime / (MAX_MOVETIME / rank.length);
    }
    part = Math.round(part);

    if (part >= rank.length) {
        part = rank.length - 1;
    }

    return rank[part];
}



function setEloDescription(eloElem) {
    eloElem.querySelector("#value").innerText = `Elo: ${getElo()}`;
    eloElem.querySelector("#rank").innerText = `Rank: ${getRank()}`;
    eloElem.querySelector("#power").innerText = engineMode == DEPTH_MODE ? `Depth: ${current_depth}` : `Move Time: ${current_movetime}`;
}


function alphabetPosition(text) {
    return text.charCodeAt(0) - 97;
}

function isLichessBoardFlipped() {
    return document.querySelector(".orientation-white") === null;
}


function FenUtils() {
    const SQUARE_SIZE_PERCENT = 12.5;
    const DEFAULT_BOARD_SIZE = 400;
    const STYLE_TOP_REGEX = /top:\s*(\d+(?:\.\d+)?)\s*%/;
    const STYLE_LEFT_REGEX = /left:\s*(\d+(?:\.\d+)?)\s*%/;
    const TRANSFORM_REGEX = /transform:\s*translate(?:3d)?\(\s*(-?\d+(?:\.\d+)?)\s*px\s*,\s*(-?\d+(?:\.\d+)?)\s*px(?:\s*,\s*-?\d+(?:\.\d+)?\s*px)?\)/;
    const STYLE_WIDTH_REGEX = /width:\s*(\d+(?:\.\d+)?)\s*px/;
    const STYLE_HEIGHT_REGEX = /height:\s*(\d+(?:\.\d+)?)\s*px/;
    const PIECE_TYPES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
    const BOARD_MIN = 0;
    const BOARD_MAX = 7;
    
    this.board = [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
    ];

    this.pieceCodeToFen = pieceStr => {
        let [pieceColor, pieceName] = pieceStr.split('');

        return pieceColor == 'w' ? pieceName.toUpperCase() : pieceName.toLowerCase();
    }

    this.getFenCodeFromPieceElem = pieceElem => {
        if (CURRENT_SITE == CHESS_COM) {
            return this.pieceCodeToFen([...pieceElem.classList].find(x => x.match(/^(b|w)[prnbqk]{1}$/)));
        } else if (CURRENT_SITE == LICHESS_ORG) {
            const classList = [...pieceElem.classList];
            let pieceColor = null;
            let pieceName = null;
            
            if (classList.includes('white')) {
                pieceColor = 'white';
            } else if (classList.includes('black')) {
                pieceColor = 'black';
            }
            
            // Check for exact class matches first
            for (const type of PIECE_TYPES) {
                if (classList.includes(type)) {
                    pieceName = type;
                    break;
                }
            }
            
            // Fallback: check className string for partial matches
            if (!pieceColor || !pieceName) {
                const classStr = pieceElem.className.toLowerCase();
                if (!pieceColor) {
                    if (classStr.includes('white')) {
                        pieceColor = 'white';
                    } else if (classStr.includes('black')) {
                        pieceColor = 'black';
                    }
                }
                
                if (!pieceName) {
                    // Check for exact piece type matches
                    for (const type of PIECE_TYPES) {
                        if (classStr.includes(type)) {
                            pieceName = type;
                            break;
                        }
                    }
                }
            }
            
            if (!pieceColor || !pieceName) {
                return null;
            }

            // Convert piece type to single character FEN notation
            let pieceChar;
            switch(pieceName) {
                case 'knight': pieceChar = 'n'; break;
                case 'bishop': pieceChar = 'b'; break;
                case 'king': pieceChar = 'k'; break;
                case 'queen': pieceChar = 'q'; break;
                case 'rook': pieceChar = 'r'; break;
                case 'pawn': pieceChar = 'p'; break;
                default:
                    console.warn('[SmartChessBot] Unknown piece type:', pieceName);
                    return null;
            }

            let pieceText = pieceColor[0] + pieceChar;
            return this.pieceCodeToFen(pieceText)
        }
    }

    this.getPieceColor = pieceFenStr => {
        return pieceFenStr == pieceFenStr.toUpperCase() ? 'w' : 'b';
    }

    this.getPieceOppositeColor = pieceFenStr => {
        return this.getPieceColor(pieceFenStr) == 'w' ? 'b' : 'w';
    }

    this.squeezeEmptySquares = fenStr => {
        return fenStr.replace(/11111111/g, '8')
            .replace(/1111111/g, '7')
            .replace(/111111/g, '6')
            .replace(/11111/g, '5')
            .replace(/1111/g, '4')
            .replace(/111/g, '3')
            .replace(/11/g, '2');
    }

    this.posToIndex = pos => {
        let [x, y] = pos.split('');

        return { 'y': 8 - y, 'x': 'abcdefgh'.indexOf(x) };
    }

    this.getBoardPiece = pos => {
        let indexObj = this.posToIndex(pos);

        return this.board[indexObj.y][indexObj.x];
    }

    this.getRights = () => {
        let rights = '';

        let e1 = this.getBoardPiece('e1'),
            h1 = this.getBoardPiece('h1'),
            a1 = this.getBoardPiece('a1');

        if (e1 == 'K' && h1 == 'R') rights += 'K';
        if (e1 == 'K' && a1 == 'R') rights += 'Q';

        let e8 = this.getBoardPiece('e8'),
            h8 = this.getBoardPiece('h8'),
            a8 = this.getBoardPiece('a8');

        if (e8 == 'k' && h8 == 'r') rights += 'k';
        if (e8 == 'k' && a8 == 'r') rights += 'q';

        return rights ? rights : '-';
    }




    this.getBasicFen = () => {
        let pieceElems = null;

        if (CURRENT_SITE == CHESS_COM) {
            pieceElems = [...chessBoardElem.querySelectorAll('.piece')];


        } else if (CURRENT_SITE == LICHESS_ORG) {
            pieceElems = [...chessBoardElem.querySelectorAll('piece')];
        }


        pieceElems.filter(pieceElem => !pieceElem.classList.contains("ghost")).forEach(pieceElem => {
            let pieceFenCode = this.getFenCodeFromPieceElem(pieceElem);

            if (!pieceFenCode) {
                return;
            }

            if (CURRENT_SITE == CHESS_COM) {
                let [xPos, yPos] = pieceElem.classList.toString().match(/square-(\d)(\d)/).slice(1);

                this.board[8 - yPos][xPos - 1] = pieceFenCode;
            } else if (CURRENT_SITE == LICHESS_ORG) {
                const flipped = isLichessBoardFlipped();
                
                if (pieceElem.cgKey) {
                    let [xPos, yPos] = pieceElem.cgKey.split('');
                    this.board[8 - yPos][alphabetPosition(xPos)] = pieceFenCode;
                } else {
                    const style = pieceElem.getAttribute('style');
                    if (style) {
                        const transformMatch = style.match(TRANSFORM_REGEX);
                        if (transformMatch) {
                            const xPixels = parseFloat(transformMatch[1]);
                            const yPixels = parseFloat(transformMatch[2]);
                            
                            const cgContainer = chessBoardElem.querySelector('cg-container');
                            if (cgContainer) {
                                const containerStyle = cgContainer.getAttribute('style') || '';
                                const widthMatch = containerStyle.match(STYLE_WIDTH_REGEX);
                                const heightMatch = containerStyle.match(STYLE_HEIGHT_REGEX);
                                
                                const boardWidth = widthMatch ? parseFloat(widthMatch[1]) : cgContainer.clientWidth || DEFAULT_BOARD_SIZE;
                                const boardHeight = heightMatch ? parseFloat(heightMatch[1]) : cgContainer.clientHeight || DEFAULT_BOARD_SIZE;
                                
                                const squareWidth = boardWidth / 8;
                                const squareHeight = boardHeight / 8;
                                
                                let visualX = Math.floor(xPixels / squareWidth);
                                let visualY = Math.floor(yPixels / squareHeight);
                                
                                let fenX, fenY;
                                if (!flipped) {
                                    fenX = visualX;
                                    fenY = visualY;
                                } else {
                                    fenX = 7 - visualX;
                                    fenY = 7 - visualY;
                                }
                                
                                if (fenY >= BOARD_MIN && fenY <= BOARD_MAX && fenX >= BOARD_MIN && fenX <= BOARD_MAX) {
                                    this.board[fenY][fenX] = pieceFenCode;
                                }
                            }
                        } else {
                            const topMatch = style.match(STYLE_TOP_REGEX);
                            const leftMatch = style.match(STYLE_LEFT_REGEX);
                            
                            if (topMatch && leftMatch) {
                                const topPercent = parseFloat(topMatch[1]);
                                const leftPercent = parseFloat(leftMatch[1]);
                                
                                let visualY = Math.floor(topPercent / SQUARE_SIZE_PERCENT);
                                let visualX = Math.floor(leftPercent / SQUARE_SIZE_PERCENT);
                                
                                let fenX, fenY;
                                if (!flipped) {
                                    fenX = visualX;
                                    fenY = visualY;
                                } else {
                                    fenX = 7 - visualX;
                                    fenY = 7 - visualY;
                                }
                                
                                if (fenY >= BOARD_MIN && fenY <= BOARD_MAX && fenX >= BOARD_MIN && fenX <= BOARD_MAX) {
                                    this.board[fenY][fenX] = pieceFenCode;
                                }
                            }
                        }
                    }
                }
            }
        });

        let basicFen = this.squeezeEmptySquares(this.board.map(x => x.join('')).join('/'));



        return basicFen;
    }


    this.getFen = () => {
        let basicFen = this.getBasicFen();
        let rights = this.getRights();

        let turn = this.getTurnFromFen(basicFen);

        return `${basicFen} ${turn} ${rights} - 0 1`;
    };

    this.getTurnFromFen = (fen) => {
        const fenTurn = fen.split(' ')[1];
        if (fenTurn) {
            return fenTurn;
        }
        if (last_turn) {
            return last_turn === 'w' ? 'b' : 'w';
        }
        return turn;
    };
}



function InterfaceUtils() {
    this.boardUtils = {
        findSquareElem: (squareCode) => {
            return null;
        },
        markMove: (fromSquare, toSquare, rgba_color) => {
            if (displayMovesOnSite || (!isPlayerTurn && show_opposite_moves)) {
                markMoveToSite(fromSquare, toSquare, rgba_color);
            }
        },
        removeBestMarkings: () => {
            activeGuiMoveHighlights.forEach(elem => {
                elem.style.scale = 1.0;
                elem.style.backgroundColor = "";
            });

            activeGuiMoveHighlights = [];
        },
        updateBoardFen: fen => {
            // No GUI in extension, just log
            console.log('FEN:', fen);
        },
        updateBoardPower: (myScore, enemyScore) => {
            console.log('Score - Me:', myScore, 'Enemy:', enemyScore);
        },
        updateBoardOrientation: orientation => {
            console.log('Orientation:', orientation);
        }
    }

    this.engineLog = str => {
        if (enableEngineLog) {
            console.log('[Engine]', str);
        }
    }

    this.log = str => {
        if (enableUserLog) {
            console.log('[SmartChessBot]', str);
        }
    }

    this.getBoardOrientation = () => {
        if (CURRENT_SITE == CHESS_COM) {
            return document.querySelector('.board.flipped') ? 'b' : 'w';
        } else if (CURRENT_SITE == LICHESS_ORG) {
            return document.querySelector(".orientation-white") !== null ? 'w' : 'b'
        }

    }

    this.updateBestMoveProgress = text => {
        console.log('[Progress]', text);
    }

    this.stopBestMoveProcessingAnimation = () => {
        // No animation in extension
    }

    this.hideBestMoveProgress = () => {
        // No progress bar in extension
    }
}

function LozzaUtility() {
    this.separateMoveCodes = moveCode => {
        moveCode = moveCode.trim();

        let move = moveCode.split(' ')[1];

        return [move.slice(0, 2), move.slice(2, 4)];
    }

    this.extractInfo = str => {

        const keys = ['time', 'nps', 'depth', 'pv'];

        return keys.reduce((acc, key) => {
            let match = str.match(`${key} (\\d+)`);


            if (match) {
                acc[key] = (match[1]);
            }

            return acc;
        }, {});
    }
}

function fenSquareToChessComSquare(fenSquareCode) {
    const [x, y] = fenSquareCode.split('');

    return `square-${['abcdefgh'.indexOf(x) + 1]}${y}`;
}

function markMoveToSite(fromSquare, toSquare, rgba_color) {
    const highlight = (fenSquareCode, style, rgba_color) => {

        let squareClass = highlightElem = existingHighLight = parentElem = null

        if (CURRENT_SITE == CHESS_COM) {
            squareClass = fenSquareToChessComSquare(fenSquareCode);

            highlightElem = document.createElement('div');
            highlightElem.classList.add('custom');
            highlightElem.classList.add('highlight');
            highlightElem.classList.add(squareClass);
            highlightElem.dataset.testElement = 'highlight';
            highlightElem.style = style;
            highlightElem.style.backgroundColor = `rgba(${rgba_color[0]},${rgba_color[1]},${rgba_color[2]},${rgba_color[3]})`;
            highlightElem.style.pointerEvents = 'none';


            activeSiteMoveHighlights.push(highlightElem);



            existingHighLight = document.querySelector(`.highlight.${squareClass}`);


            if (existingHighLight) {
                existingHighLight.remove();
            }

            parentElem = chessBoardElem;

        } else if (CURRENT_SITE == LICHESS_ORG) {
            const flipped = isLichessBoardFlipped();

            const SQUARE_PERCENT = 100 / 8;
            let left_percent, top_percent;

            if (!flipped) {
                left_percent = alphabetPosition(fenSquareCode[0]) * SQUARE_PERCENT;
                top_percent = (8 - Number(fenSquareCode[1])) * SQUARE_PERCENT;
            } else {
                left_percent = (7 - alphabetPosition(fenSquareCode[0])) * SQUARE_PERCENT;
                top_percent = (Number(fenSquareCode[1]) - 1) * SQUARE_PERCENT;
            }

            highlightElem = document.createElement('square');
            highlightElem.classList.add('custom');
            highlightElem.classList.add('highlight');
            highlightElem.dataset.testElement = 'highlight';
            highlightElem.style = style;
            highlightElem.style.backgroundColor = `rgba(${rgba_color[0]},${rgba_color[1]},${rgba_color[2]},${rgba_color[3]})`;
            highlightElem.style.pointerEvents = 'none';

            highlightElem.style.top = `${top_percent}%`;
            highlightElem.style.left = `${left_percent}%`;
            highlightElem.style.zIndex = 1;

            activeSiteMoveHighlights.push(highlightElem);

            parentElem = chessBoardElem.querySelector("cg-container");
        }



        parentElem.prepend(highlightElem);
    }



    highlight(fromSquare, defaultFromSquareStyle, rgba_color);
    highlight(toSquare, defaultToSquareStyle, rgba_color);
}

function removeSiteMoveMarkings() {
    // Remove tracked elements
    activeSiteMoveHighlights.forEach(elem => {
        elem?.remove();
    });
    activeSiteMoveHighlights = [];
    
    // Also clean up any orphaned highlight elements that might have been missed
    document.querySelectorAll('.custom.highlight').forEach(elem => {
        elem.remove();
    });
}

/**
 * Force a complete refresh of highlights - useful when highlights get into a bad state
 * This clears all existing highlights and re-triggers analysis for the current position
 */
function refreshHighlights() {
    // Force clear all existing highlights
    clearBoard(true); // Pass true to force clear
    
    // Reset tracking variables
    lastHighlightedFen = null;
    lastHighlightTime = 0;
    
    // Reset lastFen so updateBestMove thinks position changed
    lastFen = null;
    
    // Re-analyze and re-draw highlights for current position
    updateBestMove(null); // Trigger re-analysis
    
    Interface.log('Highlights refreshed');
}





function updateBestMove(mutationArr) {
    const FenUtil = new FenUtils();
    let currentFen = FenUtil.getFen();


    if (currentFen != lastFen) {
        Interface.log(`Position changed, analyzing new position...`);
        
        lastFen = currentFen;
        
        if (lastHighlightedFen && currentFen !== lastHighlightedFen) {
            clearBoard();
            lastHighlightedFen = null;
        } else if (currentFen === lastHighlightedFen) {
            Interface.log(`Highlights already correct for current position, skipping analysis`);
            return;
        }


        if (mutationArr) {
            let attributeMutationArr

            if (CURRENT_SITE == CHESS_COM) {
                attributeMutationArr = mutationArr.filter(m => m.target.classList.contains('piece') && m.attributeName == 'class');
            } else if (CURRENT_SITE == LICHESS_ORG) {
                attributeMutationArr = mutationArr.filter(m => m.target.tagName == 'PIECE' && !m.target.classList.contains('fading') && m.attributeName == 'class');
            }



            if (attributeMutationArr?.length) {
                const movedPieceColor = FenUtil.getPieceColor(FenUtil.getFenCodeFromPieceElem(attributeMutationArr[0].target));

                last_turn = movedPieceColor;

                turn = movedPieceColor === 'w' ? 'b' : 'w';



                Interface.log(`Turn updated to ${turn}!`);

                updateBoard(false);
                sendBestMove();
            }
        } else {
            updateBoard(false);
            sendBestMove();
        }
    }
}






function sendBestMove() {
    Interface.log(`sendBestMove: isPlayerTurn=${isPlayerTurn}, playerColor=${playerColor}, last_turn=${last_turn}`);
    if (!isPlayerTurn && !show_opposite_moves) {
        Interface.log('Skipping analysis - not player turn');
        return;
    }

    sendBestMoveRequest();
}

function sendBestMoveRequest() {
    // Throttle requests to prevent excessive analysis in fast games
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
        Interface.log('Request throttled - too soon since last request');
        return;
    }
    lastRequestTime = now;
    
    const FenUtil = new FenUtils();
    let currentFen = FenUtil.getFen();
    possible_moves = [];

    lastBestMoveID++;
    const requestId = lastBestMoveID;
    
    Interface.log(`Requesting analysis (request #${requestId})...`);

    reloadChessEngine(false, () => {
        if (use_book_moves) {
            getBookMoves({ id: requestId, fen: currentFen });
        } else {
            getBestMoves({ id: requestId, fen: currentFen });
        }
    });
}




function clearBoard(force = false) {
    // Don't clear highlights if they were just shown, unless forced
    const now = Date.now();
    if (!force && now - lastHighlightTime < MIN_HIGHLIGHT_DISPLAY_MS) {
        Interface.log('Skipping highlight clear - minimum display time not reached');
        return;
    }
    
    // Don't clear if highlights are still valid for current position
    if (!force && lastHighlightedFen) {
        const FenUtil = new FenUtils();
        const currentFen = FenUtil.getFen();
        if (currentFen === lastHighlightedFen) {
            Interface.log('Highlights still valid for current position, skipping clear');
            return;
        }
    }
    
    Interface.log('Clearing board highlights (FEN changed)');
    Interface.stopBestMoveProcessingAnimation();

    Interface.boardUtils.removeBestMarkings();

    removeSiteMoveMarkings();
}
function updateBoard(clear = true) {
    if (clear)
        clearBoard();

    const FenUtil = new FenUtils();
    let currentFen = FenUtil.getFen();

    if (currentFen == ("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") || currentFen == ("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")) {
        enemyScore = 0;
        myScore = 0;
        Interface.boardUtils.updateBoardPower(myScore, enemyScore);
    }

    isPlayerTurn = playerColor == null || last_turn == null || last_turn !== playerColor;
    Interface.log(`Turn calculation: playerColor=${playerColor}, last_turn=${last_turn}, isPlayerTurn=${isPlayerTurn}`);

    Interface.boardUtils.updateBoardFen(currentFen);
}


function removeDuplicates(arr) {
    return arr.filter((item,
        index) => arr.indexOf(item) === index);
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getBestMoves(request) {
    if (CURRENT_SITE === LICHESS_ORG && engineIndex === lichess_cloud_engine_id) {
        getLichessCloudBestMoves(request);
        return;
    }

    if (engineIndex === node_engine_id) {
        getNodeBestMoves(request);
        return;
    }

    if (engineIndex === websocket_engine_id) {
        getWebSocketBestMoves(request);
        return;
    }

    if (WEB_ENGINE_IDS.includes(engineIndex)) {
        // Wait for engine to load with timeout
        const MAX_WAIT_TIME = 5000; // 5 seconds max
        const CHECK_INTERVAL = 100;
        let waitTime = 0;
        
        while (!engine && waitTime < MAX_WAIT_TIME) {
            await sleep(CHECK_INTERVAL);
            waitTime += CHECK_INTERVAL;
        }
        
        if (!engine) {
            Interface.log('Error: Engine failed to load within timeout');
            return;
        }

        const effectiveDepth = bullet_mode ? Math.min(current_depth, bullet_depth) : current_depth;
        const effectiveMovetime = bullet_mode ? bullet_movetime : current_movetime;

        Interface.log(`Using local engine (depth: ${effectiveDepth}, movetime: ${effectiveMovetime})...`);

        engine.postMessage(`position fen ${request.fen}`);

        if (bullet_mode) {
            engine.postMessage('go movetime ' + effectiveMovetime);
        } else if (engineMode == DEPTH_MODE) {
            engine.postMessage('go depth ' + effectiveDepth);
        } else {
            engine.postMessage('go movetime ' + effectiveMovetime);
        }

        let achievedDepth = effectiveDepth;

        engine.onmessage = e => {
            const FenUtil = new FenUtils();
            const currentFen = FenUtil.getFen();
            if (currentFen !== request.fen) {
                Interface.log('Position changed, discarding engine analysis');
                return;
            }
            
            if (lastBestMoveID != request.id) {
                Interface.log('Ignoring stale engine response');
                return;
            }
            if (e.data.includes('bestmove')) {
                let move = e.data.split(' ')[1];
                Interface.log(`Analysis complete: depth ${achievedDepth}, move ${move}`);
                moveResult(move.slice(0, 2), move.slice(2, 4), effectiveDepth, true, achievedDepth);
            } else if (e.data.includes('info')) {
                const infoObj = LozzaUtils.extractInfo(e.data);
                achievedDepth = infoObj.depth || effectiveDepth;
                let move_time = infoObj.time || effectiveMovetime;

                possible_moves = e.data.slice(e.data.lastIndexOf("pv"), e.data.length)
                    .split(" ")
                    .slice(1)
                    .filter((_, index) => index % 2 === 0)
                    .slice(1, max_best_moves);


                if (bullet_mode) {
                    Interface.updateBestMoveProgress(`Bullet: ${move_time} ms`);
                } else if (engineMode == DEPTH_MODE) {
                    Interface.updateBestMoveProgress(`Depth: ${achievedDepth}`);
                } else {
                    Interface.updateBestMoveProgress(`Move time: ${move_time} ms`);
                }
            }
            Interface.engineLog(e.data);
        };
    } else {
        getNodeBestMoves(request);
    }
}




let mutationDebounceTimeout = null;
const MUTATION_DEBOUNCE_MS = 0;

// Track last processed FEN to avoid reacting to DOM noise
let lastProcessedFen = null;

function observeNewMoves() {
    const handleMutation = (mutationArr) => {
        // Early FEN check - only process if position actually changed
        const FenUtil = new FenUtils();
        const currentFen = FenUtil.getFen();
        
        // If FEN hasn't changed, this is just DOM noise (hover, click, drag, animation)
        if (currentFen === lastProcessedFen) {
            return; // Ignore DOM noise
        }
        
        const significantMutations = mutationArr.filter(m => {
            const classList = m.target.classList;
            if (!classList) {
                return true;
            }
            
            if (classList.contains('highlight')) {
                return false;
            }
            if (classList.contains('custom')) {
                return false;
            }
            if (classList.contains('ghost')) {
                return false;
            }
            if (classList.contains('fading')) {
                return false;
            }
            if (classList.contains('dragging')) {
                return false;
            }
            if (m.attributeName === 'style' && m.target.tagName !== 'PIECE' && !classList.contains('piece')) {
                return false;
            }
            return true;
        });

        if (significantMutations.length === 0) {
            return;
        }

        // Update processed FEN before processing
        lastProcessedFen = currentFen;

        if (mutationDebounceTimeout) {
            clearTimeout(mutationDebounceTimeout);
        }

        mutationDebounceTimeout = setTimeout(() => {
            lastPlayerColor = playerColor;

            updatePlayerColor(() => {
                if (playerColor != lastPlayerColor) {
                    Interface.log(`Player color changed from ${lastPlayerColor} to ${playerColor}!`);
                    updateBestMove();
                } else {
                    updateBestMove(significantMutations);
                }
            });
        }, MUTATION_DEBOUNCE_MS);
    };

    const boardObserver = new MutationObserver(handleMutation);
    boardObserver.observe(chessBoardElem, { childList: true, subtree: true, attributes: true });
}



function getRandomColor() {
    return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}


function changeEnginePower(val) {
    if (engineMode == DEPTH_MODE) {
        current_depth = val;
        max_best_moves = Math.floor(current_depth / 2);
        Storage.set(dbValues.current_depth, current_depth);
        Storage.set(dbValues.max_best_moves, max_best_moves);
    } else {
        current_movetime = val;
        Storage.set(dbValues.current_movetime, current_movetime);
    }
}



function reloadChessEngine(forced, callback) {
    if ((node_engine_id == engineIndex || lichess_cloud_engine_id == engineIndex || websocket_engine_id == engineIndex) && forced == false) {
        callback();
    }
    else if (reload_engine == true && reload_count >= reload_every || forced == true) {
        reload_count = 1;
        Interface.log(`Reloading the chess engine!`);

        if (engine) {
            engine.terminate();
            engine = null;  // Clear the reference to prevent stale state
        }
        
        // Clean up WebSocket engine if switching away from it
        if (websocketEngine && engineIndex !== websocket_engine_id) {
            try {
                websocketEngine.close();
            } catch (e) {
                // Ignore close errors
            }
            websocketEngine = null;
            websocketEngineReady = false;
            websocketPendingRequest = null;
        }

        loadChessEngine(callback);
    }
    else {
        reload_count = reload_count + 1;
        callback();
    }
}


function createEngineInSandbox(engineCode, callback) {
    let callbackCalled = false;
    const timeoutId = setTimeout(() => {
        if (!callbackCalled) {
            callbackCalled = true;
            console.error('Engine sandbox initialization timed out');
            callback({
                postMessage: function(msg) {
                    console.warn('Dummy engine: postMessage called with:', msg);
                },
                terminate: function() {
                    console.warn('Dummy engine: terminate called');
                },
                onmessage: null
            });
        }
    }, ENGINE_INITIALIZATION_TIMEOUT);

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox = 'allow-scripts';
    
    const iframeContent = `
        <!DOCTYPE html>
        <html>
        <head><title>Engine Sandbox</title></head>
        <body>
        <script>
            let worker = null;
            
            window.addEventListener('message', function(e) {
                if (e.data.type === 'init') {
                    const blob = new Blob([e.data.engineCode], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    worker = new Worker(url);
                    
                    worker.onmessage = function(workerEvent) {
                        parent.postMessage({ type: 'engine-message', data: workerEvent.data }, '*');
                    };
                    
                    parent.postMessage({ type: 'ready' }, '*');
                } else if (e.data.type === 'command') {
                    if (worker) {
                        worker.postMessage(e.data.command);
                    }
                } else if (e.data.type === 'terminate') {
                    if (worker) {
                        worker.terminate();
                        worker = null;
                    }
                }
            });
        <\/script>
        </body>
        </html>
    `;
    
    iframe.srcdoc = iframeContent;
    document.body.appendChild(iframe);
    
    const proxyEngine = {
        iframe: iframe,
        postMessage: function(msg) {
            iframe.contentWindow.postMessage({ type: 'command', command: msg }, '*');
        },
        terminate: function() {
            iframe.contentWindow.postMessage({ type: 'terminate' }, '*');
            iframe.remove();
            // Always remove the message handler to prevent leaks
            if (this._messageHandler) {
                window.removeEventListener('message', this._messageHandler);
            }
        },
        onmessage: null
    };
    
    const messageHandler = function(e) {
        if (!e.data || typeof e.data.type !== 'string') {
            return;
        }
        
        if (e.source !== iframe.contentWindow) {
            return;
        }
        
        if (e.data.type === 'ready') {
            if (!callbackCalled) {
                callbackCalled = true;
                clearTimeout(timeoutId);
                callback(proxyEngine);
            }
        } else if (e.data.type === 'engine-message' && proxyEngine.onmessage) {
            proxyEngine.onmessage({ data: e.data.data });
        }
    };
    window.addEventListener('message', messageHandler);
    
    proxyEngine._messageHandler = messageHandler;
    proxyEngine._cleanup = function() {
        window.removeEventListener('message', this._messageHandler);
    };
    
    iframe.onload = function() {
        iframe.contentWindow.postMessage({ type: 'init', engineCode: engineCode }, '*');
    };
    
    return proxyEngine;
}

async function loadEngineCode(engineName) {
    try {
        const engineUrl = chrome.runtime.getURL(`content/${engineName}`);
        const response = await fetch(engineUrl);
        return await response.text();
    } catch (error) {
        console.error(`Failed to load engine ${engineName}:`, error);
        return null;
    }
}

async function loadChessEngine(callback) {
    // Use iframe sandbox for ALL sites with web engines (fixes CSP issues on both Lichess and Chess.com)
    if (WEB_ENGINE_IDS.includes(engineIndex)) {
        try {
            let engineName;
            if (engineIndex == 0) engineName = 'lozza.js';
            else if (engineIndex == 1) engineName = 'stockfish-5.js';
            else if (engineIndex == 2) engineName = 'stockfish-2018.js';
            
            const engineCode = await loadEngineCode(engineName);
            if (!engineCode) {
                Interface.log('Error loading engine code');
                callback();
                return;
            }
            
            createEngineInSandbox(engineCode, function(proxyEngine) {
                engine = proxyEngine;
                engine.postMessage('ucinewgame');
                Interface.log('Loaded chess engine in sandbox!');
                callback();
            });
        } catch (e) {
            console.error('Failed to create engine sandbox:', e);
            Interface.log('Error loading engine: ' + e.message);
            callback();
        }
        return;
    }
    
    if (engineIndex == lichess_cloud_engine_id || engineIndex == node_engine_id) {
        return callback();
    }

    if (engineIndex == websocket_engine_id) {
        Interface.log('Initializing WebSocket engine...');
        connectWebSocketEngine();
        return callback();
    }

    if (!engineObjectURL) {
        try {
            let engineName;
            if (engineIndex == 0) engineName = 'lozza.js';
            else if (engineIndex == 1) engineName = 'stockfish-5.js';
            else if (engineIndex == 2) engineName = 'stockfish-2018.js';
            
            const engineCode = await loadEngineCode(engineName);
            if (engineCode) {
                engineObjectURL = URL.createObjectURL(new Blob([engineCode], { type: 'application/javascript' }));
            }
        } catch (e) {
            console.error('Failed to load engine:', e);
        }
    }

    if (engineObjectURL) {
        engine = new Worker(engineObjectURL);

        engine.postMessage('ucinewgame');

        Interface.log(`Loaded the chess engine!`);
    }

    callback();
}



function updatePlayerColor(callback) {
    const boardOrientation = Interface.getBoardOrientation();

    if (boardOrientation) {
        playerColor = boardOrientation;
        turn = boardOrientation;

        Interface.boardUtils.updateBoardOrientation(playerColor);
    } else {
        playerColor = lastPlayerColor || 'w';
        turn = playerColor;
    }

    callback();
}

function initialize() {
    Interface = new InterfaceUtils();
    LozzaUtils = new LozzaUtility();

    const boardOrientation = Interface.getBoardOrientation();
    turn = boardOrientation;

    initializeDatabase(() => {
        loadChessEngine(() => {
            updatePlayerColor(() => {
                Interface.log('Smart Chess Bot initialized!');
                observeNewMoves();
            });
        });
    });
}








async function initializeDatabase(callback) {
    const storedNightMode = await Storage.get(dbValues.nightMode);

    if (storedNightMode === undefined) {
        await Storage.set(dbValues.nightMode, nightMode);
        await Storage.set(dbValues.engineMode, engineMode);
        await Storage.set(dbValues.engineIndex, engineIndex);
        await Storage.set(dbValues.reload_engine, reload_engine);
        await Storage.set(dbValues.reload_every, reload_every);
        await Storage.set(dbValues.enableUserLog, enableUserLog);
        await Storage.set(dbValues.enableEngineLog, enableEngineLog);
        await Storage.set(dbValues.displayMovesOnSite, displayMovesOnSite);
        await Storage.set(dbValues.show_opposite_moves, show_opposite_moves);
        await Storage.set(dbValues.use_book_moves, use_book_moves);
        await Storage.set(dbValues.node_engine_url, node_engine_url);
        await Storage.set(dbValues.node_engine_name, node_engine_name);
        await Storage.set(dbValues.websocket_engine_url, websocket_engine_url);
        await Storage.set(dbValues.websocket_engine_type, websocket_engine_type);
        await Storage.set(dbValues.websocket_engine_version, websocket_engine_version);
        await Storage.set(dbValues.current_depth, current_depth);
        await Storage.set(dbValues.current_movetime, current_movetime);
        await Storage.set(dbValues.max_best_moves, max_best_moves);
        await Storage.set(dbValues.bestMoveColors, bestMoveColors);
        await Storage.set(dbValues.bullet_mode, bullet_mode);
        await Storage.set(dbValues.bullet_depth, bullet_depth);
        await Storage.set(dbValues.bullet_movetime, bullet_movetime);

        // Initialize colors
        bestMoveColors = Array.from({ length: max_best_moves }, () => getRandomColor());
        await Storage.set(dbValues.bestMoveColors, bestMoveColors);

        callback();
    } else {
        nightMode = await Storage.get(dbValues.nightMode);
        engineMode = await Storage.get(dbValues.engineMode);
        engineIndex = await Storage.get(dbValues.engineIndex);
        reload_engine = await Storage.get(dbValues.reload_engine);
        reload_every = await Storage.get(dbValues.reload_every);
        enableUserLog = await Storage.get(dbValues.enableUserLog);
        enableEngineLog = await Storage.get(dbValues.enableEngineLog);
        displayMovesOnSite = await Storage.get(dbValues.displayMovesOnSite);
        show_opposite_moves = await Storage.get(dbValues.show_opposite_moves);
        use_book_moves = await Storage.get(dbValues.use_book_moves);
        node_engine_url = await Storage.get(dbValues.node_engine_url);
        node_engine_name = await Storage.get(dbValues.node_engine_name);
        
        // Load WebSocket settings with defaults
        const storedWsUrl = await Storage.get(dbValues.websocket_engine_url);
        const storedWsType = await Storage.get(dbValues.websocket_engine_type);
        const storedWsVersion = await Storage.get(dbValues.websocket_engine_version);
        
        websocket_engine_url = storedWsUrl !== undefined ? storedWsUrl : websocket_engine_url;
        websocket_engine_type = storedWsType !== undefined ? storedWsType : websocket_engine_type;
        websocket_engine_version = storedWsVersion !== undefined ? storedWsVersion : websocket_engine_version;
        
        current_depth = await Storage.get(dbValues.current_depth);
        current_movetime = await Storage.get(dbValues.current_movetime);
        max_best_moves = await Storage.get(dbValues.max_best_moves);
        bestMoveColors = await Storage.get(dbValues.bestMoveColors);
        
        const storedBulletMode = await Storage.get(dbValues.bullet_mode);
        const storedBulletDepth = await Storage.get(dbValues.bullet_depth);
        const storedBulletMovetime = await Storage.get(dbValues.bullet_movetime);
        
        bullet_mode = storedBulletMode !== undefined ? storedBulletMode : bullet_mode;
        bullet_depth = storedBulletDepth !== undefined ? storedBulletDepth : bullet_depth;
        bullet_movetime = storedBulletMovetime !== undefined ? storedBulletMovetime : bullet_movetime;

        // Ensure colors are initialized
        if (!bestMoveColors || bestMoveColors.length === 0) {
            bestMoveColors = Array.from({ length: max_best_moves }, () => getRandomColor());
            await Storage.set(dbValues.bestMoveColors, bestMoveColors);
        }

        callback();
    }
}
