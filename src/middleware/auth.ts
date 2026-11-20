import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config';
import { HttpError } from '../errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string): string {
  const { jwtSecret, jwtExpiresIn } = getConfig();
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: jwtExpiresIn } as jwt.SignOptions);
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing bearer token'));
  }
  try {
    const payload = jwt.verify(header.slice(7), getConfig().jwtSecret);
    if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};
