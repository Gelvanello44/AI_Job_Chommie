import { Request, Response } from 'express';
import linkedInService from '../services/linkedin.service';
import { z } from 'zod';

// Validation schemas
const ParseProfileSchema = z.object({
  profileUrl: z.string().url()
});

export class LinkedInController {
  /**
   * Parse LinkedIn profile
   */
  async parseProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validation = ParseProfileSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ 
          error: 'Invalid request data',
          details: validation.error.errors 
        });
        return;
      }

      const { profileUrl } = validation.data;
      const profile = await linkedInService.parseProfile(profileUrl, userId);

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error parsing LinkedIn profile:', error);
      res.status(500).json({
        error: 'Failed to parse LinkedIn profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get optimization checklist
   */
  async getOptimizationChecklist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const checklist = await linkedInService.getOptimizationChecklist(userId);

      res.status(200).json({
        success: true,
        data: checklist
      });
    } catch (error) {
      console.error('Error getting optimization checklist:', error);
      res.status(500).json({
        error: 'Failed to get optimization checklist',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate improvement report
   */
  async generateImprovementReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const report = await linkedInService.generateImprovementReport(userId);

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating improvement report:', error);
      res.status(500).json({
        error: 'Failed to generate improvement report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new LinkedInController();
