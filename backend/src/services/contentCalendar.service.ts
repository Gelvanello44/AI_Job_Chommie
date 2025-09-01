import dayjs from 'dayjs';
import logger from '../config/logger.js';

export interface CalendarSuggestion {
  date: string;
  theme: string;
  ideas: Array<{ channel: 'LinkedIn' | 'Twitter' | 'Portfolio' | 'Blog'; title: string; description: string; hashtags: string[] }>;
}

export class ContentCalendarService {
  static generateCalendar(options: {
    topic?: string;
    audience?: string;
    weeks?: number;
    cadencePerWeek?: number;
    startDate?: string;
  }): CalendarSuggestion[] {
    const topic = options.topic || 'Career Growth';
    const audience = options.audience || 'South African tech professionals';
    const weeks = Math.min(12, Math.max(1, options.weeks || 4));
    const cadence = Math.min(7, Math.max(1, options.cadencePerWeek || 3));
    const start = options.startDate ? dayjs(options.startDate) : dayjs();

    const weeklyThemes = [
      `Insights: ${topic} trends in SA`,
      `How-to: Practical steps for ${topic.toLowerCase()}`,
      `Story: Personal experience with ${topic.toLowerCase()}`,
      `Engagement: Ask the community about ${topic.toLowerCase()}`,
      `Showcase: Project or achievement related to ${topic.toLowerCase()}`
    ];

    const ideasByChannel = (theme: string) => [
      {
        channel: 'LinkedIn' as const,
        title: theme,
        description: `Share a concise post tailored to ${audience}. Include a takeaway and a question.`,
        hashtags: ['#AIJobChommie', '#CareerGrowth', '#SouthAfrica', `#${topic.replace(/\s+/g, '')}`]
      },
      {
        channel: 'Portfolio' as const,
        title: `Portfolio update: ${theme}`,
        description: `Add a portfolio item or update a case study demonstrating ${topic.toLowerCase()}.` ,
        hashtags: ['#Portfolio', '#Projects']
      },
      {
        channel: 'Blog' as const,
        title: `Blog draft: ${theme}`,
        description: `Outline a 600-900 word post and schedule for publishing next week.` ,
        hashtags: ['#Blogging', '#ThoughtLeadership']
      }
    ];

    const plan: CalendarSuggestion[] = [];

    for (let w = 0; w < weeks; w++) {
      const weekStart = start.add(w, 'week');
      for (let c = 0; c < cadence; c++) {
        const date = weekStart.add(c, 'day');
        const theme = weeklyThemes[(w + c) % weeklyThemes.length];
        plan.push({
          date: date.format('YYYY-MM-DD'),
          theme,
          ideas: ideasByChannel(theme)
        });
      }
    }

    logger.info('Generated content calendar', { topic, audience, weeks, cadence });
    return plan;
  }
}

export const contentCalendarService = ContentCalendarService;
