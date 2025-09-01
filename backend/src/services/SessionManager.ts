import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import useragent from 'useragent';
import geoip from 'geoip-lite';
import prisma from '../config/database';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0')
});

export class SessionManager {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly SESSION_TTL = 30 * 24 * 60 * 60; // 30 days

  // Create session
  static async createSession(userId: string, req: Request): Promise<string> {
    const sessionId = crypto.randomUUID();
    const agent = useragent.parse(req.headers['user-agent']);
    const ip = req.ip || req.connection.remoteAddress;
    const geo = geoip.lookup(ip);

    const sessionData = {
      id: sessionId,
      userId,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      browser: agent.toAgent(),
      os: agent.os.toString(),
      device: agent.device.toString(),
      deviceType: this.getDeviceType(agent),
      location: geo ? `${geo.city}, ${geo.country}` : 'Unknown',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000).toISOString()
    };

    // Store in Redis
    await redis.setex(
      `${this.SESSION_PREFIX}${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(sessionData)
    );

    // Store session reference for user
    await redis.sadd(`user:sessions:${userId}`, sessionId);

    // Log session creation
    await this.logSessionActivity(userId, 'created', sessionData);

    return sessionId;
  }

  // Get all sessions for user
  static async getUserSessions(userId: string): Promise<any[]> {
    const sessionIds = await redis.smembers(`user:sessions:${userId}`);
    const sessions = [];

    for (const sessionId of sessionIds) {
      const sessionData = await redis.get(`${this.SESSION_PREFIX}${sessionId}`);
      if (sessionData) {
        sessions.push(JSON.parse(sessionData));
      } else {
        // Remove expired session reference
        await redis.srem(`user:sessions:${userId}`, sessionId);
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );
  }

  // Update session activity
  static async updateSessionActivity(sessionId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastActive = new Date().toISOString();
      
      await redis.setex(sessionKey, this.SESSION_TTL, JSON.stringify(session));
    }
  }

  // Revoke session
  static async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      
      // Verify ownership
      if (session.userId !== userId) {
        return false;
      }

      // Delete session
      await redis.del(sessionKey);
      await redis.srem(`user:sessions:${userId}`, sessionId);
      
      // Log session revocation
      await this.logSessionActivity(userId, 'revoked', session);
      
      return true;
    }
    
    return false;
  }

  // Revoke all sessions except current
  static async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const sessionIds = await redis.smembers(`user:sessions:${userId}`);
    let revokedCount = 0;

    for (const sessionId of sessionIds) {
      if (sessionId !== currentSessionId) {
        if (await this.revokeSession(sessionId, userId)) {
          revokedCount++;
        }
      }
    }

    return revokedCount;
  }

  // Validate session
  static async validateSession(sessionId: string): Promise<any> {
    const sessionData = await redis.get(`${this.SESSION_PREFIX}${sessionId}`);
    
    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);
    
    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      await this.revokeSession(sessionId, session.userId);
      return null;
    }

    // Update activity
    await this.updateSessionActivity(sessionId);
    
    return session;
  }

  // Get device type from user agent
  private static getDeviceType(agent: any): string {
    if (agent.device.family !== 'Other') {
      return 'mobile';
    }
    if (agent.os.family.includes('Windows') || agent.os.family.includes('Mac')) {
      return 'desktop';
    }
    return 'unknown';
  }

  // Log session activity
  private static async logSessionActivity(userId: string, action: string, sessionData: any): Promise<void> {
    await prisma.sessionLog.create({
      data: {
        userId,
        action,
        sessionId: sessionData.id,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        metadata: sessionData
      }
    });
  }
}

// Session controller
export class SessionController {
  async getSessions(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const currentSessionId = req.session?.id;
      
      const sessions = await SessionManager.getUserSessions(userId);
      
      res.json({
        sessions,
        currentSessionId
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }

  async revokeSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;
      
      const revoked = await SessionManager.revokeSession(sessionId, userId);
      
      if (!revoked) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Revoke session error:', error);
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  }

  async revokeAllOtherSessions(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const currentSessionId = req.session?.id;
      
      const revokedCount = await SessionManager.revokeAllOtherSessions(userId, currentSessionId);
      
      res.json({ 
        success: true, 
        revokedCount 
      });
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      res.status(500).json({ error: 'Failed to revoke sessions' });
    }
  }
}
