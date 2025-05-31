const sharp = require('sharp');

// Constants for image processing
const CARD_HEIGHT = 300; // Height of each card in pixels
const PADDING = 20; // Padding between cards in pixels
const BACKGROUND_COLOR = { r: 54, g: 57, b: 63, alpha: 1 }; // Discord dark theme color

/**
 * Creates a placeholder image for cards without an image URL
 * @param {boolean} isSpecial - Whether this is a special card
 * @returns {Promise<Buffer>} Buffer containing the placeholder image
 */
async function createPlaceholderImage(isSpecial = false) {
    const baseColor = { r: 255, g: 255, b: 255, alpha: 1 }; // White background
    const color = isSpecial ? { r: 0, g: 0, b: 0, alpha: 1 } : baseColor; // Black for special cards

    return sharp({
        create: {
            width: CARD_HEIGHT * 0.7, // Maintain card-like aspect ratio
            height: CARD_HEIGHT,
            channels: 4,
            background: color
        }
    })
    .png()
    .toBuffer();
}

/**
 * Processes a single card image, resizing it to the standard height
 * @param {string} imageUrl - URL of the card image
 * @param {boolean} isSpecial - Whether this is a special card
 * @returns {Promise<Buffer>} Buffer containing the processed image
 */
async function processCardImage(imageUrl, isSpecial = false) {
    try {
        if (!imageUrl) {
            return createPlaceholderImage(isSpecial);
        }

        // Fetch and process the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.warn(`Failed to fetch image from ${imageUrl}`);
            return createPlaceholderImage(isSpecial);
        }

        const imageBuffer = await response.arrayBuffer();
        let image = sharp(Buffer.from(imageBuffer))
            .resize({ height: CARD_HEIGHT, fit: 'contain' });

        // Invert colors for special cards
        if (isSpecial) {
            image = image.negate();
        }

        return image.png().toBuffer();
    } catch (error) {
        console.error(`Error processing image ${imageUrl}:`, error);
        return createPlaceholderImage(isSpecial);
    }
}

/**
 * Creates a combined image of multiple cards for pack opening
 * @param {Array<{url: string, isSpecial: boolean}>} cardData - Array of card data objects containing URL and special status
 * @returns {Promise<Buffer>} Buffer containing the combined image
 */
async function createPackImage(cardData) {
    try {
        // Process all card images in parallel
        const cardImages = await Promise.all(
            cardData.map(data => processCardImage(data.url, data.isSpecial))
        );

        // Get dimensions of each processed image
        const cardDimensions = await Promise.all(
            cardImages.map(buffer => 
                sharp(buffer).metadata()
            )
        );

        // Calculate total width and max height
        const totalWidth = cardDimensions.reduce((sum, dim) => sum + dim.width, 0) 
            + (cardDimensions.length - 1) * PADDING 
            + PADDING * 2; // Add padding on both ends
        const maxHeight = Math.max(...cardDimensions.map(dim => dim.height)) 
            + PADDING * 2; // Add padding on top and bottom

        // Create blank canvas with padding
        const canvas = sharp({
            create: {
                width: totalWidth,
                height: maxHeight,
                channels: 4,
                background: BACKGROUND_COLOR
            }
        });

        // Composite images horizontally with padding
        const composite = cardImages.map((buffer, i) => ({
            input: buffer,
            left: PADDING + (i === 0 ? 0 : 
                cardDimensions.slice(0, i)
                    .reduce((sum, dim) => sum + dim.width + PADDING, 0)),
            top: PADDING
        }));

        // Generate final image
        return canvas
            .composite(composite)
            .png()
            .toBuffer();
    } catch (error) {
        console.error('Error creating pack image:', error);
        throw error;
    }
}

module.exports = {
    createPackImage,
    processCardImage,
    createPlaceholderImage
}; 