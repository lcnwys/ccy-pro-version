import { create } from 'zustand';
import type { Task, BatchProgress } from '@/types';

interface TaskState {
  tasks: Task[];
  batchProgress: Record<string, BatchProgress>;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  setBatchProgress: (batchId: string, progress: BatchProgress) => void;
  getBatchTasks: (batchId: string) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  batchProgress: {},

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
    })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setBatchProgress: (batchId, progress) =>
    set((state) => ({
      batchProgress: { ...state.batchProgress, [batchId]: progress },
    })),

  getBatchTasks: (batchId) => {
    const progress = get().batchProgress[batchId];
    return progress?.tasks || [];
  },
}));
