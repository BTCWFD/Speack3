import axios from 'axios';
import { API_URL, API_TIMEOUT } from '../config/api';
import StorageService from './StorageService';

class ApiService {
    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            timeout: API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Request interceptor - add auth token
        this.client.interceptors.request.use(
            async (config) => {
                const token = await StorageService.getAuthToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor - handle errors
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401) {
                    // Token expired - try refresh
                    const refreshed = await this.refreshToken();
                    if (refreshed) {
                        // Retry original request
                        return this.client(error.config);
                    }
                    // Logout user
                    await StorageService.clearAuth();
                }
                return Promise.reject(error);
            }
        );
    }

    // Auth endpoints
    async register(userData) {
        try {
            const response = await this.client.post('/api/auth/register', userData);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async login(email, password) {
        try {
            const response = await this.client.post('/api/auth/login', { email, password });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async refreshToken() {
        try {
            const refreshToken = await StorageService.getRefreshToken();
            if (!refreshToken) return false;

            const response = await this.client.post('/api/auth/refresh', { refreshToken });
            await StorageService.saveAuthToken(response.data.token);
            return true;
        } catch (error) {
            return false;
        }
    }

    async logout() {
        try {
            await this.client.post('/api/auth/logout');
            await StorageService.clearAuth();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async getCurrentUser() {
        try {
            const response = await this.client.get('/api/auth/me');
            return response.data.user;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // User endpoints
    async getUsers() {
        try {
            const response = await this.client.get('/api/users');
            return response.data.users;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getUserById(userId) {
        try {
            const response = await this.client.get(`/api/users/${userId}`);
            return response.data.user;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getUserPreKeys(userId) {
        try {
            const response = await this.client.get(`/api/users/${userId}/prekeys`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async uploadPreKeys(preKeys) {
        try {
            const response = await this.client.post('/api/users/prekeys', { preKeys });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Profile photo (base64 data URI)
    async updateAvatar(avatar) {
        try {
            const response = await this.client.put('/api/users/me/avatar', { avatar });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Group endpoints
    async createGroup(groupData) {
        try {
            const response = await this.client.post('/api/groups', groupData);
            return response.data.group;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getGroups() {
        try {
            const response = await this.client.get('/api/groups');
            return response.data.groups;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getGroupById(groupId) {
        try {
            const response = await this.client.get(`/api/groups/${groupId}`);
            return response.data.group;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async addGroupMembers(groupId, members) {
        try {
            const response = await this.client.put(`/api/groups/${groupId}/members`, { members });
            return response.data.group;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async removeGroupMember(groupId, memberId) {
        try {
            const response = await this.client.delete(`/api/groups/${groupId}/members/${memberId}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async deleteGroup(groupId) {
        try {
            const response = await this.client.delete(`/api/groups/${groupId}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Message endpoints
    async getDirectMessages(userId, limit = 50, skip = 0) {
        try {
            const response = await this.client.get(`/api/messages/direct/${userId}`, {
                params: { limit, skip }
            });
            return response.data.messages;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getGroupMessages(groupId, limit = 50, skip = 0) {
        try {
            const response = await this.client.get(`/api/messages/group/${groupId}`, {
                params: { limit, skip }
            });
            return response.data.messages;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async markMessageAsRead(messageId) {
        try {
            const response = await this.client.put(`/api/messages/${messageId}/read`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Error handling
    handleError(error) {
        if (error.response) {
            // Server responded with error
            return new Error(error.response.data.error || 'Server error');
        } else if (error.request) {
            // No response received
            return new Error('No server response. Check connection.');
        } else {
            return new Error(error.message || 'Unknown error');
        }
    }
}

const apiService = new ApiService();

export default apiService;
