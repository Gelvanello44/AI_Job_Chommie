import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import aiRoutes from '../ai.routes';
import { authMiddleware } from '../../middleware/auth.middleware';

// Mock the auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  })
}));

// Mock the HuggingFace service
jest.mock('../../services/huggingface.service', () => ({
  huggingFaceService: {
    extractEntitiesFromResume: jest.fn().mockResolvedValue([
      { entity_group: 'PER', word: 'John Doe', score: 0.9, start: 0, end: 8 },
      { entity_group: 'ORG', word: 'Microsoft', score: 0.85, start: 20, end: 29 }
    ]),
    classifySkills: jest.fn().mockResolvedValue([
      { label: 'JavaScript', score: 0.9 },
      { label: 'React', score: 0.85 },
      { label: 'Node.js', score: 0.8 }
    ]),
    generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]),
    answerQuestion: jest.fn().mockResolvedValue({
      answer: 'JavaScript programming',
      score: 0.95,
      start: 10,
      end: 30
    }),
    generateText: jest.fn().mockResolvedValue('Generated cover letter text...'),
    analyzeSentiment: jest.fn().mockResolvedValue([
      { label: 'POSITIVE', score: 0.85 },
      { label: 'NEGATIVE', score: 0.1 },
      { label: 'NEUTRAL', score: 0.05 }
    ]),
    matchJobWithProfile: jest.fn().mockResolvedValue({
      matchScore: 85,
      relevantSkills: [{ label: 'JavaScript', score: 0.9 }],
      missingSkills: ['Python'],
      sentiment: [{ label: 'POSITIVE', score: 0.8 }],
      explanation: 'Good match based on skills'
    }),
    parseResume: jest.fn().mockResolvedValue({
      entities: [],
      skills: [{ label: 'JavaScript', score: 0.9 }],
      experience: ['5 years experience'],
      education: ['BSc Computer Science'],
      contact: { email: 'john@example.com', phone: '+27123456789' }
    }),
    generateCoverLetter: jest.fn().mockResolvedValue('Dear Hiring Manager...'),
    calculateSimilarity: jest.fn().mockResolvedValue(0.85),
    healthCheck: jest.fn().mockResolvedValue(true)
  }
}));

const app = express();
app.use(express.json());
app.use('/api/v1/ai', aiRoutes);

