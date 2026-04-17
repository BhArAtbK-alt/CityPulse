import axios from "axios";
const api = axios.create({ baseURL: "/api", timeout: 30000 });
api.interceptors.request.use(config => {
  const token = localStorage.getItem("cp_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(r => r.data, e => Promise.reject(new Error(e.response?.data?.error || e.message)));
export default api;
export const authApi = {
  register:       d => api.post("/auth/register", d),
  adminRegister:  d => api.post("/auth/admin/register", d),
  login:          d => api.post("/auth/login", d), // d will now contain {username, password}
  me:             () => api.get("/auth/me"),
  forgotPassword: d => api.post("/auth/forgot-password", d),
  resetPassword:  d => api.post("/auth/reset-password", d),
};
export const reportsApi = {
  getFeed:        p  => api.get("/reports", { params: p }),
  getMap:         () => api.get("/reports/map"),
  getById:        id => api.get(`/reports/${id}`),
  create:         fd => api.post("/reports", fd, { headers: { "Content-Type": "multipart/form-data" } }),
  vote:      (id, type) => api.post(`/reports/${id}/vote`, { type }),
  comment:   (id, content) => api.post(`/reports/${id}/comments`, { content }),

  getLeaderboard: () => api.get("/reports/leaderboard"),
  getUserReports: uid => api.get(`/reports/user/${uid}`),
  getSettings:    () => api.get("/reports/settings"),
  delete:         id => api.delete(`/reports/${id}`),
};
export const adminApi = {
  getSettings:        () => api.get("/admin/settings"),
  saveSettings:       d  => api.put("/admin/settings", d),
  getAvailableAreas:  () => api.get("/admin/available-areas"),
  getNeighboringAreas:() => api.get("/admin/neighboring-areas"),
  requestArea:        d  => api.post("/admin/request-area", d),
  getReports:         p  => api.get("/admin/reports", { params: p }),
  getMap:             p  => api.get("/admin/map", { params: p }),
  updateStatus:   (id, status) => api.patch(`/admin/reports/${id}/status`, { status }),
  resolve:        (id, fd) => api.patch(`/admin/reports/${id}/resolve`, fd, { headers: { "Content-Type": "multipart/form-data" } }),
  delay:          (id, d) => api.patch(`/admin/reports/${id}/delay`, d),
  getEscalations:     () => api.get("/admin/escalations"),
  createEscalation:   d  => api.post("/admin/escalations", d),
  updateEscalation: (id, d) => api.patch(`/admin/escalations/${id}`, d),
  getStats:           () => api.get("/admin/stats"),
  getActivity:        p  => api.get("/admin/activity", { params: p }),
};
export const superAdminApi = {
  getStats:       () => api.get("/superadmin/stats"),
  getAreas:       () => api.get("/superadmin/areas"),
  createArea:     d  => api.post("/superadmin/areas", d),
  updateArea:     (id, d) => api.put(`/superadmin/areas/${id}`, d),
  confirmArea:    id => api.patch(`/superadmin/areas/${id}/confirm`),
  getOfficials:   () => api.get("/superadmin/officials"),
  getCitizens:    p  => api.get("/superadmin/citizens", { params: p }),
  getMap:         p  => api.get("/superadmin/map", { params: p }),
  getActivity:    p  => api.get("/superadmin/activity", { params: p }),
  getEscalations: p  => api.get("/superadmin/escalations", { params: p }),
  getGlobalFeed:  p  => api.get("/superadmin/global-feed", { params: p }),
  getOrphanedZones: () => api.get("/superadmin/orphaned-zones"),
  forceAssign:    (id, area_id) => api.patch(`/superadmin/reports/${id}/assign`, { area_id }),
  resolveEscalation: (id, d) => api.patch(`/superadmin/escalations/${id}`, d),
  updateUserRole: (id, role) => api.patch(`/superadmin/users/${id}/role`, { role }),
  toggleLegalHold: (id, is_legal_hold) => api.patch(`/superadmin/reports/${id}/legal-hold`, { is_legal_hold }),
};
