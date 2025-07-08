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
    
    async uploadRichMenuImage(richMenuId, imageBuffer, contentType) {
        try {
            await this.axios.post(`/richmenu/${richMenuId}/content`, imageBuffer, {
                headers: { 'Content-Type': contentType }
            });
        } catch (error) {
            this.handleError(error, 'uploadRichMenuImage');
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