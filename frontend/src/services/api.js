import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const loanService = {
  getAllLoans: () => api.get('/loans'),
  getLoanById: (id) => api.get(`/loans/${id}`),
  getInterestSchedule: (loanId, months = 12) => 
    api.get(`/interests/schedule/${loanId}?months=${months}`),
};

export const cashflowService = {
  getMonthlyCashflow: (months = 12) => 
    api.get(`/cashflow/monthly?months=${months}`),
};

export const reminderService = {
  getReminders: () => api.get('/reminders'),
  getInvestorReminders: (days = 30) => api.get(`/reminders/investors?days=${days}`),
  markInvestorPaymentStatus: (reminderKey, isPaid, isIgnored, userNote = '') => 
    api.post('/reminders/investors/mark-status', { reminderKey, isPaid, isIgnored, userNote }),
};

export default api;