import axios from 'axios';
import type { MaterialAsset } from '@/types';

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
  uploadFile: (file: File, teamId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (teamId !== undefined) {
      formData.append('teamId', String(teamId));
    }
    // 不要手动设置 Content-Type，让 axios 自动设置 boundary
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getRemoteFileUrl: (fileId: string) => api.get(`/files/remote/${fileId}/url`),
  getMaterials: (params?: { keyword?: string; teamId?: number; limit?: number; sourceType?: 'upload' | 'generated'; taskId?: number; workflowRunId?: number }) =>
    api.get<{ success: boolean; data: MaterialAsset[] }>('/materials', { params }),
  markMaterialUsed: (id: number) => api.post(`/materials/${id}/use`),

  // 创建单图任务
  createSingleTask: (functionType: string, inputData: Record<string, unknown>, teamId?: number) =>
    api.post('/tasks/single', { functionType, inputData, teamId }),

  // 创建批量任务
  createBatchTask: (functionType: string, items: Array<{ inputData: Record<string, unknown> }>, teamId?: number) =>
    api.post('/tasks/batch', { functionType, items, teamId }),

  // 获取任务详情
  getTask: (id: number) => api.get(`/tasks/${id}`),
  refreshTaskResultUrl: (id: number) => api.post(`/tasks/${id}/refresh-result-url`),
  retryTask: (id: number, inputData?: Record<string, unknown>) => api.post(`/tasks/${id}/retry`, { inputData }),
  retryWorkflowStep: (runId: number, body: { itemIndex: number; stepKey: string; inputData?: Record<string, unknown> }) =>
    api.post(`/workflows/runs/${runId}/retry-step`, body),

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
  updateWorkflow: (id: number, payload: { name: string; description?: string; steps: Array<{ key: string; name: string; functionType: string; inputTemplate: Record<string, unknown> }> }) =>
    api.put(`/workflows/${id}`, payload),
  runWorkflow: (id: number, payload: { items: Array<Record<string, unknown>>; concurrency?: number; teamId?: number; dryRun?: boolean }) =>
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

  setTeamTotalBudget: (teamId: number, amount: number) =>
    api.put(`/budget/team/${teamId}/total`, { amount }),

  allocateBudget: (teamId: number, userId: number, amount: number) =>
    api.post('/budget/allocate', { userId, amount, teamId }),

  // 交易流水
  getTransactions: (params?: { teamId?: number; type?: string; limit?: number; offset?: number }) =>
    api.get('/transactions', { params }),
};
