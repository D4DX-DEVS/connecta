import API from './api';

// Auth APIs
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
};

// Booth APIs
export const boothAPI = {
  getAll: (params) => API.get('/booths', { params }),
  getById: (id) => API.get(`/booths/${id}`),
  create: (data) => API.post('/booths', data),
  update: (id, data) => API.put(`/booths/${id}`, data),
  delete: (id) => API.delete(`/booths/${id}`),
  toggleBookmark: (id) => API.post(`/booths/${id}/bookmark`),
  markAsVisited: (id) => API.post(`/booths/${id}/visit`),
  uploadMedia: (formData) => API.post('/booths/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// Quiz APIs
export const quizAPI = {
  getQuestions: () => API.get('/quiz/questions'),
  getAllQuestions: (params) => API.get('/quiz/admin/questions', { params }),
  submitQuiz: (data) => API.post('/quiz/submit', data),
  getLeaderboard: (date) => API.get('/quiz/leaderboard', { params: { date } }),
  getHistory: () => API.get('/quiz/history'),
  createQuestion: (data) => API.post('/quiz/questions', data),
  getQuestionsByBooth: (boothId) => API.get(`/quiz/booth/${boothId}/questions`),
  updateQuestion: (id, data) => API.put(`/quiz/questions/${id}`, data),
  deleteQuestion: (id) => API.delete(`/quiz/questions/${id}`),
};

// Quiz Config APIs
export const quizConfigAPI = {
  getActive: () => API.get('/quiz-config/active'),
  getAll: () => API.get('/quiz-config'),
  create: (data) => API.post('/quiz-config', data),
  update: (id, data) => API.put(`/quiz-config/${id}`, data),
  delete: (id) => API.delete(`/quiz-config/${id}`),
  publishResults: (id) => API.post(`/quiz-config/${id}/publish`),
};

// Feedback APIs
export const feedbackAPI = {
  submit: (data) => API.post('/feedback', data),
  getAll: (params) => API.get('/feedback', { params }),
  getStats: (params) => API.get('/feedback/stats', { params }),
  updateStatus: (id, data) => API.put(`/feedback/${id}`, data),
  delete: (id) => API.delete(`/feedback/${id}`),
  getMyFeedback: () => API.get('/feedback/my-feedback'),
};

// Notification APIs
export const notificationAPI = {
  getAll: () => API.get('/notifications'),
  getById: (id) => API.get(`/notifications/${id}`),
  markAsRead: (id) => API.post(`/notifications/${id}/read`),
  getUnreadCount: () => API.get('/notifications/unread/count'),
  create: (data) => API.post('/notifications', data),
  update: (id, data) => API.put(`/notifications/${id}`, data),
  delete: (id) => API.delete(`/notifications/${id}`),
  getAllAdmin: () => API.get('/notifications/admin/all'),
};

// Program APIs
export const programAPI = {
  getAll: (params) => API.get('/programs', { params }),
  getToday: () => API.get('/programs/today'),
  getById: (id) => API.get(`/programs/${id}`),
  getAllAdmin: () => API.get('/programs/admin/all'),
  create: (data) => API.post('/programs', data),
  update: (id, data) => API.put(`/programs/${id}`, data),
  delete: (id) => API.delete(`/programs/${id}`),
};

// Gallery APIs
export const galleryAPI = {
  getAll: () => API.get('/gallery'),
  getAllAdmin: () => API.get('/gallery/admin/all'),
  getById: (id) => API.get(`/gallery/${id}`),
  create: (data) => API.post('/gallery', data),
  update: (id, data) => API.put(`/gallery/${id}`, data),
  delete: (id) => API.delete(`/gallery/${id}`),
  uploadImages: (formData) => API.post('/gallery/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// User/Admin APIs
export const userAPI = {
  getAll: (params) => API.get('/users', { params }),
  getAdminOverview: () => API.get('/users/admin/overview'),
};

export default API;
