const { ethers } = require('ethers');

class Web3Service {
    constructor() {
        // Initialize provider (could be Infura, Alchemy, or a local node)
        // Using a generic RPC URL for structure
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://cloudflare-eth.com');
    }

    /**
     * Verifies if a transaction was successful on the network
     * @param {string} txHash - The transaction hash to verify
     * @returns {Promise<boolean>} - True if transaction was successful
     */
    async verifyTransaction(txHash) {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);
            // receipt.status === 1 means success
            return receipt !== null && receipt.status === 1;
        } catch (error) {
            console.error('Error verifying transaction:', error);
            return false;
        }
    }

    /**
     * Verifies a cryptographic signature
     * @param {string} message - The original message
     * @param {string} signature - The signature to verify
     * @param {string} expectedAddress - The expected signer's address
     * @returns {boolean} - True if signature is valid
     */
    verifySignature(message, signature, expectedAddress) {
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
        } catch (error) {
            console.error('Error verifying signature:', error);
            return false;
        }
    }
}

module.exports = new Web3Service();
