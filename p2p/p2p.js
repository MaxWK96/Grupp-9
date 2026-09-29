const fs = require('node:fs/promises');

class P2P {
  constructor() {
    this.fileName = 'listeners.dat';            
  }

  async getListeners() {
    try {
      const contents = await fs.readFile(this.fileName, 'utf8');
      return contents.split(/\r?\n/);        
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async registerListener(url) {
    const listeners = await this.getListeners();
    const normalizedUrl = new URL(url).href;
    this.me = normalizedUrl; 

    if (!listeners.includes(normalizedUrl)) {
      listeners.push(normalizedUrl);
      await fs.writeFile(this.fileName, listeners.join('\n'), 'utf8');
    }
  }

  async  broadcast (message, sendToSelf = false) {
    const listeners = await this.getListeners();
    listeners.forEach(async (url) => {
      if(url !== this.me || sendToSelf) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
          });

          if (!response.ok) {
            console.error(`Failed to send message to ${url}: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`Error sending message to ${url}:`, error);
        }
      }
    }); 
  }
}

module.exports = P2P;