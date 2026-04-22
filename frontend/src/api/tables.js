import api from './client';

export const tablesApi = {
  list: () =>
    api.get('/tables'),

  get: (id) =>
    api.get(`/tables/${id}`),

  createTable: (data) =>
    api.post('/tables', data),

  listSitGos: () =>
    api.get('/sitgo'),

  getSitGo: (id) =>
    api.get(`/sitgo/${id}`),

  createSitGo: (data) =>
    api.post('/sitgo', data),

  registerSitGo: (id) =>
    api.post(`/sitgo/${id}/register`),

  unregisterSitGo: (id) =>
    api.delete(`/sitgo/${id}/register`),


  getCurrentSeat: () =>
    api.get('/users/me/current-seat'),

  getOnlineUsers: () =>
    api.get('/users/online'),

  join: (id, data) =>
    api.post(`/tables/${id}/join`, data),

  leave: (id) =>
    api.post(`/tables/${id}/leave`),
};
