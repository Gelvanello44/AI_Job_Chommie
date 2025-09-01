import { Router } from 'express';
import { NotificationsController } from '../controllers/remaining-controllers.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const notificationsController = new NotificationsController();

// Rate limiting for notification operations
const notificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: {
    success: false,
    error: 'Too many notification requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook endpoint (no authentication required for external services)
router.post('/webhook', notificationsController.handleWebhook);
router.post('/webhook/:provider', notificationsController.handleProviderWebhook);

// Webhook configuration (requires authentication)
router.get('/webhook/config', authenticate, notificationsController.getWebhookConfig);
router.put('/webhook/config', authenticate, notificationsController.updateWebhookConfig);
router.post('/webhook/test', authenticate, notificationsController.testWebhook);
router.get('/webhook/logs', authenticate, notificationsController.getWebhookLogs);

// All other notification routes require authentication
router.use(authenticate);

// User notifications
router.get('/', notificationLimiter, notificationsController.getUserNotifications);
router.get('/unread', notificationsController.getUnreadNotifications);
router.get('/count', notificationsController.getNotificationCount);
router.get('/:id', notificationsController.getNotificationById);

// Notification management
router.put('/:id/read', notificationsController.markAsRead);
router.put('/read-all', notificationsController.markAllAsRead);
router.delete('/:id', notificationsController.deleteNotification);
router.delete('/bulk', notificationsController.bulkDeleteNotifications);

// Notification preferences
router.get('/preferences', notificationsController.getPreferences);
router.put('/preferences', notificationsController.updatePreferences);
router.get('/preferences/channels', notificationsController.getAvailableChannels);

// Subscription management
router.get('/subscriptions', notificationsController.getSubscriptions);
router.post('/subscribe/:type', notificationsController.subscribe);
router.delete('/unsubscribe/:type', notificationsController.unsubscribe);
router.post('/unsubscribe-all', notificationsController.unsubscribeAll);

// Push notifications
router.post('/push/register', notificationsController.registerPushToken);
router.delete('/push/unregister', notificationsController.unregisterPushToken);
router.post('/push/test', notificationsController.sendTestPush);

// Email notifications
router.get('/email/templates', notificationsController.getEmailTemplates);
router.put('/email/frequency', notificationsController.updateEmailFrequency);
router.post('/email/digest', notificationsController.sendEmailDigest);

// SMS notifications
router.post('/sms/verify', notificationsController.verifySmsNumber);
router.put('/sms/number', notificationsController.updateSmsNumber);
router.post('/sms/test', notificationsController.sendTestSms);

// In-app notifications
router.get('/in-app/recent', notificationsController.getRecentInAppNotifications);
router.put('/in-app/settings', notificationsController.updateInAppSettings);

// Notification history
router.get('/history', notificationsController.getNotificationHistory);
router.get('/history/export', notificationsController.exportNotificationHistory);

// Admin routes
router.post('/admin/broadcast', authenticate, notificationLimiter, notificationsController.broadcastNotification);
router.post('/admin/targeted', authenticate, notificationLimiter, notificationsController.sendTargetedNotification);
router.get('/admin/analytics', authenticate, notificationsController.getNotificationAnalytics);

export default router;
