import { Request, Response } from 'express';
import logger from '../config/logger.js';
import { BadgeGenerationService } from '../services/badge-generation.service.js';

export class BadgeController {
  /**
   * GET /api/v1/badges/generate
   * Query: type, score, strength, title, subtitle, theme
   * Returns badge PNG image
   */
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const { type, score, strength, title, subtitle, theme } = req.query as any;

      const png = await BadgeGenerationService.generateBadgePng({
        title: title || (type ? `${type} Assessment` : 'AI Job Chommie Badge'),
        subtitle: subtitle || (type && score ? `Score: ${parseInt(score, 10)}%` : undefined),
        score: score ? parseInt(score, 10) : undefined,
        strength: strength || undefined,
        theme: (theme as any) || 'teal'
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(png);
    } catch (error) {
      logger.error('Failed to generate badge', { error, query: req.query });
      res.status(500).json({ success: false, message: 'Failed to generate badge' });
    }
  }
}

export const badgeController = new BadgeController();
