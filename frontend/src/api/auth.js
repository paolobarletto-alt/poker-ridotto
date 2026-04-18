import api from './client';

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  register: (data) =>
    api.post('/api/auth/register', data),

  me: () =>
    api.get('/api/auth/me'),
};
