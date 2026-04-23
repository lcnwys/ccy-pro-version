import { Router } from 'express';
import { fileController } from '../controllers/fileController.js';
import { taskController } from '../controllers/taskController.js';
import { authController } from '../controllers/authController.js';
import { teamController } from '../controllers/teamController.js';
import { budgetController } from '../controllers/budgetController.js';
import { platformController } from '../controllers/platformController.js';
import { workflowController } from '../controllers/workflowController.js';
import { materialController } from '../controllers/materialController.js';
import { requireAuth, requireSuperAdmin } from '../middlewares/auth.js';

export const apiRouter = Router();

// 文件相关
apiRouter.post('/files/upload', requireAuth, fileController.upload, fileController.handleUpload);
apiRouter.get('/files/download/:filename', fileController.download);
apiRouter.get('/files/remote/:fileId/url', requireAuth, fileController.getRemoteFileUrl);
apiRouter.get('/materials', requireAuth, materialController.list);
apiRouter.post('/materials/:id/use', requireAuth, materialController.markUsed);

// 任务相关
apiRouter.post('/tasks/single', requireAuth, taskController.createSingle);
apiRouter.post('/tasks/batch', requireAuth, taskController.createBatch);
apiRouter.get('/tasks', requireAuth, taskController.getList);
apiRouter.get('/tasks/:id', requireAuth, taskController.getById);
apiRouter.post('/tasks/:id/refresh-result-url', requireAuth, taskController.refreshResultUrl);
apiRouter.post('/tasks/:id/retry', requireAuth, taskController.retryTask);
apiRouter.post('/tasks/batch-refresh-urls', requireAuth, taskController.batchRefreshResultUrls);
apiRouter.get('/tasks/:batchId/progress', requireAuth, taskController.getBatchProgress);

// 工作流相关
apiRouter.get('/workflows', requireAuth, workflowController.list);
apiRouter.post('/workflows', requireAuth, workflowController.create);
apiRouter.put('/workflows/:id', requireAuth, workflowController.update);
apiRouter.get('/workflows/runs', requireAuth, workflowController.listRuns);
apiRouter.get('/workflows/runs/aggregated', requireAuth, workflowController.listRunsAggregated);
apiRouter.get('/workflows/runs/:id', requireAuth, workflowController.getRunById);
apiRouter.post('/workflows/runs/:id/retry-step', requireAuth, workflowController.retryStep);
apiRouter.get('/workflows/:id', requireAuth, workflowController.getById);
apiRouter.post('/workflows/:id/run', requireAuth, workflowController.run);

// 功能列表
apiRouter.get('/functions', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'image-generation', name: 'AI 生图' },
      { id: 'print-generation', name: '打印图生成' },
      { id: 'pattern-extraction', name: '印花提取' },
      { id: 'fission', name: '图裂变' },
      { id: 'becomes-clear', name: 'AI 变清晰' },
      { id: 'clothing-upper', name: '服装上身' },
      { id: 'clothing-wrinkle-removal', name: '服装去皱' },
      { id: 'cut-out-portrait', name: '扣头像' },
      { id: 'clothing-diagram', name: '3D 服装图' },
      { id: 'garment-extractions', name: '服装提取' },
      { id: 'intelligent-matting', name: '智能抠图' },
    ],
  });
});

// 认证相关
apiRouter.post('/auth/register', authController.register);
apiRouter.post('/auth/login', authController.login);
apiRouter.get('/auth/me', requireAuth, authController.me);
apiRouter.post('/auth/change-password', requireAuth, authController.changePassword);
apiRouter.post('/auth/create-member', requireAuth, authController.createMember);

// 团队相关
apiRouter.get('/teams', requireAuth, teamController.getMyTeams);
apiRouter.get('/teams/:id', requireAuth, teamController.getTeam);
apiRouter.get('/teams/:id/members', requireAuth, teamController.getTeamMembers);
apiRouter.delete('/teams/:id/members/:userId', requireAuth, teamController.removeMember);

// 团队 API Key 管理
apiRouter.put('/teams/:id/api-key', requireAuth, teamController.setApiKey);
apiRouter.get('/teams/:id/api-key', requireAuth, teamController.getApiKey);
apiRouter.get('/teams/:id/api-key/full', requireAuth, teamController.getApiKeyFull);

// 预算和额度管理
apiRouter.post('/budget/recharge', requireAuth, requireSuperAdmin, budgetController.recharge);
apiRouter.post('/budget/allocate', requireAuth, budgetController.allocate);
apiRouter.put('/budget/team/:teamId/total', requireAuth, budgetController.setTotalBudget);
apiRouter.get('/budget/team/:teamId', requireAuth, budgetController.getTeamBudget);
apiRouter.get('/budget/user/:teamId', requireAuth, budgetController.getUserBudget);
apiRouter.get('/transactions', requireAuth, budgetController.getTransactions);

// 平台管理（仅 super_admin）
apiRouter.post('/platform/api-keys', requireAuth, requireSuperAdmin, platformController.createApiKey);
apiRouter.get('/platform/api-keys', requireAuth, requireSuperAdmin, platformController.getApiKeys);
apiRouter.post('/platform/api-keys/:id/toggle', requireAuth, requireSuperAdmin, platformController.toggleApiKey);
apiRouter.delete('/platform/api-keys/:id', requireAuth, requireSuperAdmin, platformController.deleteApiKey);
apiRouter.get('/platform/api-keys/active', requireAuth, requireSuperAdmin, platformController.getActiveApiKey);
apiRouter.post('/platform/reset-db', requireAuth, requireSuperAdmin, platformController.resetDb);

// 测试端点
apiRouter.post('/test/cutout', requireAuth, async (req, res) => {
  const { runCutoutTest } = await import('../services/chcyaiService.js');
  try {
    await runCutoutTest();
    res.json({ success: true, message: '测试完成，请查看服务器日志' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败',
    });
  }
});

// 测试端点：查询素材库数据
apiRouter.get('/test/materials', requireAuth, async (req, res) => {
  try {
    const { query } = await import('../database/index.js');
    const materials = query('SELECT id, file_id, original_name, source_type FROM materials ORDER BY id DESC LIMIT 20') as Array<Record<string, unknown>>;
    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    });
  }
});
