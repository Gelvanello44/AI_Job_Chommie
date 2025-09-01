import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

export type Difficulty = 'junior' | 'mid' | 'senior';

export interface MockQuestion {
  id: string;
  prompt: string;
  type: 'behavioral' | 'technical' | 'situational';
  keywords?: string[];
}

export interface MockSession {
  id: string;
  role: string;
  difficulty: Difficulty;
  createdAt: string;
  questions: MockQuestion[];
}

export interface ScoreResult {
  questionId: string;
  score: number; // 0-100
  feedback: string;
}

export class MockInterviewService {
  static createSession(role: string, difficulty: Difficulty = 'mid'): MockSession {
    const questions = this.generateQuestions(role, difficulty);
    const session: MockSession = {
      id: uuidv4(),
      role,
      difficulty,
      createdAt: new Date().toISOString(),
      questions
    };

    logger.info('Mock interview session created', { role, difficulty, count: questions.length });
    return session;
  }

  static generateQuestions(role: string, difficulty: Difficulty): MockQuestion[] {
    const base: Record<string, MockQuestion[]> = {
      'software engineer': [
        { id: 'se1', prompt: 'Tell me about a time you optimized a slow system.', type: 'behavioral', keywords: ['optimize','profiling','performance','scalability'] },
        { id: 'se2', prompt: 'Explain event loop and how it affects performance.', type: 'technical', keywords: ['event loop','async','non-blocking'] },
        { id: 'se3', prompt: 'Design a URL shortener. Outline key components.', type: 'technical', keywords: ['hash','database','cache','scale'] },
        { id: 'se4', prompt: 'Describe a conflict with a teammate and the resolution.', type: 'behavioral', keywords: ['communication','empathy','resolution'] }
      ],
      'data analyst': [
        { id: 'da1', prompt: 'Walk through a time you cleaned a messy dataset.', type: 'behavioral', keywords: ['missing values','outliers','normalization'] },
        { id: 'da2', prompt: 'How do you choose the right chart to tell a story?', type: 'technical', keywords: ['audience','insight','clarity'] },
        { id: 'da3', prompt: 'Explain A/B testing pitfalls and best practices.', type: 'technical', keywords: ['sample size','p-value','bias'] }
      ],
      'product manager': [
        { id: 'pm1', prompt: 'Describe a product you launched: goal, metrics, outcome.', type: 'behavioral', keywords: ['OKRs','KPIs','impact'] },
        { id: 'pm2', prompt: 'How do you prioritize a roadmap with limited resources?', type: 'situational', keywords: ['prioritization','stakeholders','tradeoffs'] },
        { id: 'pm3', prompt: 'Tell me about handling conflicting stakeholder requests.', type: 'behavioral', keywords: ['alignment','communication','decision'] }
      ],
      'sales': [
        { id: 'sl1', prompt: 'How do you handle objections from a key prospect?', type: 'situational', keywords: ['objection handling','value','closing'] },
        { id: 'sl2', prompt: 'Give an example of exceeding your quota.', type: 'behavioral', keywords: ['pipeline','forecast','win rate'] }
      ]
    };

    const key = role.trim().toLowerCase();
    const bank = base[key] || base['software engineer'];

    // Adjust quantity by difficulty
    const countMap: Record<Difficulty, number> = { junior: 6, mid: 8, senior: 10 };
    const count = Math.min(countMap[difficulty], bank.length);

    // Simple selection: cycle if needed
    const out: MockQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const q = bank[i % bank.length];
      out.push({ ...q, id: `${q.id}-${i}` });
    }
    return out;
  }

  static scoreAnswers(questions: MockQuestion[], answers: Record<string, string>): ScoreResult[] {
    const results: ScoreResult[] = [];
    for (const q of questions) {
      const a = (answers[q.id] || '').trim();
      if (!a) {
        results.push({ questionId: q.id, score: 0, feedback: 'No answer provided.' });
        continue;
      }
      const lengthScore = Math.min(60, Math.floor(a.split(/\s+/).length / 4)); // up to 60pts for substance
      const keywordScore = (q.keywords || []).reduce((acc, kw) => acc + (a.toLowerCase().includes(kw.toLowerCase()) ? 10 : 0), 0); // up to ~40
      const total = Math.min(100, lengthScore + keywordScore);
      const feedback = total > 80 ? 'Strong, concise and keyword-rich.' : total > 50 ? 'Decent. Add concrete examples and results.' : 'Needs more structure, details and relevant keywords.';
      results.push({ questionId: q.id, score: total, feedback });
    }
    return results;
  }
}

export const mockInterviewService = MockInterviewService;
