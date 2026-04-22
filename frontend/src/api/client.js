import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// Attach JWT from localStorage on every request (safe access)
api.interceptors.request.use((config) => {
  let token = null;
  try {
    token = localStorage.getItem('ridotto_token');
  } catch (e) {
    // localStorage not available (private mode or opaque origin)
    token = null;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try { localStorage.removeItem('ridotto_token'); } catch (e) {}
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
