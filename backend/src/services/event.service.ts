import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import calendarService from './calendar.service';
import notificationService from './notification.service';

const prisma = new PrismaClient();

// Event Schema
const EventSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['networking', 'career_fair', 'workshop', 'webinar', 'conference', 'meetup']),
  category: z.enum(['executive', 'professional', 'industry', 'general']),
  location: z.object({
    venue: z.string().optional(),
    address: z.string().optional(),
    city: z.string(),
    province: z.string(),
    country: z.string().default('South Africa'),
    isVirtual: z.boolean().default(false),
    virtualLink: z.string().url().optional()
  }),
  dateTime: z.date(),
  endDateTime: z.date(),
  organizer: z.string(),
  industry: z.array(z.string()),
  targetAudience: z.array(z.string()),
  capacity: z.number().optional(),
  registrationUrl: z.string().url().optional(),
  cost: z.object({
    amount: z.number().default(0),
    currency: z.string().default('ZAR'),
    isFree: z.boolean()
  }),
  tags: z.array(z.string()),
  featured: z.boolean().default(false),
  executiveOnly: z.boolean().default(false)
});

// RSVP Schema
const RSVPSchema = z.object({
  userId: z.string(),
  eventId: z.string(),
  status: z.enum(['attending', 'maybe', 'not_attending', 'waitlist']),
  registeredAt: z.date().default(() => new Date()),
  notes: z.string().optional(),
  reminderSet: z.boolean().default(true),
  calendarEventId: z.string().optional()
});

type Event = z.infer<typeof EventSchema>;
type RSVP = z.infer<typeof RSVPSchema>;

export class EventService {
  /**
   * Create a new networking event
   */
  async createEvent(eventData: Partial<Event>): Promise<Event> {
    try {
      const validatedEvent = EventSchema.parse(eventData);
      
      // Store event in database
      const event = await prisma.networkingEvent.create({
        data: {
          ...validatedEvent,
          location: JSON.stringify(validatedEvent.location),
          cost: JSON.stringify(validatedEvent.cost),
          industry: JSON.stringify(validatedEvent.industry),
          targetAudience: JSON.stringify(validatedEvent.targetAudience),
          tags: JSON.stringify(validatedEvent.tags)
        }
      });

      // Send notifications to relevant users
      await this.notifyUsersAboutEvent(event);

      return this.formatEvent(event);
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create networking event');
    }
  }

