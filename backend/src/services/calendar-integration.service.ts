import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { config } from '../config/index.js';
import { addMinutes, format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

/**
 * Calendar Integration Service
 * Handles Google Calendar and Outlook Calendar synchronization
 */
export class CalendarIntegrationService {
  private googleOAuth2Client: any;

  constructor() {
    // Initialize Google OAuth2 client
    this.googleOAuth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get Google Calendar authorization URL
   */
  getGoogleAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId // Pass userId in state for callback
    });
  }

  /**
   * Get Microsoft authorization URL
   */
  getMicrosoftAuthUrl(userId: string): string {
    const scopes = [
      'https://graph.microsoft.com/calendars.readwrite',
      'https://graph.microsoft.com/user.read'
    ];

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.append('client_id', config.MICROSOFT_CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', config.MICROSOFT_REDIRECT_URI);
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('state', userId);

    return authUrl.toString();
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code: string, userId: string): Promise<void> {
    try {
      const { tokens } = await this.googleOAuth2Client.getToken(code);
      
      // Store tokens securely
      await prisma.calendarIntegration.upsert({
        where: { 
          userId_provider: {
            userId,
            provider: 'GOOGLE'
          }
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + (tokens.expiry_date || 3600000)),
          isActive: true
        },
        create: {
          userId,
          provider: 'GOOGLE',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + (tokens.expiry_date || 3600000)),
          isActive: true
        }
      });

      logger.info('Google Calendar connected', { userId });
    } catch (error) {
      logger.error('Error handling Google callback', { error, userId });
      throw error;
    }
  }

  /**
   * Handle Microsoft OAuth callback
   */
  async handleMicrosoftCallback(code: string, userId: string): Promise<void> {
    try {
      const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: config.MICROSOFT_CLIENT_ID,
          client_secret: config.MICROSOFT_CLIENT_SECRET,
          code,
          redirect_uri: config.MICROSOFT_REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });

      const tokens = await response.json();

      if (tokens.error) {
        throw new Error(tokens.error_description);
      }

      // Store tokens securely
      await prisma.calendarIntegration.upsert({
        where: { 
          userId_provider: {
            userId,
            provider: 'MICROSOFT'
          }
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
          isActive: true
        },
        create: {
          userId,
          provider: 'MICROSOFT',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
          isActive: true
        }
      });

      logger.info('Microsoft Calendar connected', { userId });
    } catch (error) {
      logger.error('Error handling Microsoft callback', { error, userId });
      throw error;
    }
  }

  /**
   * Create Google Calendar event
   */
  async createGoogleCalendarEvent(
    userId: string,
    interviewSchedule: any
  ): Promise<string | null> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'GOOGLE');
      if (!integration) return null;

      // Refresh token if expired
      if (new Date() > integration.expiresAt) {
        await this.refreshGoogleToken(userId);
      }

      this.googleOAuth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleOAuth2Client });

      const event = {
        summary: interviewSchedule.title,
        description: interviewSchedule.description || '',
        start: {
          dateTime: interviewSchedule.scheduledFor.toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        end: {
          dateTime: addMinutes(interviewSchedule.scheduledFor, interviewSchedule.duration).toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        location: interviewSchedule.location,
        conferenceData: interviewSchedule.meetingUrl ? {
          entryPoints: [{
            entryPointType: 'video',
            uri: interviewSchedule.meetingUrl,
            label: 'Join Video Call'
          }]
        } : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 1440 }, // 24 hours before
            { method: 'popup', minutes: 30 }    // 30 minutes before
          ]
        }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: interviewSchedule.meetingUrl ? 1 : 0
      });

      return response.data.id || null;
    } catch (error) {
      logger.error('Error creating Google Calendar event', { error, userId });
      return null;
    }
  }

  /**
   * Create Microsoft Calendar event
   */
  async createMicrosoftCalendarEvent(
    userId: string,
    interviewSchedule: any
  ): Promise<string | null> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'MICROSOFT');
      if (!integration) return null;

      // Refresh token if expired
      if (new Date() > integration.expiresAt) {
        await this.refreshMicrosoftToken(userId);
      }

      const client = Client.init({
        authProvider: (done) => {
          done(null, integration.accessToken);
        }
      });

      const event = {
        subject: interviewSchedule.title,
        body: {
          contentType: 'HTML',
          content: interviewSchedule.description || ''
        },
        start: {
          dateTime: interviewSchedule.scheduledFor.toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        end: {
          dateTime: addMinutes(interviewSchedule.scheduledFor, interviewSchedule.duration).toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        location: {
          displayName: interviewSchedule.location || 'Online'
        },
        isOnlineMeeting: !!interviewSchedule.meetingUrl,
        onlineMeetingUrl: interviewSchedule.meetingUrl,
        reminder: {
          minutesBeforeStart: 30
        }
      };

      const response = await client
        .api('/me/events')
        .post(event);

      return response.id || null;
    } catch (error) {
      logger.error('Error creating Microsoft Calendar event', { error, userId });
      return null;
    }
  }

  /**
   * Update Google Calendar event
   */
  async updateGoogleCalendarEvent(
    userId: string,
    eventId: string,
    interviewSchedule: any
  ): Promise<boolean> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'GOOGLE');
      if (!integration) return false;

      this.googleOAuth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleOAuth2Client });

      const event = {
        summary: interviewSchedule.title,
        description: interviewSchedule.description || '',
        start: {
          dateTime: interviewSchedule.scheduledFor.toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        end: {
          dateTime: addMinutes(interviewSchedule.scheduledFor, interviewSchedule.duration).toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        location: interviewSchedule.location
      };

      await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event
      });

      return true;
    } catch (error) {
      logger.error('Error updating Google Calendar event', { error, userId });
      return false;
    }
  }

  /**
   * Update Microsoft Calendar event
   */
  async updateMicrosoftCalendarEvent(
    userId: string,
    eventId: string,
    interviewSchedule: any
  ): Promise<boolean> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'MICROSOFT');
      if (!integration) return false;

      const client = Client.init({
        authProvider: (done) => {
          done(null, integration.accessToken);
        }
      });

      const event = {
        subject: interviewSchedule.title,
        body: {
          contentType: 'HTML',
          content: interviewSchedule.description || ''
        },
        start: {
          dateTime: interviewSchedule.scheduledFor.toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        },
        end: {
          dateTime: addMinutes(interviewSchedule.scheduledFor, interviewSchedule.duration).toISOString(),
          timeZone: interviewSchedule.timezone || 'Africa/Johannesburg'
        }
      };

      await client
        .api(`/me/events/${eventId}`)
        .update(event);

      return true;
    } catch (error) {
      logger.error('Error updating Microsoft Calendar event', { error, userId });
      return false;
    }
  }

  /**
   * Delete Google Calendar event
   */
  async deleteGoogleCalendarEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'GOOGLE');
      if (!integration) return false;

      this.googleOAuth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleOAuth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      return true;
    } catch (error) {
      logger.error('Error deleting Google Calendar event', { error, userId });
      return false;
    }
  }

  /**
   * Delete Microsoft Calendar event
   */
  async deleteMicrosoftCalendarEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'MICROSOFT');
      if (!integration) return false;

      const client = Client.init({
        authProvider: (done) => {
          done(null, integration.accessToken);
        }
      });

      await client
        .api(`/me/events/${eventId}`)
        .delete();

      return true;
    } catch (error) {
      logger.error('Error deleting Microsoft Calendar event', { error, userId });
      return false;
    }
  }

  /**
   * Get user's free/busy times from Google Calendar
   */
  async getGoogleFreeBusy(
    userId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<any[]> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'GOOGLE');
      if (!integration) return [];

      this.googleOAuth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleOAuth2Client });

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: 'primary' }]
        }
      });

      const busyTimes = response.data.calendars?.primary?.busy || [];
      return busyTimes;
    } catch (error) {
      logger.error('Error getting Google free/busy', { error, userId });
      return [];
    }
  }

  /**
   * Get user's free/busy times from Microsoft Calendar
   */
  async getMicrosoftFreeBusy(
    userId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<any[]> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'MICROSOFT');
      if (!integration) return [];

      const client = Client.init({
        authProvider: (done) => {
          done(null, integration.accessToken);
        }
      });

      const response = await client
        .api('/me/calendar/getSchedule')
        .post({
          schedules: ['me'],
          startTime: {
            dateTime: timeMin.toISOString(),
            timeZone: 'UTC'
          },
          endTime: {
            dateTime: timeMax.toISOString(),
            timeZone: 'UTC'
          },
          availabilityViewInterval: 30
        });

      const schedule = response.value[0];
      const busyTimes = [];
      
      if (schedule.scheduleItems) {
        for (const item of schedule.scheduleItems) {
          if (item.status === 'busy') {
            busyTimes.push({
              start: item.start.dateTime,
              end: item.end.dateTime
            });
          }
        }
      }

      return busyTimes;
    } catch (error) {
      logger.error('Error getting Microsoft free/busy', { error, userId });
      return [];
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableTimeSlots(
    userId: string,
    provider: 'GOOGLE' | 'MICROSOFT',
    dateRange: { start: Date; end: Date },
    duration: number = 60
  ): Promise<any[]> {
    try {
      let busyTimes = [];

      if (provider === 'GOOGLE') {
        busyTimes = await this.getGoogleFreeBusy(userId, dateRange.start, dateRange.end);
      } else {
        busyTimes = await this.getMicrosoftFreeBusy(userId, dateRange.start, dateRange.end);
      }

      // Generate available time slots
      const availableSlots = [];
      const slotDuration = duration;
      const workingHoursStart = 9; // 9 AM
      const workingHoursEnd = 17;   // 5 PM

      let currentTime = new Date(dateRange.start);
      currentTime.setHours(workingHoursStart, 0, 0, 0);

      while (currentTime < dateRange.end) {
        const slotEnd = addMinutes(currentTime, slotDuration);
        
        // Check if within working hours
        if (currentTime.getHours() >= workingHoursStart && 
            slotEnd.getHours() <= workingHoursEnd &&
            currentTime.getDay() !== 0 && // Not Sunday
            currentTime.getDay() !== 6) { // Not Saturday
          
          // Check if slot conflicts with busy times
          const isAvailable = !busyTimes.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            return (currentTime >= busyStart && currentTime < busyEnd) ||
                   (slotEnd > busyStart && slotEnd <= busyEnd);
          });

          if (isAvailable) {
            availableSlots.push({
              start: currentTime.toISOString(),
              end: slotEnd.toISOString()
            });
          }
        }

        // Move to next slot
        currentTime = addMinutes(currentTime, 30); // 30-minute increments

        // If past working hours, move to next day
        if (currentTime.getHours() >= workingHoursEnd) {
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(workingHoursStart, 0, 0, 0);
        }
      }

      return availableSlots;
    } catch (error) {
      logger.error('Error getting available time slots', { error, userId });
      return [];
    }
  }

  /**
   * Disconnect calendar integration
   */
  async disconnectCalendar(userId: string, provider: 'GOOGLE' | 'MICROSOFT'): Promise<void> {
    try {
      await prisma.calendarIntegration.update({
        where: {
          userId_provider: {
            userId,
            provider
          }
        },
        data: {
          isActive: false,
          disconnectedAt: new Date()
        }
      });

      logger.info('Calendar disconnected', { userId, provider });
    } catch (error) {
      logger.error('Error disconnecting calendar', { error, userId, provider });
      throw error;
    }
  }

  /**
   * Get calendar integration status
   */
  async getIntegrationStatus(userId: string): Promise<any> {
    try {
      const integrations = await prisma.calendarIntegration.findMany({
        where: { userId },
        select: {
          provider: true,
          isActive: true,
          connectedAt: true,
          lastSyncedAt: true
        }
      });

      return {
        google: integrations.find(i => i.provider === 'GOOGLE') || null,
        microsoft: integrations.find(i => i.provider === 'MICROSOFT') || null
      };
    } catch (error) {
      logger.error('Error getting integration status', { error, userId });
      throw error;
    }
  }

  // Private helper methods

  private async getCalendarIntegration(userId: string, provider: 'GOOGLE' | 'MICROSOFT'): Promise<any> {
    return prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider
        }
      }
    });
  }

  private async refreshGoogleToken(userId: string): Promise<void> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'GOOGLE');
      if (!integration || !integration.refreshToken) {
        throw new Error('No refresh token available');
      }

      this.googleOAuth2Client.setCredentials({
        refresh_token: integration.refreshToken
      });

      const { credentials } = await this.googleOAuth2Client.refreshAccessToken();

      await prisma.calendarIntegration.update({
        where: {
          userId_provider: {
            userId,
            provider: 'GOOGLE'
          }
        },
        data: {
          accessToken: credentials.access_token,
          expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000)
        }
      });
    } catch (error) {
      logger.error('Error refreshing Google token', { error, userId });
      throw error;
    }
  }

  private async refreshMicrosoftToken(userId: string): Promise<void> {
    try {
      const integration = await this.getCalendarIntegration(userId, 'MICROSOFT');
      if (!integration || !integration.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: config.MICROSOFT_CLIENT_ID,
          client_secret: config.MICROSOFT_CLIENT_SECRET,
          refresh_token: integration.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const tokens = await response.json();

      if (tokens.error) {
        throw new Error(tokens.error_description);
      }

      await prisma.calendarIntegration.update({
        where: {
          userId_provider: {
            userId,
            provider: 'MICROSOFT'
          }
        },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || integration.refreshToken,
          expiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
        }
      });
    } catch (error) {
      logger.error('Error refreshing Microsoft token', { error, userId });
      throw error;
    }
  }
}

export const calendarIntegrationService = new CalendarIntegrationService();
