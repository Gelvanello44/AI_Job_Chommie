import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth';

export const authMiddleware = authenticate;
export const authenticateUser = authenticate;
