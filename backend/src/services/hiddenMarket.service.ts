import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger.js';

export interface HiddenOpportunity {
  id: string;
  company: string;
  role: string;
  location: string;
  contactType: 'referral' | 'recruiter';
  seniority: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Manager' | string;
  notes?: string;
  hints?: string[];
  lastSeen?: string;
}

export class HiddenMarketService {
  private static cache: HiddenOpportunity[] | null = null;
  private static filePath = path.join(process.cwd(), 'ai-job-chommie-backend', 'src', 'data', 'hidden-market.json');

  static async list(): Promise<HiddenOpportunity[]> {
    if (!this.cache) {
      try {
        const raw = await fs.readFile(this.filePath, 'utf-8');
        this.cache = JSON.parse(raw);
      } catch (error) {
        logger.error('Failed to load hidden market JSON', { error });
        this.cache = [];
      }
    }
    return this.cache;
  }

  static async getById(id: string): Promise<HiddenOpportunity | undefined> {
    const list = await this.list();
    return list.find(i => i.id === id);
  }
}

export const hiddenMarketService = HiddenMarketService;
