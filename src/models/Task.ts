import { Schema, Types, model } from 'mongoose';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ITask {
  owner: Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: Date;
}

const taskSchema = new Schema<ITask>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    dueDate: { type: Date },
  },
  { timestamps: true },
);

// Matches the main list query: one user's tasks, newest first, optionally by status.
taskSchema.index({ owner: 1, createdAt: -1 });
taskSchema.index({ owner: 1, status: 1, createdAt: -1 });

export const Task = model<ITask>('Task', taskSchema);
