export interface Task {
  id: number;
  batchId: string;
  functionType: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  resultUrl?: string | null;
  taskOriginId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskRecord {
  id: number;
  user_id: number;
  team_id: number;
  batch_id: string;
  function_type: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  input_data: string;
  output_data?: string | null;
  result_url?: string | null;
  task_id_origin?: string | null;
  cost?: number;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
  user_email?: string;
  user_nickname?: string | null;
  team_name?: string | null;
  batch_total?: number;
  batch_success?: number;
  batch_failed?: number;
  batch_processing?: number;
  workflow_id?: number | null;
  workflow_run_id?: number | null;
  workflow_step_key?: string | null;
  workflow_step_name?: string | null;
  workflow_item_index?: number | null;
}

export interface TaskListSummary {
  total: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
  batches: number;
  users: number;
  teams: number;
  total_cost: number;
}

export interface TaskFunctionSummaryItem {
  function_type: string;
  total: number;
  success: number;
  failed: number;
  total_cost: number;
}

export interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  progress: number;
  tasks: Task[];
}

export interface FunctionInfo {
  id: string;
  name: string;
}

export interface UploadResponse {
  success: boolean;
  data: {
    localFile: string;
    fileId: string;
    material?: MaterialAsset;
  };
}

export interface MaterialAsset {
  id: number;
  user_id: number;
  team_id: number;
  file_id: string;
  local_file: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  source_type: 'upload' | 'library';
  usage_count: number;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
  user_email?: string | null;
  user_nickname?: string | null;
  team_name?: string | null;
}

export interface CreateTaskResponse {
  success: boolean;
  data: {
    taskId: number;
    batchId: string;
  };
}

export interface CreateBatchResponse {
  success: boolean;
  data: {
    batchId: string;
    taskIds: number[];
    total: number;
  };
}

export interface WorkflowStep {
  key: string;
  name: string;
  functionType: string;
  inputTemplate: Record<string, unknown>;
}

export interface WorkflowRecord {
  id: number;
  name: string;
  description?: string | null;
  team_id: number;
  created_by: number;
  creator_email?: string;
  creator_nickname?: string | null;
  team_name?: string | null;
  created_at: string;
  updated_at: string;
  steps: WorkflowStep[];
  run_count?: number;
}

export interface WorkflowRunRecord {
  id: number;
  workflow_id: number;
  team_id: number;
  created_by: number;
  status: 'pending' | 'running' | 'partial_success' | 'success' | 'failed';
  concurrency: number;
  total_items: number;
  completed_items: number;
  failed_items: number;
  total_steps: number;
  run_batch_id: string;
  input_items_json: string;
  results_json?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  workflow_name?: string;
  workflow_description?: string | null;
  creator_email?: string;
  creator_nickname?: string | null;
  team_name?: string | null;
}
