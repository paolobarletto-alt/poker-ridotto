import api from './client';

export const tablesApi = {
  list: () =>
    api.get('/tables'),

  get: (id) =>
    api.get(`/tables/${id}`),

  createTable: (data) =>
    api.post('/tables', data),



  getCurrentSeat: () =>
    api.get('/users/me/current-seat'),

  getOnlineUsers: () =>
    api.get('/users/online'),

  join: (id, data) =>
    api.post(`/tables/${id}/join`, data),

  leave: (id) =>
    api.post(`/tables/${id}/leave`),
};
