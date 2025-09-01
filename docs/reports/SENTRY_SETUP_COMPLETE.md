# Sentry Setup Complete - AI Job Chommie Platform

## Overview

This document provides verification and usage instructions for the comprehensive Sentry error tracking setup across all three services in the AI Job Chommie platform.

## Services Configured

 **React Frontend** (`ai-job-chommie-landing-source/`)
 **Node.js Backend** (`ai-job-chommie-backend/`)
 **Python Scraping Service** (`job-scraping-service/`)

## Quick Start Verification

### 1. React Frontend Verification

**Location**: `ai-job-chommie-landing-source/`

**Environment Variables Set**:
- `.env`: Development configuration
- `.env.production`: Production configuration

**Test the Setup**:
1. Start the React development server:
   ```bash
   cd ai-job-chommie-landing-source
   npm run dev
   ```

2. Look for the **Sentry Test Button** in the bottom-right corner (development only)

3. Click the test button to trigger a test error

4. Check your Sentry dashboard for the error report

**Files Created**:
- `src/lib/sentry.ts` - Sentry configuration and initialization
- `src/lib/errorTracking.ts` - Utility functions for error tracking
- `src/components/SentryTestButton.tsx` - Test button (development only)
- `src/components/ErrorFallback.tsx` - Error boundary fallback component

### 2. Node.js Backend Verification

**Location**: `ai-job-chommie-backend/`

**Environment Variable Required**:
- `SENTRY_DSN=your-nodejs-sentry-dsn` (add to your `.env` file)

**Test the Setup**:
1. Set your Sentry DSN in the `.env` file
2. Start the Node.js server:
   ```bash
   cd ai-job-chommie-backend
   npm run dev
   ```

3. Visit the Sentry debug endpoint: `http://localhost:5000/sentry-debug`

4. Check your Sentry dashboard for the error report

**Files Created/Modified**:
- `src/config/sentry.ts` - Sentry configuration and utilities
- `src/server.ts` - Sentry initialization (modified)
- `src/app.ts` - Sentry middleware integration (modified)

### 3. Python Scraping Service Verification

**Location**: `job-scraping-service/`

**Environment Variables Required**:
- `SENTRY_DSN=your-python-sentry-dsn`
- `ENVIRONMENT=development`
- `APP_VERSION=1.0.0`

**Test the Setup**:
1. Install Sentry SDK for Python:
   ```bash
   cd job-scraping-service
   pip install sentry-sdk[fastapi]
   ```

2. Set your environment variables in `.env` file

3. Start the FastAPI server:
   ```bash
   python src/main.py
   ```

4. Visit the Sentry debug endpoint: `http://localhost:8000/sentry-debug`

5. Check your Sentry dashboard for the error report

**Files Created/Modified**:
- `src/config/sentry.py` - Comprehensive Sentry configuration
- `src/main.py` - FastAPI application with Sentry integration
- `.env.example` - Updated with Sentry configuration (modified)

## Sentry Project Setup

You need to create **three separate projects** in your Sentry dashboard:

### Project 1: React Frontend (Already Created)
- **DSN**: `https://a4b25082635f271a7a22d7fdb825e152@o4509903212904448.ingest.de.sentry.io/4509903811510352`
- **Platform**: React
- **Name**: AI Job Chommie Frontend

### Project 2: Node.js Backend
- **Platform**: Node.js
- **Name**: AI Job Chommie Backend
- **Action**: Create new project in Sentry dashboard and copy DSN to backend `.env` file

### Project 3: Python Scraping Service
- **Platform**: Python
- **Name**: AI Job Chommie Scraping Service  
- **Action**: Create new project in Sentry dashboard and copy DSN to Python `.env` file

## Configuration Details

### React Frontend Features
-  Session replay recording
-  Performance monitoring
-  Error boundary integration
-  User context tracking
-  Custom breadcrumbs
-  Error filtering for production
-  Test button for development

### Node.js Backend Features
-  Express middleware integration
-  Performance monitoring with profiling
-  Request/response tracking
-  Database integration monitoring
-  Custom error capturing utilities
-  User context management
-  Error filtering for common issues

### Python Scraping Service Features
-  FastAPI integration
-  Async operation support
-  Scraping-specific error tracking
-  Performance metrics capture
-  Context managers for operations
-  Celery/Redis integration
-  Custom error categorization

## Environment Configuration

### Development vs Production Settings

**Development**:
- Higher sample rates (100% for traces and profiles)
- Test endpoints enabled
- Detailed error information
- Debug buttons visible

