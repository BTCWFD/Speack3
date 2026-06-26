const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');
const prompts = require('../config/prompts.json');

class GeminiService {
    constructor() {
        // Inicializamos el SDK asumiendo que GEMINI_API_KEY está en el entorno
        this.ai = new GoogleGenAI({ apiKey: env.GEMINI.API_KEY });
    }

    async generateSimpsonAvatar(imageBase64, userContext = 'atuendo y expresión facial actual') {
        console.log('[GEMINI] Requesting image generation from Google AI...');
        
        // Cargar y compilar el prompt probado desde el repositorio de configuración
        const rawPrompt = prompts.simpsonize.dynamicTemplate;
        const prompt = rawPrompt.replace('{{base}}', prompts.simpsonize.base)
                                .replace('{{style}}', prompts.simpsonize.style)
                                .replace('{{quality}}', prompts.simpsonize.quality)
                                .replace('{{userContext}}', userContext);
        
        console.log('[GEMINI] Using prompt:', prompt);

        try {
            // Actualmente Imagen 3 se accede a través del SDK para generar imágenes
            // Nota: Este es un esqueleto de la llamada. 
            // La API de generación de imágenes exacta puede variar según la disponibilidad del modelo 'imagen-3.0-generate-001'.
            /*
            const response = await this.ai.models.generateImages({
                model: 'imagen-3.0-generate-001',
                prompt: prompt,
                number_of_images: 2,
                output_mime_type: 'image/png',
            });
            */
            
            // Simulación de la respuesta exitosa para no gastar cuota si no hay key real:
            const mockResponse = [
                '/assets/simpsons/usuario_simpsons_final_display.md', // mock
                '/assets/simpsons/usuario_simpsons_moody_hair_display.md' // mock
            ];

            return mockResponse; // En producción: return response.generatedImages.map(img => img.image.imageBytes);

        } catch (error) {
            console.error('[GEMINI] Error generating image:', error);
            throw new Error('Failed to generate Simpson avatar');
        }
    }
}

module.exports = new GeminiService();
