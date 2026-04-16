import { getDatabase, saveDatabase } from '../index.js';

export interface TaskInput {
  batchId: string;
  functionType: string;
  inputData: Record<string, unknown>;
}

export interface Task {
  id: number;
  batchId: string;
  functionType: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  taskOriginId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const taskRepository = {
  create: async (input: TaskInput): Promise<number> => {
    const db = await getDatabase();
    db.run(`
      INSERT INTO tasks (batch_id, function_type, input_data, status)
      VALUES (?, ?, ?, 'pending')
    `, [input.batchId, input.functionType, JSON.stringify(input.inputData)]);
    const result = db.exec('SELECT last_insert_rowid()');
    await saveDatabase();
    return result[0]?.values[0]?.[0] as number;
  },

  findById: async (id: number): Promise<Task | null> => {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM tasks WHERE id = ?', [id]);

    if (!result.length || !result[0].values.length) return null;

    const row = result[0].values[0];
    const columns = result[0].columns;

    const task: any = {};
    columns.forEach((col, i) => task[col] = row[i]);

    task.input_data = JSON.parse(task.input_data);
    task.output_data = task.output_data ? JSON.parse(task.output_data) : null;

    return task;
  },

  findByBatchId: async (batchId: string): Promise<Task[]> => {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM tasks WHERE batch_id = ? ORDER BY id', [batchId]);

    if (!result.length || !result[0].values.length) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
      const task: any = {};
      columns.forEach((col, i) => task[col] = row[i]);
      task.input_data = JSON.parse(task.input_data);
      task.output_data = task.output_data ? JSON.parse(task.output_data) : null;
      return task;
    });
  },

  updateStatus: async (id: number, status: string, outputData?: Record<string, unknown>, errorMessage?: string) => {
    const db = await getDatabase();
    db.run(`
      UPDATE tasks
      SET status = ?, output_data = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, outputData ? JSON.stringify(outputData) : null, errorMessage ?? null, id]);
    await saveDatabase();
  },

  setOriginTaskId: async (id: number, taskOriginId: string) => {
    const db = await getDatabase();
    db.run('UPDATE tasks SET task_id_origin = ? WHERE id = ?', [taskOriginId, id]);
    await saveDatabase();
  },

  getAll: async (): Promise<Task[]> => {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 20');

    if (!result.length || !result[0].values.length) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
      const task: any = {};
      columns.forEach((col, i) => task[col] = row[i]);
      task.input_data = JSON.parse(task.input_data);
      task.output_data = task.output_data ? JSON.parse(task.output_data) : null;
      return task;
    });
  },
};
