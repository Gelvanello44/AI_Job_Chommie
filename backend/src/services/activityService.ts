import { PrismaClient, UserActivity } from '@prisma/client';

const prisma = new PrismaClient();

interface ActivityData {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

interface ActivityFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class ActivityService {
  /**
   * Log user activity (alias for logActivity)
   */
  async logUserActivity(userId: string, action: string, metadata?: any): Promise<UserActivity> {
    return this.logActivity({
      userId,
      action,
      entityType: metadata?.entityType,
      entityId: metadata?.entityId,
      metadata,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent
    });
  }

  /**
   * Log user activity
   */
  async logActivity(activityData: ActivityData): Promise<UserActivity> {
    try {
      const activity = await prisma.userActivity.create({
        data: {
          userId: activityData.userId,
          action: activityData.action,
          entityType: activityData.entityType,
          entityId: activityData.entityId,
          metadata: activityData.metadata,
          ipAddress: activityData.ipAddress,
          userAgent: activityData.userAgent,
          createdAt: new Date()
        }
      });

      return activity;
    } catch (error) {
      console.error('Error logging user activity:', error);
      throw new Error('Failed to log user activity');
    }
  }

  /**
   * Get user activities with filtering
   */
  async getActivities(filters: ActivityFilters): Promise<UserActivity[]> {
    try {
      const whereClause: any = {};

      if (filters.userId) {
        whereClause.userId = filters.userId;
      }

      if (filters.action) {
        whereClause.action = filters.action;
      }

      if (filters.entityType) {
        whereClause.entityType = filters.entityType;
      }

      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.createdAt.lte = filters.endDate;
        }
      }

      const activities = await prisma.userActivity.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return activities;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw new Error('Failed to fetch user activities');
    }
  }

  /**
   * Get activity summary for a user
   */
  async getActivitySummary(userId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get total activity count
      const totalActivities = await prisma.userActivity.count({
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        }
      });

      // Get activities by action type
      const activitiesByAction = await prisma.userActivity.groupBy({
        by: ['action'],
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          action: true
        }
      });

      // Get activities by entity type
      const activitiesByEntity = await prisma.userActivity.groupBy({
        by: ['entityType'],
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          entityType: true
        }
      });

      // Get daily activity counts
      const dailyActivities = await prisma.userActivity.groupBy({
        by: ['createdAt'],
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          createdAt: true
        }
      });

      // Process daily activities to get counts by date
      const dailyActivityMap = new Map();
      dailyActivities.forEach(activity => {
        const date = new Date(activity.createdAt).toISOString().split('T')[0];
        dailyActivityMap.set(date, (dailyActivityMap.get(date) || 0) + activity._count.createdAt);
      });

      return {
        totalActivities,
        activitiesByAction: activitiesByAction.map(item => ({
          action: item.action,
          count: item._count.action
        })),
        activitiesByEntity: activitiesByEntity.map(item => ({
          entityType: item.entityType,
          count: item._count.entityType
        })),
        dailyActivities: Array.from(dailyActivityMap.entries()).map(([date, count]) => ({
          date,
          count
        })).sort((a, b) => a.date.localeCompare(b.date))
      };
    } catch (error) {
      console.error('Error generating activity summary:', error);
      throw new Error('Failed to generate activity summary');
    }
  }

  /**
   * Log job view activity
   */
  async logJobView(userId: string, jobId: string, metadata?: any): Promise<void> {
    await this.logActivity({
      userId,
      action: 'VIEW',
      entityType: 'JOB',
      entityId: jobId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log application submission activity
   */
  async logApplicationSubmission(userId: string, applicationId: string, jobId: string, metadata?: any): Promise<void> {
    await this.logActivity({
      userId,
      action: 'CREATE',
      entityType: 'APPLICATION',
      entityId: applicationId,
      metadata: {
        jobId,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log CV upload activity
   */
  async logCVUpload(userId: string, cvId: string, metadata?: any): Promise<void> {
    await this.logActivity({
      userId,
      action: 'CREATE',
      entityType: 'CV',
      entityId: cvId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log search activity
   */
  async logJobSearch(userId: string, searchQuery: string, metadata?: any): Promise<void> {
    await this.logActivity({
      userId,
      action: 'SEARCH',
      entityType: 'JOB',
      metadata: {
        searchQuery,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log profile update activity
   */
  async logProfileUpdate(userId: string, metadata?: any): Promise<void> {
    await this.logActivity({
      userId,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: userId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get most active users
   */
  async getMostActiveUsers(limit: number = 10, days: number = 30): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activeUsers = await prisma.userActivity.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          userId: true
        },
        orderBy: {
          _count: {
            userId: 'desc'
          }
        },
        take: limit
      });

      // Get user details
      const userIds = activeUsers.map(user => user.userId);
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      });

      // Combine activity counts with user details
      return activeUsers.map(activeUser => {
        const user = users.find(u => u.id === activeUser.userId);
        return {
          user,
          activityCount: activeUser._count.userId
        };
      });
    } catch (error) {
      console.error('Error fetching most active users:', error);
      throw new Error('Failed to fetch most active users');
    }
  }

  /**
   * Clean up old activities (for data retention)
   */
  async cleanupOldActivities(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.userActivity.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      throw new Error('Failed to cleanup old activities');
    }
  }
}

export default new ActivityService();
