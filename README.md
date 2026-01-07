# Smart Chess Bot - Chrome Extension

A Chrome extension version of the Smart Chess Bot for analyzing chess positions on Chess.com and Lichess.org.

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension icon should appear in your toolbar

## Usage

1. Go to chess.com or lichess.org
2. Start a game
3. Click the extension icon to access settings
4. The bot will automatically analyze positions

## Features

- **Multiple Engines**: Choose from Lozza, Stockfish 5, Stockfish 2018, or connect to a Node Server
- **Bullet Mode**: Ultra-fast analysis for bullet/blitz games
- **Display Moves**: Option to show suggested moves directly on the board
- **Node Server Support**: Connect to a local chess engine server for stronger analysis

## Quick Settings (via Popup)

- **Bullet Mode**: Enable for fast games (reduces analysis depth for quicker responses)
- **Display Moves**: Toggle to show/hide move suggestions on the board
- **Engine Selection**: Switch between different chess engines
- **Node Server Configuration**: Set URL and engine name for node server

## Engine Files

The engine files (lozza.js, stockfish-5.js, stockfish-2018.js) are placeholders and need to be replaced with the actual engine code.

Download the engine files from:
- [Lozza](https://raw.githubusercontent.com/sayfpack13/chess-analysis-bot/main/tampermonkey%20script/content/lozza.js)
- [Stockfish 5](https://raw.githubusercontent.com/sayfpack13/chess-analysis-bot/main/tampermonkey%20script/content/stockfish-5.js)
- [Stockfish 2018](https://raw.githubusercontent.com/sayfpack13/chess-analysis-bot/main/tampermonkey%20script/content/stockfish-2018.js)
- [Chessboard.js](https://raw.githubusercontent.com/sayfpack13/chess-analysis-bot/main/tampermonkey%20script/content/chessboard.js)

## Node Server

To use the Node Server engine option:

1. Navigate to the repository root
2. Install dependencies: `npm install`
3. Start the server: `node chess-engine.js`
4. Select "Node Server" in the extension popup
5. Configure the server URL (default: http://localhost:5000)

## Note

This extension is for educational purposes only. Use responsibly.

## Directory Structure

```
chrome-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── content.js             # Main script (converted from smart-chess.js)
├── background.js          # Service worker for background tasks
├── popup.html             # Extension popup UI for settings
├── popup.js               # Popup logic and settings management
├── popup.css              # Popup styles
├── storage.js             # Storage utility (replaces GM_getValue/GM_setValue)
├── styles/
│   └── chessboard.css     # Chessboard styles
├── content/
│   ├── chessboard.js      # Chessboard library
│   ├── lozza.js           # Lozza engine
│   ├── stockfish-5.js     # Stockfish 5 engine
│   └── stockfish-2018.js  # Stockfish 2018 engine
├── icons/
│   ├── icon16.png         # 16x16 icon
│   ├── icon48.png         # 48x48 icon
│   └── icon128.png        # 128x128 icon
└── README.md              # This file
```

## License

See the main repository for license information.
