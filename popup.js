// Popup logic and settings management

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.local.get([
    'bullet_mode',
    'displayMovesOnSite',
    'engineIndex',
    'node_engine_url',
    'node_engine_name',
    'websocket_engine_url',
    'websocket_engine_type',
    'websocket_engine_version'
  ]);

  // Set checkbox states
  document.getElementById('bullet-mode').checked = settings.bullet_mode || false;
  document.getElementById('display-moves').checked = settings.displayMovesOnSite || false;
  
  // Set engine selection
  const engineSelect = document.getElementById('engine-select');
  engineSelect.value = settings.engineIndex !== undefined ? settings.engineIndex : 0;
  
  // Set node server settings
  document.getElementById('node-url').value = settings.node_engine_url || 'http://localhost:5000';
  document.getElementById('node-engine').value = settings.node_engine_name || 'stockfish-15'; // Platform-agnostic
  
  // Set WebSocket settings
  const wsEngineType = settings.websocket_engine_type || 'stockfish';
  document.getElementById('ws-engine-type').value = wsEngineType;
  
  // Show/hide settings based on engine selection
  toggleEngineSettings(parseInt(engineSelect.value));
  updateWebSocketVersionSelector(wsEngineType, settings.websocket_engine_version || '16');
  
  // Event listeners
  document.getElementById('bullet-mode').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ bullet_mode: e.target.checked });
    sendMessageToContentScript({ action: 'updateSetting', key: 'bullet_mode', value: e.target.checked });
  });
  
  document.getElementById('display-moves').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ displayMovesOnSite: e.target.checked });
    sendMessageToContentScript({ action: 'updateSetting', key: 'displayMovesOnSite', value: e.target.checked });
  });
  
  engineSelect.addEventListener('change', async (e) => {
    const value = parseInt(e.target.value);
    await chrome.storage.local.set({ engineIndex: value });
    toggleEngineSettings(value);
    sendMessageToContentScript({ action: 'updateSetting', key: 'engineIndex', value: value });
  });
  
  document.getElementById('node-url').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ node_engine_url: e.target.value });
    sendMessageToContentScript({ action: 'updateSetting', key: 'node_engine_url', value: e.target.value });
  });
  
  document.getElementById('node-engine').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ node_engine_name: e.target.value });
    sendMessageToContentScript({ action: 'updateSetting', key: 'node_engine_name', value: e.target.value });
  });
  
  document.getElementById('ws-engine-type').addEventListener('change', async (e) => {
    const type = e.target.value;
    await chrome.storage.local.set({ websocket_engine_type: type });
    
    // Set default version based on type
    let defaultVersion = '16';
    if (type === 'maia') defaultVersion = '1500';
    else if (type === 'rodent3') defaultVersion = 'anand';
    else if (type === 'patricia') defaultVersion = '2250';
    
    updateWebSocketVersionSelector(type, defaultVersion);
    await chrome.storage.local.set({ websocket_engine_version: defaultVersion });
    sendMessageToContentScript({ action: 'updateSetting', key: 'websocket_engine_type', value: type });
    sendMessageToContentScript({ action: 'updateSetting', key: 'websocket_engine_version', value: defaultVersion });
  });
  
  document.getElementById('open-gui').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
  
  document.getElementById('get-best-move').addEventListener('click', () => {
    sendMessageToContentScript({ action: 'getBestMove' });
    updateStatus('Analyzing...');
  });
  
  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'statusUpdate') {
      updateStatus(request.status);
    } else if (request.type === 'analysisComplete') {
      updateStatus(`Best: ${request.move}`, 'success');
    }
  });
});

function toggleEngineSettings(engineIndex) {
  const nodeSettings = document.getElementById('node-settings');
  const websocketSettings = document.getElementById('websocket-settings');
  
  nodeSettings.style.display = engineIndex === 3 ? 'block' : 'none';
  websocketSettings.style.display = engineIndex === 5 ? 'block' : 'none';
}

function updateWebSocketVersionSelector(engineType, currentVersion) {
  const container = document.getElementById('ws-version-container');
  container.innerHTML = ''; // Clear existing content
  
  const label = document.createElement('label');
  
  if (engineType === 'stockfish') {
    label.innerHTML = 'Version: ';
    const select = document.createElement('select');
    select.id = 'ws-engine-version';
    // Available Stockfish versions on bettermint-sockets server (4 and 15 not available)
    const versions = ['1', '2', '3', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '16'];
    versions.forEach(v => {
      const option = document.createElement('option');
      option.value = v;
      option.textContent = v;
      if (v === currentVersion) option.selected = true;
      select.appendChild(option);
    });
    label.appendChild(select);
    
    select.addEventListener('change', async (e) => {
      await chrome.storage.local.set({ websocket_engine_version: e.target.value });
      sendMessageToContentScript({ action: 'updateSetting', key: 'websocket_engine_version', value: e.target.value });
    });
  } else if (engineType === 'maia') {
    label.innerHTML = 'Elo Rating: ';
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'ws-engine-version';
    input.min = '1100';
    input.max = '1900';
    input.step = '100';
    input.value = currentVersion || '1500';
    label.appendChild(input);
    
    input.addEventListener('change', async (e) => {
      const numValue = parseInt(e.target.value);
      let value = isNaN(numValue) ? 1500 : Math.max(1100, Math.min(1900, numValue));
      e.target.value = value;
      await chrome.storage.local.set({ websocket_engine_version: value.toString() });
      sendMessageToContentScript({ action: 'updateSetting', key: 'websocket_engine_version', value: value.toString() });
    });
  } else if (engineType === 'rodent3') {
    label.innerHTML = 'Personality: ';
    const select = document.createElement('select');
    select.id = 'ws-engine-version';
    const personalities = ['anand', 'anderssen', 'botvinnik', 'fischer', 'larsen', 'marshall', 
                          'nimzowitsch', 'petrosian', 'reti', 'rubinstein', 'spassky', 'steinitz', 
                          'tarrasch', 'drunk', 'henny', 'kinghunter', 'remy', 'tortoise'];
    personalities.forEach(p => {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = p.charAt(0).toUpperCase() + p.slice(1);
      if (p === currentVersion) option.selected = true;
      select.appendChild(option);
    });
    label.appendChild(select);
    
    select.addEventListener('change', async (e) => {
      await chrome.storage.local.set({ websocket_engine_version: e.target.value });
      sendMessageToContentScript({ action: 'updateSetting', key: 'websocket_engine_version', value: e.target.value });
    });
  } else if (engineType === 'patricia') {
    label.innerHTML = 'Elo Rating: ';
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'ws-engine-version';
    input.min = '1100';
    input.max = '3200';
    input.step = '50';
    input.value = currentVersion || '2250';
    label.appendChild(input);
    
    input.addEventListener('change', async (e) => {
      const numValue = parseInt(e.target.value);
      let value = isNaN(numValue) ? 2250 : Math.max(1100, Math.min(3200, numValue));
      e.target.value = value;
      await chrome.storage.local.set({ websocket_engine_version: value.toString() });
      sendMessageToContentScript({ action: 'updateSetting', key: 'websocket_engine_version', value: value.toString() });
    });
  }
  
  container.appendChild(label);
}

function updateStatus(text, className = '') {
  const statusElem = document.getElementById('status');
  statusElem.textContent = text;
  // Reset classes and apply new class if provided
  statusElem.className = 'status';
  if (className) {
    statusElem.classList.add(className);
  }
}

async function sendMessageToContentScript(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, message);
    }
  } catch (error) {
    console.error('Failed to send message to content script:', error);
  }
}
