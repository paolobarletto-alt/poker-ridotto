import api from './client';

export const tablesApi = {
  list: () =>
    api.get('/api/tables'),

  get: (id) =>
    api.get(`/api/tables/${id}`),

  join: (id, data) =>
    api.post(`/api/tables/${id}/join`, data),

  leave: (id) =>
    api.post(`/api/tables/${id}/leave`),
};