describe('AI Routes Integration Tests', () => {
  
  describe('POST /api/v1/ai/ner', () => {
    it('should extract named entities from text', async () => {
      const response = await request(app)
        .post('/api/v1/ai/ner')
        .send({
          text: 'John Doe worked at Microsoft in Seattle for 5 years.',
          type: 'resume'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('entities');
      expect(response.body.data).toHaveProperty('grouped');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.entities).toBeInstanceOf(Array);
      expect(response.body.data.summary.total).toBe(2);
    });

    it('should validate text input', async () => {
      const response = await request(app)
        .post('/api/v1/ai/ner')
        .send({
          text: 'short'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should handle optional type parameter', async () => {
      const response = await request(app)
        .post('/api/v1/ai/ner')
        .send({
          text: 'John Doe is a software developer with 10 years experience'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/ai/classify-skills', () => {
    it('should classify skills from text', async () => {
      const response = await request(app)
        .post('/api/v1/ai/classify-skills')
        .send({
          text: 'I have experience with JavaScript, React, and Node.js',
          candidateLabels: ['JavaScript', 'Python', 'React', 'Node.js']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.skills).toBeInstanceOf(Array);
      expect(response.body.data.topSkills).toBeInstanceOf(Array);
      expect(response.body.data.summary).toHaveProperty('total');
      expect(response.body.data.summary).toHaveProperty('highConfidence');
    });

    it('should use default labels when not provided', async () => {
      const response = await request(app)
        .post('/api/v1/ai/classify-skills')
        .send({
          text: 'Experienced developer with various programming skills'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.skills).toBeDefined();
    });
  });

  describe('POST /api/v1/ai/embeddings', () => {
    it('should generate embeddings for single text', async () => {
      const response = await request(app)
        .post('/api/v1/ai/embeddings')
        .send({
          texts: 'Sample text for embedding',
          normalize: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.embeddings).toBeInstanceOf(Array);
      expect(response.body.data.dimensions).toBe(3);
      expect(response.body.data.count).toBe(2);
    });

    it('should generate embeddings for multiple texts', async () => {
      const response = await request(app)
        .post('/api/v1/ai/embeddings')
        .send({
          texts: ['Text 1', 'Text 2', 'Text 3']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.embeddings).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/v1/ai/question-answer', () => {
    it('should answer questions based on context', async () => {
      const response = await request(app)
        .post('/api/v1/ai/question-answer')
        .send({
          question: 'What is the main skill required?',
          context: 'The main skill required is JavaScript programming with React framework.'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.answer).toBeDefined();
      expect(response.body.data.confidence).toBeGreaterThan(0);
      expect(response.body.data.position).toBeDefined();
    });

    it('should validate question and context', async () => {
      const response = await request(app)
        .post('/api/v1/ai/question-answer')
        .send({
          question: 'Q?',
          context: 'Short'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/ai/generate-text', () => {
    it('should generate text from prompt', async () => {
      const response = await request(app)
        .post('/api/v1/ai/generate-text')
        .send({
          prompt: 'Write a brief introduction for a software developer',
          maxLength: 200,
          type: 'general'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.generatedText).toBeDefined();
      expect(response.body.data.metadata).toHaveProperty('length');
      expect(response.body.data.metadata).toHaveProperty('words');
    });

    it('should enhance prompt for cover letters', async () => {
      const response = await request(app)
        .post('/api/v1/ai/generate-text')
        .send({
          prompt: 'for a software developer position at Tech Corp',
          type: 'cover_letter'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prompt).toContain('cover letter');
    });
  });

  describe('POST /api/v1/ai/sentiment', () => {
    it('should analyze sentiment of text', async () => {
      const response = await request(app)
        .post('/api/v1/ai/sentiment')
        .send({
          text: 'I am very excited about this amazing opportunity!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sentiment).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });

    it('should analyze sentiment by sentences', async () => {
      const response = await request(app)
        .post('/api/v1/ai/sentiment')
        .send({
          text: 'This is great! But that was terrible. Overall, it was okay.',
          granularity: 'sentence'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sentiment).toHaveProperty('sentences');
      expect(response.body.data.sentiment).toHaveProperty('overall');
    });
  });

  describe('POST /api/v1/ai/job-match', () => {
    it('should calculate job match score', async () => {
      const response = await request(app)
        .post('/api/v1/ai/job-match')
        .send({
          jobDescription: 'Looking for a senior JavaScript developer with React and Node.js experience. Must have 5+ years experience.',
          userProfile: 'Senior software developer with 7 years experience in JavaScript, React, and Node.js. Led multiple projects.'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchScore).toBeDefined();
      expect(response.body.data.relevantSkills).toBeInstanceOf(Array);
      expect(response.body.data.missingSkills).toBeInstanceOf(Array);
      expect(response.body.data.explanation).toBeDefined();
    });

    it('should validate minimum text length', async () => {
      const response = await request(app)
        .post('/api/v1/ai/job-match')
        .send({
          jobDescription: 'Short job description',
          userProfile: 'Short profile'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/ai/parse-resume', () => {
    it('should parse resume text', async () => {
      const resumeText = `
        John Doe
        john.doe@email.com
        +27123456789
        
        Experience:
        Software Developer at Tech Corp (2020-2023)
        - Developed web applications using React and Node.js
        
        Education:
        BSc Computer Science - University of Cape Town (2016-2020)
        
        Skills:
        JavaScript, React, Node.js, Python, SQL
      `;

      const response = await request(app)
        .post('/api/v1/ai/parse-resume')
        .send({ resumeText })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('entities');
      expect(response.body.data).toHaveProperty('skills');
      expect(response.body.data).toHaveProperty('experience');
      expect(response.body.data).toHaveProperty('education');
      expect(response.body.data).toHaveProperty('contact');
    });
  });

  describe('POST /api/v1/ai/generate-cover-letter', () => {
    it('should generate a cover letter', async () => {
      const response = await request(app)
        .post('/api/v1/ai/generate-cover-letter')
        .send({
          jobTitle: 'Senior Software Developer',
          companyName: 'Tech Corp SA',
          userSkills: ['JavaScript', 'React', 'Node.js', 'Python'],
          experience: '7 years of full-stack development experience'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.coverLetter).toBeDefined();
      expect(response.body.data.metadata).toHaveProperty('length');
      expect(response.body.data.metadata).toHaveProperty('words');
      expect(response.body.data.metadata).toHaveProperty('paragraphs');
    });
  });

  describe('POST /api/v1/ai/similarity', () => {
    it('should calculate text similarity', async () => {
      const response = await request(app)
        .post('/api/v1/ai/similarity')
        .send({
          text1: 'JavaScript developer with React experience',
          text2: 'React developer with JavaScript skills'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.similarity).toBeDefined();
      expect(response.body.data.percentage).toBeDefined();
      expect(response.body.data.interpretation).toBeDefined();
      expect(response.body.data.similarity).toBeGreaterThanOrEqual(0);
      expect(response.body.data.similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/v1/ai/health', () => {
    it('should check AI service health', async () => {
      const response = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.huggingface).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected routes', async () => {
      // Mock authMiddleware to simulate unauthorized
      const originalAuth = authMiddleware;
      (authMiddleware as jest.Mock).mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/v1/ai/ner')
        .send({ text: 'Test text' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });
});
