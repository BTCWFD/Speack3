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
                    // Refresh failed: the session is gone for good. Clearing
                    // storage alone would leave AuthContext still holding
                    // isAuthenticated=true, so the app would keep rendering the
                    // logged-in screens with stale data while every request 401s.
                    // Notify the context so it can reset and show the login screen.
                    await StorageService.clearAuth();
                    this.onAuthFailure?.();
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

    // Shop endpoints
    async getProducts(all = false) {
        try {
            const response = await this.client.get('/api/products', { params: all ? { all: '1' } : {} });
            return response.data.products;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async createProduct(product) {
        try {
            const response = await this.client.post('/api/products', product);
            return response.data.product;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async updateProduct(productId, update) {
        try {
            const response = await this.client.put(`/api/products/${productId}`, update);
            return response.data.product;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async createOrder(order) {
        try {
            const response = await this.client.post('/api/orders', order);
            return response.data.order;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getMyOrders() {
        try {
            const response = await this.client.get('/api/orders/mine');
            return response.data.orders;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getAllOrders() {
        try {
            const response = await this.client.get('/api/orders');
            return response.data.orders;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async updateOrderStatus(orderId, status, confirmedDeliveryTime) {
        try {
            const response = await this.client.patch(`/api/orders/${orderId}/status`, {
                status,
                ...(confirmedDeliveryTime ? { confirmedDeliveryTime } : {})
            });
            return response.data.order;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async payOrder(orderId, method, extra = {}) {
        try {
            const response = await this.client.post(`/api/orders/${orderId}/pay`, { method, ...extra });
            return response.data.order;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async confirmOrderPayment(orderId, paid) {
        try {
            const response = await this.client.patch(`/api/orders/${orderId}/confirm-payment`, { paid });
            return response.data.order;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Vuelve a pedir lo mismo de un pedido anterior. El servidor recalcula
    // precios y domicilio, asi que el total puede diferir del pedido original.
    async repeatOrder(orderId, requestedDeliveryTime) {
        try {
            const response = await this.client.post(`/api/orders/${orderId}/repeat`, {
                requestedDeliveryTime
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Avisos
    async getNotifications({ unreadOnly = false, limit = 50 } = {}) {
        try {
            const response = await this.client.get('/api/notifications', {
                params: { ...(unreadOnly ? { unread: '1' } : {}), limit }
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async markNotificationRead(id) {
        try {
            const response = await this.client.patch(`/api/notifications/${id}/read`);
            return response.data.notification;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async markAllNotificationsRead() {
        try {
            const response = await this.client.post('/api/notifications/read-all');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Domicilios
    async getDeliveryConfig() {
        try {
            const response = await this.client.get('/api/delivery/config');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async quoteDelivery(lat, lng) {
        try {
            const response = await this.client.post('/api/delivery/quote', { lat, lng });
            return response.data.quote;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async setDeliveryOrigin(lat, lng, address) {
        try {
            const response = await this.client.put('/api/delivery/origin', { lat, lng, address });
            return response.data.location;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Franjas de entrega
    async getSlotAvailability(days = 14) {
        try {
            const response = await this.client.get('/api/slots/availability', { params: { days } });
            return response.data.availability;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getSlots() {
        try {
            const response = await this.client.get('/api/slots');
            return response.data.slots;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async createSlot(slot) {
        try {
            const response = await this.client.post('/api/slots', slot);
            return response.data.slot;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async deleteSlot(slotId) {
        try {
            await this.client.delete(`/api/slots/${slotId}`);
            return true;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Datos de cobro del vendedor
    async getMyPayoutMethods() {
        try {
            const response = await this.client.get('/api/payout-methods/mine');
            return response.data.payout;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async setMyPayoutMethods(payout) {
        try {
            const response = await this.client.put('/api/payout-methods/mine', payout);
            return response.data.payout;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // A donde debe pagar el comprador de un pedido concreto.
    async getPayoutForOrder(orderId) {
        try {
            const response = await this.client.get(`/api/payout-methods/for-order/${orderId}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Vendedores (solo admin)
    async getSellers() {
        try {
            const response = await this.client.get('/api/sellers');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getSellerServices() {
        try {
            const response = await this.client.get('/api/sellers/services');
            return response.data.services;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async addSeller(email, services) {
        try {
            const response = await this.client.post('/api/sellers', { email, services });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async updateSeller(sellerId, update) {
        try {
            const response = await this.client.patch(`/api/sellers/${sellerId}`, update);
            return response.data.seller;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async removeSeller(sellerId) {
        try {
            await this.client.delete(`/api/sellers/${sellerId}`);
            return true;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Estado de la tienda / disponibilidad del vendedor
    async getShopStatus() {
        try {
            const response = await this.client.get('/api/shop/status');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async setShopOpen(open) {
        try {
            const response = await this.client.put('/api/shop/open', { open });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async setMyAvailability(available) {
        try {
            const response = await this.client.put('/api/shop/availability', { available });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async cancelOrder(orderId, reason) {
        try {
            const response = await this.client.post(`/api/orders/${orderId}/cancel`, { reason });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Aportes voluntarios
    async getDonationInfo() {
        try {
            const response = await this.client.get('/api/donations/info');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async reportDonation(amountCOP, method, extra = {}) {
        try {
            const response = await this.client.post('/api/donations', {
                amountCOP, method, ...extra
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getAllDonations() {
        try {
            const response = await this.client.get('/api/donations');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async updateDonationStatus(donationId, status) {
        try {
            const response = await this.client.patch(`/api/donations/${donationId}`, { status });
            return response.data.donation;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Documentos legales
    async getLegalDocuments() {
        try {
            const response = await this.client.get('/api/legal');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getLegalDocument(id) {
        try {
            const response = await this.client.get(`/api/legal/${id}`);
            return response.data.document;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async acceptLegal(accept) {
        try {
            const response = await this.client.post('/api/legal/accept', { accept });
            return response.data.legalAccepted;
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