  /**
   * Get upcoming networking events
   */
  async getUpcomingEvents(filters?: {
    userId?: string;
    category?: string;
    industry?: string;
    province?: string;
    executiveOnly?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Event[]> {
    try {
      const where: any = {
        dateTime: {
          gte: filters?.startDate || new Date()
        }
      };

      if (filters?.endDate) {
        where.dateTime.lte = filters.endDate;
      }

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.executiveOnly !== undefined) {
        where.executiveOnly = filters.executiveOnly;
      }

      const events = await prisma.networkingEvent.findMany({
        where,
        orderBy: { dateTime: 'asc' },
        take: 50
      });

      // Filter by province and industry if provided
      let filteredEvents = events;
      
      if (filters?.province) {
        filteredEvents = filteredEvents.filter(event => {
          const location = JSON.parse(event.location as string);
          return location.province === filters.province;
        });
      }

      if (filters?.industry) {
        filteredEvents = filteredEvents.filter(event => {
          const industries = JSON.parse(event.industry as string);
          return industries.includes(filters.industry);
        });
      }

      return filteredEvents.map(this.formatEvent);
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      throw new Error('Failed to get upcoming events');
    }
  }

  /**
   * Get curated events for executive users
   */
  async getCuratedExecutiveEvents(userId: string): Promise<Event[]> {
    try {
      // Get user profile to understand preferences
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        include: { user: true }
      });

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Get executive-focused events
      const events = await this.getUpcomingEvents({
        executiveOnly: true,
        province: userProfile.location || undefined,
        startDate: new Date(),
        endDate: addDays(new Date(), 90) // Next 3 months
      });

      // Sort by relevance (featured first, then by date)
      return events.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      });
    } catch (error) {
      console.error('Error getting curated executive events:', error);
      throw new Error('Failed to get curated events');
    }
  }

  /**
   * RSVP to an event
   */
  async rsvpToEvent(rsvpData: RSVP): Promise<any> {
    try {
      const validatedRSVP = RSVPSchema.parse(rsvpData);
      
      // Check if event exists and has capacity
      const event = await prisma.networkingEvent.findUnique({
        where: { id: validatedRSVP.eventId }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Check existing RSVP
      const existingRSVP = await prisma.eventRSVP.findUnique({
        where: {
          userId_eventId: {
            userId: validatedRSVP.userId,
            eventId: validatedRSVP.eventId
          }
        }
      });

      // Create or update RSVP
      const rsvp = existingRSVP
        ? await prisma.eventRSVP.update({
            where: { id: existingRSVP.id },
            data: validatedRSVP
          })
        : await prisma.eventRSVP.create({
            data: validatedRSVP
          });

      // Add to calendar if attending
      if (validatedRSVP.status === 'attending') {
        const calendarEvent = await this.addEventToCalendar(
          validatedRSVP.userId,
          this.formatEvent(event)
        );
        
        if (calendarEvent) {
          await prisma.eventRSVP.update({
            where: { id: rsvp.id },
            data: { calendarEventId: calendarEvent.id }
          });
        }

        // Set up reminders
        if (validatedRSVP.reminderSet) {
          await this.scheduleEventReminders(validatedRSVP.userId, this.formatEvent(event));
        }
      }

      return {
        success: true,
        rsvp,
        message: `Successfully RSVP'd as ${validatedRSVP.status}`
      };
    } catch (error) {
      console.error('Error RSVPing to event:', error);
      throw new Error('Failed to RSVP to event');
    }
  }

  /**
   * Add event to user's calendar
   */
  private async addEventToCalendar(userId: string, event: Event): Promise<any> {
    try {
      const location = event.location.isVirtual
        ? event.location.virtualLink
        : `${event.location.venue}, ${event.location.address}, ${event.location.city}`;

      return await calendarService.createEvent(userId, {
        summary: event.title,
        description: event.description,
        location,
        start: {
          dateTime: event.dateTime.toISOString(),
          timeZone: 'Africa/Johannesburg'
        },
        end: {
          dateTime: event.endDateTime.toISOString(),
          timeZone: 'Africa/Johannesburg'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 } // 1 hour before
          ]
        }
      });
    } catch (error) {
      console.error('Error adding event to calendar:', error);
      return null;
    }
  }

  /**
   * Schedule event reminders
   */
  private async scheduleEventReminders(userId: string, event: Event): Promise<void> {
    try {
      const eventDate = new Date(event.dateTime);
      
      // Schedule reminders at different intervals
      const reminderIntervals = [
        { days: 7, message: 'Event reminder: 1 week until' },
        { days: 1, message: 'Event tomorrow:' },
        { hours: 2, message: 'Event starting soon:' }
      ];

      for (const interval of reminderIntervals) {
        let reminderDate: Date;
        
        if (interval.days) {
          reminderDate = new Date(eventDate);
          reminderDate.setDate(reminderDate.getDate() - interval.days);
        } else if (interval.hours) {
          reminderDate = new Date(eventDate);
          reminderDate.setHours(reminderDate.getHours() - interval.hours);
        } else {
          continue;
        }

        // Only schedule if reminder date is in the future
        if (reminderDate > new Date()) {
          await prisma.eventReminder.create({
            data: {
              userId,
              eventId: event.id!,
              reminderDate,
              message: `${interval.message} ${event.title}`,
              sent: false
            }
          });
        }
      }
    } catch (error) {
      console.error('Error scheduling event reminders:', error);
    }
  }

  /**
   * Get user's RSVPd events
   */
  async getUserEvents(userId: string, status?: string): Promise<any[]> {
    try {
      const where: any = { userId };
      
      if (status) {
        where.status = status;
      }

      const rsvps = await prisma.eventRSVP.findMany({
        where,
        include: {
          event: true
        },
        orderBy: {
          event: {
            dateTime: 'asc'
          }
        }
      });

      return rsvps.map(rsvp => ({
        rsvp: {
          id: rsvp.id,
          status: rsvp.status,
          registeredAt: rsvp.registeredAt,
          notes: rsvp.notes
        },
        event: this.formatEvent(rsvp.event)
      }));
    } catch (error) {
      console.error('Error getting user events:', error);
      throw new Error('Failed to get user events');
    }
  }

  /**
   * Send follow-up after event
   */
  async sendEventFollowUp(eventId: string): Promise<void> {
    try {
      const event = await prisma.networkingEvent.findUnique({
        where: { id: eventId }
      });

      if (!event) return;

      // Get all attendees
      const attendees = await prisma.eventRSVP.findMany({
        where: {
          eventId,
          status: 'attending'
        },
        include: {
          user: true
        }
      });

      // Send follow-up to each attendee
      for (const attendee of attendees) {
        await notificationService.sendNotification({
          userId: attendee.userId,
          type: 'event_followup',
          title: `Thank you for attending ${event.title}`,
          message: `We hope you enjoyed the event. Don't forget to connect with the people you met and follow up on any opportunities discussed.`,
          data: {
            eventId: event.id,
            eventTitle: event.title
          }
        });
      }
    } catch (error) {
      console.error('Error sending event follow-up:', error);
    }
  }

  /**
   * Notify users about new event
   */
  private async notifyUsersAboutEvent(event: any): Promise<void> {
    try {
      // Get users who match the event criteria
      const targetUsers = await this.getTargetUsersForEvent(event);

      for (const user of targetUsers) {
        await notificationService.sendNotification({
          userId: user.id,
          type: 'new_event',
          title: 'New Networking Event',
          message: `${event.title} - ${format(new Date(event.dateTime), 'PPP')}`,
          data: {
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.dateTime
          }
        });
      }
    } catch (error) {
      console.error('Error notifying users about event:', error);
    }
  }

  /**
   * Get target users for event notifications
   */
  private async getTargetUsersForEvent(event: any): Promise<any[]> {
    try {
      const location = JSON.parse(event.location as string);
      const industries = JSON.parse(event.industry as string);

      // Find users based on location and industry preferences
      const users = await prisma.user.findMany({
        where: {
          profile: {
            location: location.province,
            // Additional filtering can be added based on user preferences
          }
        },
        take: 100 // Limit to prevent mass notifications
      });

      return users;
    } catch (error) {
      console.error('Error getting target users:', error);
      return [];
    }
  }

  /**
   * Format event data
   */
  private formatEvent(event: any): Event {
    return {
      ...event,
      location: typeof event.location === 'string' ? JSON.parse(event.location) : event.location,
      cost: typeof event.cost === 'string' ? JSON.parse(event.cost) : event.cost,
      industry: typeof event.industry === 'string' ? JSON.parse(event.industry) : event.industry,
      targetAudience: typeof event.targetAudience === 'string' ? JSON.parse(event.targetAudience) : event.targetAudience,
      tags: typeof event.tags === 'string' ? JSON.parse(event.tags) : event.tags
    };
  }

  /**
   * Search events
   */
  async searchEvents(query: string, filters?: any): Promise<Event[]> {
    try {
      const events = await prisma.networkingEvent.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { organizer: { contains: query, mode: 'insensitive' } }
          ],
          dateTime: {
            gte: new Date()
          }
        },
        orderBy: { dateTime: 'asc' },
        take: 20
      });

      return events.map(this.formatEvent);
    } catch (error) {
      console.error('Error searching events:', error);
      throw new Error('Failed to search events');
    }
  }
}

export default new EventService();
