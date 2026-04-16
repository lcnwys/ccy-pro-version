import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器，自动添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const apiClient = {
  // 功能列表
  getFunctions: () => api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/functions'),

  // 文件上传
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 创建单图任务
  createSingleTask: (functionType: string, inputData: Record<string, unknown>, teamId?: number) =>
    api.post('/tasks/single', { functionType, inputData, teamId }),

  // 创建批量任务
  createBatchTask: (functionType: string, items: Array<{ inputData: Record<string, unknown> }>, teamId?: number) =>
    api.post('/tasks/batch', { functionType, items, teamId }),

  // 获取任务详情
  getTask: (id: number) => api.get(`/tasks/${id}`),

  // 获取批量进度
  getBatchProgress: (batchId: string) => api.get(`/tasks/${batchId}/progress`),

  // 获取任务列表
  getTasks: (params?: { status?: string; functionType?: string; page?: number; limit?: number; scope?: string; teamId?: number; keyword?: string; workflowId?: number; workflowRunId?: number; workflowStepKey?: string }) =>
    api.get('/tasks', { params }),

  // Workflow
  getWorkflows: () => api.get('/workflows'),
  getWorkflow: (id: number) => api.get(`/workflows/${id}`),
  createWorkflow: (payload: { name: string; description?: string; teamId?: number; steps: Array<{ key: string; name: string; functionType: string; inputTemplate: Record<string, unknown> }> }) =>
    api.post('/workflows', payload),
  runWorkflow: (id: number, payload: { items: Array<Record<string, unknown>>; concurrency?: number; teamId?: number }) =>
    api.post(`/workflows/${id}/run`, payload),
  getWorkflowRuns: (params?: { workflowId?: number }) => api.get('/workflows/runs', { params }),
  getWorkflowRun: (id: number) => api.get(`/workflows/runs/${id}`),

  // 认证相关
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (email: string, password: string, teamName: string, nickname?: string) =>
    api.post('/auth/register', { email, password, teamName, nickname }),

  getMe: () =>
    api.get('/auth/me'),

  // 团队相关
  getTeams: () =>
    api.get('/teams'),

  getTeam: (id: number) =>
    api.get(`/teams/${id}`),

  getTeamMembers: (teamId: number) =>
    api.get(`/teams/${teamId}/members`),

  removeTeamMember: (teamId: number, userId: number) =>
    api.delete(`/teams/${teamId}/members/${userId}`),

  // 预算相关
  getTeamBudget: (teamId: number) =>
    api.get(`/budget/team/${teamId}`),

  getUserBudget: (teamId: number) =>
    api.get(`/budget/user/${teamId}`),

  rechargeBudget: (teamId: number, amount: number) =>
    api.post('/budget/recharge', { teamId, amount }),

  allocateBudget: (teamId: number, userId: number, amount: number) =>
    api.post('/budget/allocate', { userId, amount, teamId }),

  // 交易流水
  getTransactions: (params?: { teamId?: number; type?: string; limit?: number; offset?: number }) =>
    api.get('/transactions', { params }),
};
