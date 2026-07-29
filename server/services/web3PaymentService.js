const { ethers } = require('ethers');

// Real on-chain verification (not a simulation): given a tx hash the buyer
// submits after paying, confirms it actually succeeded on the configured
// chain. Nequi/Bre-B have no equivalent here yet — there's no public API to
// call, so those stay manual-confirmation-by-the-seller in api/orders.js.
class Web3PaymentService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env.RPC_URL || 'https://rpc-amoy.polygon.technology'
        );
    }

    async verifyTransaction(txHash) {
        const receipt = await this.provider.getTransactionReceipt(txHash);
        return receipt !== null && receipt.status === 1;
    }
}

module.exports = new Web3PaymentService();
