const express = require('express');
const router = express.Router();
const web3Service = require('../services/web3.service');

// Asumiendo un entorno real, importaríamos el modelo User de MongoDB
// const User = require('../models/User');

router.post('/referral/claim', async (req, res) => {
    try {
        const { newUserId, referralCode } = req.body;
        console.log(`[GAMIFICATION] User ${newUserId} claiming referral code ${referralCode}`);
        
        // Lógica DB simulada: 
        // 1. Buscar usuario con ese referralCode
        // 2. Desbloquear 'cyberpunk' u otro estilo al usuario dueño del código
        
        res.json({ success: true, message: 'Referral claimed! Inviter unlocked Cyberpunk style.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/styles/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Lógica DB simulada: Buscar usuario y retornar sus estilos desbloqueados
        const unlockedStyles = ['simpsonize', 'cyberpunk']; // Simulación
        res.json({ success: true, unlockedStyles });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/nft/mint', async (req, res) => {
    try {
        const { walletAddress, imageIPFSUrl, userId } = req.body;
        
        if (!walletAddress || !imageIPFSUrl) {
            return res.status(400).json({ success: false, error: 'Wallet and IPFS URL required' });
        }

        const txHash = await web3Service.mintAvatarNFT(walletAddress, imageIPFSUrl);
        
        // Lógica DB: Guardar txHash en nftsOwned del usuario
        
        res.json({ success: true, message: 'NFT Minted Successfully', txHash });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
