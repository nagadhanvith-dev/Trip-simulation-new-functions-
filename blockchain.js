/* ==========================================
   TRIPPAY CHAIN — CRYPTOGRAPHIC LEDGER ENGINE
   Client-Side SHA-256 Blockchain & Validation
   ========================================== */

/**
 * Helper function to calculate SHA-256 of a string using Web Crypto API.
 * Returns a Promise that resolves to the hex representation of the hash.
 * @param {string} message 
 * @returns {Promise<string>}
 */
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a mock ECDSA digital signature for a given user and payload.
 * In a real blockchain, this would sign a hash with the user's private key.
 * @param {string} username 
 * @param {object} payload 
 * @returns {string}
 */
function generateMockSignature(username, payload) {
    const serialized = JSON.stringify(payload);
    // Simple deterministic string scrambling to look like a real signature
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
        hash = (hash << 5) - hash + serialized.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    const hexHash = Math.abs(hash).toString(16).padEnd(8, 'e');
    const userPrefix = username.toLowerCase().substring(0, 3);
    return `SIG_secp256k1_0x${userPrefix}${hexHash}d71ce2a9b3f${serialized.length}d`;
}

/**
 * Represents a single Block in the TripPay Chain.
 */
class Block {
    /**
     * @param {number} index 
     * @param {string} timestamp 
     * @param {object} data - Payload: transaction details, proposer, votes, etc.
     * @param {string} previousHash 
     */
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.nonce = 0;
        this.hash = '';
        this.signature = data.signature || ''; // Proposer's signature
    }

    /**
     * Calculates the SHA-256 hash of the block based on its contents.
     * @returns {Promise<string>}
     */
    async calculateHash() {
        // Stringify data to ensure immutability is checked on the payload itself
        const dataStr = JSON.stringify(this.data);
        const input = this.index + this.previousHash + this.timestamp + dataStr + this.nonce;
        return await sha256(input);
    }

    /**
     * Simulates block mining (Proof of Work) by finding a hash starting with zero(s).
     * This adds a realistic latency and "securing block" visualization in the UI.
     * @param {number} difficulty 
     */
    async mineBlock(difficulty) {
        const target = Array(difficulty + 1).join("0");
        this.hash = await this.calculateHash();
        
        // Loop to find a matching hash
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = await this.calculateHash();
            
            // Safety break in case of browser locking (difficulty is kept low e.g., 1 or 2)
            if (this.nonce > 10000) {
                break;
            }
        }
        console.log(`Block #${this.index} mined with nonce ${this.nonce}: ${this.hash}`);
    }
}

/**
 * Manages the chain of Blocks, ledger validation, and persistence.
 */
class Blockchain {
    constructor() {
        this.chain = [];
        this.difficulty = 1; // Kept at 1 for fast client-side responsive mining
    }

    /**
     * Initializes the chain with a Genesis Block if it is empty.
     */
    async initialize() {
        if (this.chain.length === 0) {
            await this.createGenesisBlock();
        }
    }

    /**
     * Creates and mines the first block on the ledger.
     */
    async createGenesisBlock() {
        const genesisData = {
            type: "GENESIS",
            description: "TripPay Chain Vault Initialized. Goa Trip 2026 Pool Setup.",
            amount: 0,
            actor: "System",
            signature: "GENESIS_SIG_0x000000000000"
        };
        const genesisBlock = new Block(0, new Date().toLocaleString(), genesisData, "0");
        await genesisBlock.mineBlock(this.difficulty);
        this.chain.push(genesisBlock);
    }

    /**
     * Returns the latest block appended to the chain.
     * @returns {Block}
     */
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Cryptographically mines and appends a new block to the ledger.
     * @param {Block} newBlock 
     */
    async addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        await newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
    }

    /**
     * Cryptographically validates the entire ledger.
     * Re-calculates hashes and checks links to verify that no data has been tampered with.
     * @returns {Promise<{isValid: boolean, errorIndex: number, reason: string}>}
     */
    async isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // 1. Recalculate hash of current block
            const recalculatedHash = await currentBlock.calculateHash();
            if (currentBlock.hash !== recalculatedHash) {
                return {
                    isValid: false,
                    errorIndex: i,
                    reason: `Block #${i} data was tampered! Recalculated hash does not match stored hash. Stored: ${currentBlock.hash.substring(0, 10)}... Recalculated: ${recalculatedHash.substring(0,10)}...`
                };
            }

            // 2. Verify link to previous block
            if (currentBlock.previousHash !== previousBlock.hash) {
                return {
                    isValid: false,
                    errorIndex: i,
                    reason: `Cryptographic link broken between Block #${i-1} and Block #${i}! Previous hash: ${currentBlock.previousHash.substring(0, 10)}... Actual previous block hash: ${previousBlock.hash.substring(0, 10)}...`
                };
            }
        }
        return { isValid: true, errorIndex: -1, reason: "Ledger integrity validated. All blocks healthy." };
    }

    /**
     * Reconstructs a Blockchain instance from localStorage serialized data.
     * Restores the Block methods (like calculateHash) on plain JSON objects.
     * @param {Array<object>} jsonChain 
     * @returns {Blockchain}
     */
    static fromJSON(jsonChain) {
        const blockchain = new Blockchain();
        blockchain.chain = jsonChain.map(b => {
            const blockInstance = new Block(b.index, b.timestamp, b.data, b.previousHash);
            blockInstance.nonce = b.nonce;
            blockInstance.hash = b.hash;
            blockInstance.signature = b.signature;
            return blockInstance;
        });
        return blockchain;
    }
}

// Make classes accessible globally
window.sha256 = sha256;
window.generateMockSignature = generateMockSignature;
window.Block = Block;
window.Blockchain = Blockchain;
