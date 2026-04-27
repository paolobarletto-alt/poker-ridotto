import api from './client';

export const tablesApi = {
  list: () =>
    api.get('/tables'),

  get: (id) =>
    api.get(`/tables/${id}`),

  createTable: (data) =>
    api.post('/tables', data),

  deleteTable: (id) =>
    api.delete(`/tables/${id}`),

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

  adminListCashTables: () =>
    api.get('/admin/tables/cash'),

  adminSetCashTableVisibility: (id, isVisibleInLobby) =>
    api.patch(`/admin/tables/cash/${id}/visibility`, { is_visible_in_lobby: isVisibleInLobby }),

  adminListSitGos: () =>
    api.get('/admin/tables/sitgo'),

  adminSetSitGoVisibility: (id, isVisibleInLobby) =>
    api.patch(`/admin/tables/sitgo/${id}/visibility`, { is_visible_in_lobby: isVisibleInLobby }),


  getCurrentSeat: () =>
    api.get('/users/me/current-seat'),

  getOnlineUsers: () =>
    api.get('/users/online'),

  join: (id, data) =>
    api.post(`/tables/${id}/join`, data),

  leave: (id) =>
    api.post(`/tables/${id}/leave`),
};
