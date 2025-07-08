const { logger } = require("firebase-functions");
const { default: axios } = require('axios');

class LINEClient {
    constructor(db) {
        this.db = db;
        this.axios = axios.create({
            baseURL: 'https://api.line.me/v2/bot',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        this.axios.interceptors.request.use(async (config) => {
            const accessToken = await this.getAccessToken();
            config.headers['Authorization'] = `Bearer ${accessToken}`;
            return config;
        });

        // Centralized error handler
        this.handleError = (error, context) => {
            const errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            logger.error(`Error in ${context}:`, errorMessage);
            throw new Error(`LINE API Error in ${context}: ${errorMessage}`);
        };
    }

    async getAccessToken() {
        // In a real app, you might get this from a secure source or configuration
        // For Firebase Functions with secrets, process.env.LINE_ACCESS_TOKEN is used.
        return process.env.LINE_ACCESS_TOKEN;
    }

    // Rich Menu API methods
    async getRichMenuList() {
        try {
            const response = await this.axios.get('/richmenu/list');
            return response.data.richmenus;
        } catch (error) {
            this.handleError(error, 'getRichMenuList');
        }
    }

    async createRichMenu(richMenuObject) {
         try {
            const response = await this.axios.post('/richmenu', richMenuObject);
            return response.data.richMenuId;
        } catch (error) {
            this.handleError(error, 'createRichMenu');
        }
    }
    
    async uploadRichMenuImage(richMenuId, imageBase64, contentType) {
        try {
            // Convert base64 string to a Buffer, which axios can handle as binary data.
            const imageBuffer = Buffer.from(imageBase64, 'base64');
            const accessToken = await this.getAccessToken();
            
            // Use the data-specific endpoint, not the default baseURL from the axios instance.
            await axios.post(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, imageBuffer, {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': contentType,
                    'Content-Length': imageBuffer.length
                }
            });
        } catch (error) {
            this.handleError(error, 'uploadRichMenuImage');
        }
    }

    async downloadRichMenuImage(richMenuId) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await axios.get(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                responseType: 'arraybuffer' // Get binary data as an ArrayBuffer
            });
            // Convert the binary data to a Base64 string to send to the client
            return Buffer.from(response.data, 'binary').toString('base64');
        } catch (error) {
            if (error.response?.status === 404) {
                logger.warn(`No image found for rich menu ${richMenuId}.`);
                return null; // Return null if no image is found, not an error.
            }
            this.handleError(error, 'downloadRichMenuImage');
        }
    }
    
    async deleteRichMenu(richMenuId) {
        try {
            await this.axios.delete(`/richmenu/${richMenuId}`);
        } catch (error) {
            if (error.response?.status !== 404) {
                 this.handleError(error, 'deleteRichMenu');
            }
            logger.warn(`Attempted to delete non-existent rich menu ${richMenuId}. Ignoring.`);
        }
    }

    async setDefaultRichMenu(richMenuId) {
        try {
            await this.axios.post(`/user/all/richmenu/${richMenuId}`);
        } catch (error) {
            this.handleError(error, 'setDefaultRichMenu');
        }
    }
    
    async getRichMenu(richMenuId) {
        try {
            const response = await this.axios.get(`/richmenu/${richMenuId}`);
            return response.data;
        } catch (error) {
            this.handleError(error, 'getRichMenu');
        }
    }
    
    async linkRichMenuToUser(userId, richMenuId) {
        try {
            await this.axios.post(`/user/${userId}/richmenu/${richMenuId}`);
        } catch (error) {
            this.handleError(error, 'linkRichMenuToUser');
        }
    }
    
    async unlinkRichMenuFromUser(userId) {
        try {
            await this.axios.delete(`/user/${userId}/richmenu`);
        } catch (error) {
             this.handleError(error, 'unlinkRichMenuFromUser');
        }
    }
}

module.exports = { LINEClient }; 