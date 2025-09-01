import { writeFileSync } from 'fs';
import path from 'path';
import { BadgeGenerationService } from '../src/services/badge-generation.service.js';
import { ContentCalendarService } from '../src/services/contentCalendar.service.js';
import { MockInterviewService } from '../src/services/mockInterview.service.js';
import { HiddenMarketService } from '../src/services/hiddenMarket.service.js';

async function run() {
  console.log('=== Smoke test: Badge Generation ===');
  const png = await BadgeGenerationService.generateBadgePng({
    title: 'Technical Assessment',
    subtitle: 'Score: 85% ',
    score: 85,
    strength: 'Problem Solving',
    theme: 'teal'
  });
  const outPng = path.join(process.cwd(), 'badges_test.png');
  writeFileSync(outPng, png);
  console.log('Badge PNG written to', outPng, `(size=${png.length} bytes)`);

  console.log('\n=== Smoke test: Content Calendar ===');
  const calendar = ContentCalendarService.generateCalendar({ topic: 'AI Skills', weeks: 2, cadencePerWeek: 2 });
  console.log('Generated calendar entries:', calendar.length);
  console.log('First entry sample:', calendar[0]);

  console.log('\n=== Smoke test: Mock Interview ===');
  const session = MockInterviewService.createSession('software engineer', 'mid');
  const sampleAnswers: Record<string,string> = {};
  for (const q of session.questions) {
    sampleAnswers[q.id] = `My answer mentions ${q.keywords?.[0] || 'experience'} and details achievements.`;
  }
  const results = MockInterviewService.scoreAnswers(session.questions, sampleAnswers);
  const average = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  console.log('Session id:', session.id, 'Questions:', session.questions.length, 'Average score:', average);

  console.log('\n=== Smoke test: Hidden Job Market ===');
  const hiddenList = await HiddenMarketService.list();
  console.log('Hidden opportunities:', hiddenList.length);
  console.log('First opportunity:', hiddenList[0]);

  console.log('\nAll low-priority feature smoke tests executed.');
}

run().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
