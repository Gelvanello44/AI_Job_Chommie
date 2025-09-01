# DNS Configuration & Deployment Strategy Guide

## Recommended Deployment Approach

Before pointing your production domain `aijobchommie.co.za`, we strongly recommend following this phased approach to ensure everything works perfectly:

## Phase 1: Local Testing (Current Stage)
**Duration: 1-2 days**

### Steps to Complete:

1. **Run Local Tests**
   ```bash
   # Make the test script executable
   chmod +x scripts/test-local.sh
   
   # Run the comprehensive test suite
   ./scripts/test-local.sh
   ```

2. **Local Docker Testing**
   ```bash
   # Create a local test environment file
   cp .env.production.example .env.local
   # Edit .env.local with test values
   
   # Run the full stack locally
   docker-compose -f docker-compose.prod.yml up
   
   # Test at: http://localhost
   ```

3. **Verify Critical Features**
   - User registration and login
   - Job search functionality
   - Application submission
   - Payment flow (test mode)
   - AI features (Hugging Face integration)
   - Email notifications

## Phase 2: Staging Deployment
**Duration: 2-3 days**

### Recommended Setup:

1. **Use a Subdomain for Staging**
   ```
   staging.aijobchommie.co.za
   ```

2. **Configure Staging DNS in Cloudflare:**
   - Type: A Record
   - Name: staging
   - Content: [Your Server IP]
   - Proxy: Enabled (Orange Cloud)
   - TTL: Auto

3. **Deploy to Staging Server**
   ```bash
   # SSH to your staging server
   ssh user@staging-server-ip
   
   # Clone repository
   git clone https://github.com/yourusername/ai-job-chommie.git
   cd ai-job-chommie
   
   # Setup staging environment
   cp .env.production.example .env.staging
   # Configure with staging values
   
   # Deploy
   ./scripts/deploy.sh staging
   ```

