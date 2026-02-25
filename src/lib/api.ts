import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Helper to set profile ID in headers for all requests
export const setProfileId = (profileId: string) => {
    api.defaults.headers.common['x-profile-id'] = profileId;
};

export const dashboardApi = {
    getStats: () => api.get('/dashboard/stats'),
    getAttribution: () => api.get('/dashboard/attribution'),
    getGrowth: () => api.get('/dashboard/growth'),
    getChart: () => api.get('/dashboard/chart'),
};

export const integrationApi = {
    getStatus: () => api.get('/integrations/status'),
};

export const dataApi = {
    getTransactions: () => api.get('/data/transactions'),
    getCustomers: () => api.get('/data/customers'),
};

export const aiApi = {
    chat: (message: string) => api.post('/ai/chat', { message }),
};

export default api;
