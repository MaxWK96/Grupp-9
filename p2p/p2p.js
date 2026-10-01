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

  async broadcast(message, sendToSelf = false) {
    const listeners = await this.getListeners();
    const recipients = listeners.filter((url) => url !== this.me || sendToSelf);
    const results = await Promise.allSettled(recipients.map(async (url) => {
      const response = await fetch(url + 'api/p2p/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(response.statusText || `HTTP ${response.status}`);
      }
    }));

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error sending message to ${recipients[index]}:`, result.reason);
      }
    });
  }

  async getLongestChain() {
    const listeners = await this.getListeners();
    const chains = await Promise.all(listeners
      .filter((url) => url !== this.me)
      .map(async (url) => {
        try {
          const response = await fetch(`${url}api/chain/raw`);
          if (!response.ok) {
            console.error(`Failed to fetch chain from ${url}: ${response.statusText}`);
            return [];
          }
          return await response.json();
        } catch (error) {
          console.error(`Error fetching chain from ${url}:`, error);
          return [];
        }
      }));

    return chains.reduce((longestChain, chain) => (
      chain.length > longestChain.length ? chain : longestChain
    ), []);
  }
}

const p2p = new P2P();
module.exports = p2p;