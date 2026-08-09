import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userEmail');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Log in via IMAP and receive a JWT.
 */
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('userEmail', data.user.email);
  return data;
}

/**
 * Log out — invalidate the server-side session.
 */
export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // Best-effort — clear local state regardless
  }
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
}

/**
 * Fetch the inbox for the authenticated user.
 */
export async function fetchInbox() {
  const { data } = await api.get('/emails/inbox');
  return data.messages;
}

/**
 * Send an email. `to` is the username portion (e.g. "jane").
 */
export async function sendEmail(to, subject, body) {
  const { data } = await api.post('/emails/send', { to, subject, body });
  return data;
}

export default api;