4. **Staging Testing Checklist:**
   -  SSL certificate working (Let's Encrypt via Caddy)
   -  All pages loading correctly
   -  Database connections working
   -  Redis caching functional
   -  Email sending (test emails)
   -  Payment gateway (test mode)
   -  AI features responding
   -  Mobile responsiveness
   -  Performance metrics acceptable

## Phase 3: Production DNS Configuration
**Only after successful staging tests**

### Cloudflare DNS Settings:

#### Primary Domain Configuration:
```yaml
# A Records (Your Server)
Type: A
Name: @
Content: [Your Production Server IP]
Proxy: Enabled
TTL: Auto

Type: A
Name: www
Content: [Your Production Server IP]
Proxy: Enabled
TTL: Auto

# Alternative: CNAME for www (if using)
Type: CNAME
Name: www
Content: aijobchommie.co.za
Proxy: Enabled
TTL: Auto
```

#### API Subdomain (Optional but Recommended):
```yaml
Type: A
Name: api
Content: [Your Server IP]
Proxy: Enabled
TTL: Auto
```

#### Additional Subdomains:
```yaml
# Status Page
Type: A
Name: status
Content: [Status Page Server IP]
Proxy: Enabled
TTL: Auto

# CDN/Assets (if separate)
Type: CNAME
Name: cdn
Content: [CDN Provider URL]
Proxy: Disabled
TTL: Auto
```

### Cloudflare Page Rules (Free Plan):

1. **Force HTTPS:**
   - URL: `http://*aijobchommie.co.za/*`
   - Setting: Always Use HTTPS

2. **WWW Redirect:**
   - URL: `aijobchommie.co.za/*`
   - Setting: Forwarding URL (301)
   - Destination: `https://www.aijobchommie.co.za/$1`

3. **Cache Static Assets:**
   - URL: `*aijobchommie.co.za/*.{jpg,jpeg,png,gif,css,js,woff,woff2}`
   - Setting: Cache Level - Cache Everything
   - Setting: Edge Cache TTL - 1 month

### Cloudflare Security Settings:

1. **SSL/TLS Configuration:**
   - SSL/TLS encryption mode: Full (strict)
   - Always Use HTTPS: ON
   - Automatic HTTPS Rewrites: ON
   - Minimum TLS Version: 1.2

2. **Security Settings:**
   - Security Level: Medium
   - Challenge Passage: 30 minutes
   - Browser Integrity Check: ON
   - Privacy Pass Support: ON

3. **Firewall Rules:**
   ```
   # Block countries (if needed)
   (ip.geoip.country in {"CN" "RU" "KP"}) → Block
   
   # Rate limiting for API
   (http.request.uri.path contains "/api" and rate() > 100) → Challenge
   
   # Protect admin routes
   (http.request.uri.path contains "/admin") → Challenge
   ```

4. **DDoS Protection:**
   - Enable "I'm Under Attack" mode if needed
   - Rate Limiting: Configure for critical endpoints

### Cloudflare Performance Settings:

1. **Speed Optimization:**
   - Auto Minify: JavaScript, CSS, HTML
   - Brotli: ON
   - Rocket Loader: OFF (can break some JS)
   - Mirage: ON (if on Pro plan)
   - Polish: Lossy (if on Pro plan)

2. **Caching:**
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours
   - Always Online: ON

## Phase 4: Production Deployment

### Pre-Deployment Checklist:

1. **Environment Variables Ready:**
   - [ ] Database credentials
   - [ ] JWT secrets
   - [ ] Hugging Face API token
   - [ ] Email service credentials
   - [ ] Payment gateway keys
   - [ ] Sentry DSN

2. **Server Prepared:**
   - [ ] Ubuntu 22.04 LTS or similar
   - [ ] Docker installed
   - [ ] Docker Compose installed
   - [ ] Git configured
   - [ ] Firewall configured (ports 80, 443 open)
   - [ ] Swap space configured (minimum 2GB)

3. **Backup Strategy:**
   - [ ] Automated database backups configured
   - [ ] Backup storage (S3 or similar) set up
   - [ ] Restore procedure tested

### Deployment Commands:

```bash
# On your production server
cd /opt
sudo git clone https://github.com/yourusername/ai-job-chommie.git
cd ai-job-chommie

# Setup production environment
sudo cp .env.production.example .env.production
sudo nano .env.production  # Add your production values

# Initial deployment
sudo chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh production

# Verify deployment
curl https://www.aijobchommie.co.za/health
```

## Phase 5: Post-Deployment Verification

### Critical Checks:

1. **Facebook Domain Verification:**
   - Visit: https://business.facebook.com/settings/owned-domains
   - Click "Verify Domain" for aijobchommie.co.za
   - Should show as verified within 72 hours

2. **SSL Certificate:**
   - Check: https://www.ssllabs.com/ssltest/analyze.html?d=aijobchommie.co.za
   - Should get A+ rating

3. **Performance:**
   - Test: https://gtmetrix.com
   - Test: https://pagespeed.web.dev
   - Target: 90+ score

4. **Security Headers:**
   - Check: https://securityheaders.com
   - Should get A+ rating

5. **Monitoring Setup:**
   - Configure uptime monitoring (UptimeRobot, Pingdom)
   - Set up error tracking (Sentry already configured)
   - Enable Google Analytics
   - Configure server monitoring

## Recommended Timeline:

```
Day 1-2:  Local testing and fixes
Day 3-4:  Staging deployment and testing
Day 5:    Production server setup
Day 6:    DNS configuration (staging first)
Day 7:    Production deployment
Day 8:    Monitoring and optimization
```

## Emergency Rollback Plan:

If issues occur after pointing the domain:

1. **Quick DNS Rollback:**
   - Change A records to staging server
   - Or enable Cloudflare "Under Maintenance" page

2. **Application Rollback:**
   ```bash
   cd /opt/ai-job-chommie
   git reset --hard HEAD~1
   docker-compose -f docker-compose.prod.yml up -d --force-recreate
   ```

3. **Database Rollback:**
   ```bash
   # Restore from latest backup
   docker exec -i aijc-postgres psql -U aijc aijobchommie < /backups/latest.sql
   ```

## Support Contacts:

- **Cloudflare Support:** https://support.cloudflare.com
- **Domain Registrar:** Check your provider
- **Server Provider:** Your hosting provider's support

## Final Notes:

**Do NOT rush to production!** The staging phase is crucial for identifying issues without affecting your brand reputation. A broken production site is worse than launching a week later with everything working perfectly.

When you're ready and have completed all testing phases, the DNS changes will propagate globally within 1-48 hours (usually much faster with Cloudflare).

Good luck with your deployment! The platform is technically ready, but thorough testing ensures a smooth launch.
