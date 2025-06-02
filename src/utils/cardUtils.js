const fetch = require('node-fetch');

/**
 * Generates a card image using the pixelateimage.org API
 * @param {string} cardName - The name of the card to generate an image for
 * @returns {Promise<string>} The URL of the generated image
 * @throws {Error} If the API request fails or no image URL is returned
 */
async function generateCardImage(cardName) {
    try {
        const response = await fetch('https://pixelateimage.org/api/coze-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: cardName + " with no text in image",
                aspectRatio: "1:1",
                pixelStyle: "Fantasy Pixel Art",
                colorPalette: "Vibrant",
                lightingStyle: "Dynamic Shadows",
                compositionStyle: "Bird's Eye View"
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.imageUrl) {
            throw new Error('No image URL in response');
        }

        return data.imageUrl;
    } catch (error) {
        console.error('Error generating card image:', error);
        throw error;
    }
}

module.exports = {
    generateCardImage
}; 