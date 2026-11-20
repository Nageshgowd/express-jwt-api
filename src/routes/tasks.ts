import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { Task, TASK_STATUSES } from '../models/Task';
import { HttpError } from '../errors';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: z.coerce.date().optional(),
});

const updateSchema = createSchema
  .partial()
  .extend({ dueDate: z.coerce.date().nullable().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(TASK_STATUSES).optional(),
  sort: z.enum(['createdAt', '-createdAt', 'dueDate', '-dueDate']).default('-createdAt'),
});

function assertId(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'Task not found');
}

router.get('/', async (req, res) => {
  const { page, limit, status, sort } = listSchema.parse(req.query);
  const filter = { owner: req.userId, ...(status && { status }) };
  const sortKey = sort.startsWith('-') ? { [sort.slice(1)]: -1 as const } : { [sort]: 1 as const };

  const [items, total] = await Promise.all([
    Task.find(filter)
      .sort(sortKey)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);
  res.json({ page, limit, total, totalPages: Math.ceil(total / limit), items });
});

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  const task = await Task.create({ ...data, owner: req.userId });
  res.status(201).json(task);
});

router.get('/:id', async (req, res) => {
  assertId(req.params.id);
  const task = await Task.findOne({ _id: req.params.id, owner: req.userId });
  if (!task) throw new HttpError(404, 'Task not found');
  res.json(task);
});

router.patch('/:id', async (req, res) => {
  assertId(req.params.id);
  const { dueDate, ...rest } = updateSchema.parse(req.body);
  const update: Record<string, unknown> = { ...rest };
  const unset = dueDate === null ? { dueDate: 1 } : undefined;
  if (dueDate) update.dueDate = dueDate;

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    { $set: update, ...(unset && { $unset: unset }) },
    { returnDocument: "after", runValidators: true },
  );
  if (!task) throw new HttpError(404, 'Task not found');
  res.json(task);
});

router.delete('/:id', async (req, res) => {
  assertId(req.params.id);
  const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!task) throw new HttpError(404, 'Task not found');
  res.status(204).end();
});

export default router;
