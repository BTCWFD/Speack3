const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini.service');

router.post('/simpsonize', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        
        if (!imageBase64) {
            return res.status(400).json({ success: false, error: 'Image is required' });
        }

        // Llamada al servicio de Gemini AI (Imagen 3)
        const generatedImages = await geminiService.generateSimpsonAvatar(imageBase64);
        
        res.json({
            success: true,
            message: 'Images generated successfully via Gemini API',
            data: {
                images: generatedImages
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
