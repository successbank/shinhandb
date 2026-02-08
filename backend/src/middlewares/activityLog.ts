import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { pool } from '../db';

export const logActivity = (actionType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || '0.0.0.0';
      const details = {
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query,
      };

      await pool.query(
        `INSERT INTO activity_logs (user_id, action_type, details, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [userId, actionType, JSON.stringify(details), ipAddress]
      );

      next();
    } catch (error) {
      console.error('Failed to log activity:', error);
      next();
    }
  };
};
