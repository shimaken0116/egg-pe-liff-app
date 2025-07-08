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
            logger.error('Error fetching rich menu list:', error.response?.data || error.message);
            throw new Error('Failed to fetch rich menu list from LINE API.');
        }
    }

    async createRichMenu(richMenuObject) {
         try {
            const response = await this.axios.post('/richmenu', richMenuObject);
            return response.data.richMenuId;
        } catch (error) {
            logger.error('Error creating rich menu:', error.response?.data || error.message);
            throw new Error('Failed to create rich menu with LINE API.');
        }
    }
    
    async uploadRichMenuImage(richMenuId, imageBuffer, contentType) {
        try {
            await this.axios.post(`/richmenu/${richMenuId}/content`, imageBuffer, {
                headers: { 'Content-Type': contentType }
            });
        } catch (error) {
            logger.error('Error uploading rich menu image:', error.response?.data || error.message);
            throw new Error('Failed to upload rich menu image to LINE API.');
        }
    }
    
    async deleteRichMenu(richMenuId) {
        try {
            await this.axios.delete(`/richmenu/${richMenuId}`);
        } catch (error)
        {
            logger.error(`Error deleting rich menu ${richMenuId}:`, error.response?.data || error.message);
            // Don't throw an error if it's already deleted (404)
            if (error.response?.status !== 404) {
                 throw new Error(`Failed to delete rich menu ${richMenuId} from LINE API.`);
            }
        }
    }

    async setDefaultRichMenu(richMenuId) {
        try {
            await this.axios.post(`/user/all/richmenu/${richMenuId}`);
        } catch (error) {
            logger.error(`Error setting default rich menu to ${richMenuId}:`, error.response?.data || error.message);
            throw new Error('Failed to set default rich menu via LINE API.');
        }
    }
    
    async linkRichMenuToUser(userId, richMenuId) {
        try {
            await this.axios.post(`/user/${userId}/richmenu/${richMenuId}`);
        } catch (error) {
            logger.error(`Failed to link rich menu ${richMenuId} to user ${userId}`, error.response?.data || error.message);
            throw new Error('Failed to link rich menu to user.');
        }
    }
    
    async unlinkRichMenuFromUser(userId) {
        try {
            await this.axios.delete(`/user/${userId}/richmenu`);
        } catch (error) {
             logger.error(`Failed to unlink rich menu from user ${userId}`, error.response?.data || error.message);
             throw new Error('Failed to unlink rich menu from user.');
        }
    }
}

module.exports = { LINEClient }; 