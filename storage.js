// Storage utility to replace GM_getValue/GM_setValue
const Storage = {
  async get(key, defaultValue = undefined) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  },
  
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },
  
  async getAll(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      // Handle both string and array inputs
      const keys = Array.isArray(key) ? key : [key];
      chrome.storage.local.remove(keys, resolve);
    });
  },

  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
};
