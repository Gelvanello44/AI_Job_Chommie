# AI Job Chommie Production Deployment Guide

##  Overview

This guide provides comprehensive instructions for deploying AI Job Chommie in a production environment with unlimited local AI inference capabilities.

##  Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or Windows Server 2019+
- **CPU**: Intel i3 or better with hyperthreading (8+ threads recommended)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 50GB free space
- **Python**: 3.8 or higher
- **Node.js**: 14.x or higher
- **Redis**: 6.x or higher

### Required Software
```bash
# Python dependencies
pip install -r requirements.txt

# Node.js dependencies (for backend)
cd ai-job-chommie-backend && npm install

# Redis (Ubuntu)
sudo apt-get install redis-server

# Redis (Windows)
# Download from https://github.com/microsoftarchive/redis/releases
```

##  Architecture Overview

```

                   Production Launcher                        
                  (production_launcher.py)                    

                       
        
                                     
           
 Service Manager            Deployment Mgr 
                                           
           
                                     
           
   Services:                   Models:     
 - Backend API              - Embeddings   
 - Model API                - NER          
 - Redis                    - Classification
 - Monitoring                              
           
```

##  Configuration

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_job_chommie

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_ACCESS_SECRET=your-64-character-secret-key-here
JWT_REFRESH_SECRET=your-64-character-refresh-secret-here
ADMIN_API_KEY=your-admin-api-key-minimum-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key

# Optional
SENTRY_DSN=your-sentry-dsn-for-error-tracking
```

### 2. Deployment Configuration

The main configuration is in `deployment_config.yaml`:

```yaml
application:
  name: ai-job-chommie
  version: 1.0.0
  environment: production

server:
  host: 0.0.0.0
  port: 5000
  workers: 4

models:
  embeddings:
    name: sentence-transformers/all-MiniLM-L6-v2
    batch_size: 32
    optimization_level: O2

# See full configuration in deployment_config.yaml
```

##  Deployment Steps

### Step 1: Pre-deployment Validation

```bash
# Run security validation
python security_validator.py

# Check the report in security_reports/
```

### Step 2: Download Models (First Time Only)

```bash
# Download required models
python download_models.py

# This will download and cache all required models locally
```

### Step 3: Start Production Deployment

```bash
# Full production deployment
python production_launcher.py

# Development mode (skip security checks)
python production_launcher.py --skip-security

# Dry run (pre-flight checks only)
python production_launcher.py --dry-run
```

### Step 4: Verify Deployment

Check the deployment status:
- Model API: http://localhost:5000/health
- Backend API: http://localhost:3001/api/v1/health
- Monitoring Dashboard: http://localhost:3002

##  Service Management

### Managing Individual Services

```bash
# Using service manager CLI
python service_manager.py status
python service_manager.py stop --service redis
python service_manager.py start --service backend_api
python service_manager.py restart --service model_inference
```

### Service Configuration

Services are configured in `services_config.yaml` or through default configurations in `service_manager.py`.

##  Monitoring and Logging

### Log Files

All logs are stored in the `logs/` directory:
- `app.log` - Main application log
- `error.log` - Error logs only
- `access.log` - API access logs
- `security.log` - Security events
- `performance.log` - Performance metrics

### Monitoring Dashboard

Access the monitoring dashboard at http://localhost:3002

Features:
- Real-time system metrics
- Model performance statistics
- API request/response times
- Error rates and alerts

### Metrics Collection

Metrics are collected automatically and can be exported to:
- Prometheus (if configured)
- Custom monitoring systems
- Log aggregation services

##  Security Features

### Built-in Security

1. **Authentication**: JWT-based authentication
2. **Rate Limiting**: Configurable per-endpoint limits
3. **Input Validation**: Automatic request validation
4. **CORS**: Configurable CORS policies
5. **Helmet**: Security headers enabled

### Security Checklist

- [ ] Change all default passwords and API keys
- [ ] Enable HTTPS in production
- [ ] Configure firewall rules
- [ ] Set up regular security scans
- [ ] Enable audit logging
- [ ] Configure backup strategy

##  Health Checks and Recovery

### Automatic Health Monitoring

The system performs health checks every 30 seconds:
- Model inference latency
- Memory usage
- API endpoint availability
- Database connectivity
- Redis connectivity

### Auto-Recovery Features

1. **Service Restart**: Failed services automatically restart
2. **Model Fallback**: Fallback to previous model versions
3. **Circuit Breaker**: Prevents cascading failures
4. **Resource Cleanup**: Automatic memory management

##  Updates and Maintenance

### Rolling Updates

```bash
# Update models without downtime
python production_deployment.py rolling-update --model embeddings --version v1.2
```

### Backup Procedures

```bash
# Backup configuration and state
python backup_manager.py create

# Restore from backup
python backup_manager.py restore --backup backup_20240101_120000.tar.gz
```

##  Troubleshooting

### Common Issues

1. **Out of Memory**
   - Solution: Reduce batch sizes in deployment_config.yaml
   - Enable model quantization

2. **Slow Inference**
   - Check CPU usage and threading configuration
   - Enable caching if not already enabled
   - Consider model quantization

3. **Service Won't Start**
   - Check logs in logs/[service_name].log
   - Verify all dependencies are installed
   - Check port conflicts

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python production_launcher.py
```

##  Performance Optimization

### Recommended Settings

For i3 processors:
```yaml
performance:
  max_concurrent_requests: 50
  batch_size: 32
  enable_caching: true
  cache_size_mb: 2000
```

### Scaling Options

1. **Vertical Scaling**: Increase CPU/RAM
2. **Model Optimization**: Enable quantization
3. **Caching**: Increase cache size
4. **Load Balancing**: Deploy multiple instances

##  Support and Resources

### Documentation
- API Documentation: `/docs` endpoint
- Model Documentation: See individual model cards
- Architecture Guide: `ARCHITECTURE.md`

### Monitoring Alerts

Configure alerts in deployment_config.yaml:
```yaml
alerts:
  - name: high_cpu_usage
    threshold: 85
    action: email
```

##  Production Checklist

Before going live:

- [ ] Security validation passed
- [ ] All environment variables set
- [ ] SSL certificates configured
- [ ] Backup strategy implemented
- [ ] Monitoring alerts configured
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team training completed

##  Quick Start Commands

```bash
# Full production deployment
python production_launcher.py

# Check status
python service_manager.py status

# View logs
tail -f logs/app.log

# Stop all services
python service_manager.py stop
```

##  Expected Performance

With recommended hardware:
- **Inference Speed**: <1 second per request
- **Throughput**: 50+ requests/second
- **Memory Usage**: <2GB with all models loaded
- **Uptime**: 99.9% with auto-recovery

---

**Last Updated**: December 2024
**Version**: 1.0.0