**Production**:
- Lower sample rates (10% for traces and profiles)
- Test endpoints disabled
- Filtered error reporting
- Sensitive data protection

## Usage Examples

### React Frontend Error Tracking
```typescript
import { trackError, setUserContext, addBreadcrumb } from '@/lib/errorTracking';

// Set user context
setUserContext({
  id: 'user123',
  email: 'user@example.com',
  username: 'john_doe'
});

// Add breadcrumb
addBreadcrumb('User clicked search', 'ui', { query: 'software engineer' });

// Track error with context
try {
  // Some operation
} catch (error) {
  trackError(error, { component: 'JobSearch', action: 'search' });
}
```

### Node.js Backend Error Tracking
```typescript
import { captureError, setUserContext, addBreadcrumb } from './config/sentry';

// In your route handlers
app.post('/api/jobs', async (req, res) => {
  try {
    setUserContext({ id: req.user.id, email: req.user.email });
    addBreadcrumb('Job search initiated', 'api');
    
    // Your logic here
  } catch (error) {
    captureError(error, { endpoint: '/api/jobs' }, req.user);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Python Scraping Service Error Tracking
```python
from src.config.sentry import capture_scraping_error, SentryScrapingContext

# Using context manager
with SentryScrapingContext('https://example.com/jobs', 'indeed') as ctx:
    # Your scraping logic here
    jobs = scrape_jobs_from_site()

# Manual error tracking
try:
    process_job_data(job_data)
except Exception as e:
    capture_scraping_error(
        e,
        context={'job_id': job_id, 'processing_stage': 'data_cleaning'},
        url=job_url,
        scraper_type='indeed'
    )
```

## Monitoring and Alerts

### Key Metrics to Monitor
- Error rates per service
- Performance metrics (response times)
- User satisfaction scores
- Critical error patterns
- Service availability

### Recommended Alerts
1. **High Error Rate**: > 5% error rate in 5 minutes
2. **Performance Degradation**: P95 response time > 2 seconds
3. **Service Down**: No transactions for 2 minutes
4. **Critical Errors**: Any error tagged as 'critical'

## Troubleshooting

### Common Issues

**React Frontend**:
- **Issue**: Sentry not initialized
- **Solution**: Check that `initSentry()` is called in `main.jsx` before other imports

**Node.js Backend**:
- **Issue**: No error reports
- **Solution**: Ensure `SENTRY_DSN` is set and Sentry initialization is before other imports

**Python Service**:
- **Issue**: Import errors
- **Solution**: Install sentry-sdk with FastAPI integration: `pip install sentry-sdk[fastapi]`

### Debug Checklist
1.  Verify DSN configuration in environment variables
2.  Check Sentry initialization order (must be first)
3.  Confirm network access to Sentry endpoints
4.  Test with debug endpoints
5.  Check Sentry dashboard project settings

## Security Considerations

### Data Protection
- Sensitive data is filtered before sending to Sentry
- User PII is handled according to POPIA compliance
- Production environments use reduced sampling rates
- Custom beforeSend filters protect sensitive information

### Access Control
- Separate Sentry projects for each service
- Role-based access to Sentry dashboard
- Environment-based configuration segregation

## Next Steps

1. **Create Sentry Projects**: Set up the two remaining Sentry projects for backend and scraping service
2. **Configure DSNs**: Add the DSN values to your environment files
3. **Test Integration**: Use the provided test endpoints to verify functionality
4. **Set Up Alerts**: Configure alerts for critical errors and performance issues
5. **Monitor Usage**: Review error patterns and adjust sampling rates if needed

## Support

For issues with this Sentry setup:
1. Check the troubleshooting section above
2. Verify environment configuration
3. Test with debug endpoints
4. Review Sentry documentation for specific integrations

## Files Reference

### React Frontend
- Environment: `.env`, `.env.production`
- Configuration: `src/lib/sentry.ts`
- Utilities: `src/lib/errorTracking.ts`
- Components: `src/components/SentryTestButton.tsx`, `src/components/ErrorFallback.tsx`
- Integration: `src/main.jsx`, `src/App.jsx`

### Node.js Backend
- Environment: `.env` (add SENTRY_DSN)
- Configuration: `src/config/sentry.ts`
- Integration: `src/server.ts`, `src/app.ts`

### Python Scraping Service  
- Environment: `.env` (add SENTRY_DSN, ENVIRONMENT, APP_VERSION)
- Configuration: `src/config/sentry.py`
- Integration: `src/main.py`

---

**Setup Status**:  Complete
**Test Status**: Ready for verification
**Production Ready**: Yes (after DSN configuration)
