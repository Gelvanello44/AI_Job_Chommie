# Enterprise Job Scraping Microservice

A production-ready, self-healing job scraping microservice that provides comprehensive South African job market intelligence. Built with advanced anti-detection mechanisms, real-time processing, and support for all pricing tiers.

##  Features

### Core Capabilities
- **Hybrid Scraping Architecture**: Scrapy clusters for scale, Playwright for JavaScript-heavy sites, SerpAPI for search augmentation
- **Self-Healing Infrastructure**: Automatic failover, adaptive rate limiting, and anomaly detection
- **Advanced Anti-Detection**: Browser fingerprint randomization, TLS rotation, behavioral mimicking, ML-powered CAPTCHA solving
- **Real-Time Processing**: Apache Kafka streaming, WebSocket updates, instant notifications
- **AI Integration**: HuggingFace embeddings, vector search, sentiment analysis, predictive analytics

### Tier-Specific Features (Aligned with PricingPage.jsx)

#### FREE Tier (2 monthly applications)
- Basic AI job matching and search
- Standard job listings extraction
- Job preferences setup and filtering
- Basic ATS optimization scoring

#### PROFESSIONAL Tier (5 monthly applications - R8/month)
- Enhanced AI matching with industry keywords
- Weekly job alerts for SA opportunities  
- Company research briefings and insights
- Salary benchmarking data collection
- Advanced search filters and analytics
- Professional-level job targeting

#### EXECUTIVE Tier (8 monthly applications - R17/month)
- Executive-level job discovery and filtering
- Hidden job market access and opportunities
- Networking event discovery and curation
- Leadership role targeting and assessments
- Headhunter visibility and positioning
- Personal brand audit data collection
- Industry intelligence and market trend reports
- Career trajectory planning insights

##  Architecture

```

                        Load Balancer                         

                           

                      API Gateway                             
              (FastAPI + GraphQL + WebSocket)                 

                           
        
                                            
  
 Scrapy Cluster    Playwright      SerpAPI      
   (Scale)        (JavaScript)   (Search Aug)   
  
                                            
        
                           

                   Message Queue (Kafka)                      

                           
        
                                            
  
  PostgreSQL      Redis Cluster   HuggingFace   
  + pgvector        (Cache)       (Embeddings)  
  
```

##  Technology Stack

- **Languages**: Python 3.11+
- **Scraping**: Scrapy, Playwright, BeautifulSoup4, curl-cffi
- **API**: FastAPI, GraphQL (Strawberry), WebSockets
- **Database**: PostgreSQL with pgvector extension
- **Cache**: Redis Cluster
- **Streaming**: Apache Kafka
- **ML/AI**: HuggingFace Transformers, spaCy, scikit-learn
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Container**: Docker, Kubernetes
- **Anti-Detection**: Rotating proxies, fingerprint randomization, behavioral mimicking

##  Prerequisites

- Docker & Docker Compose
- Python 3.11+
- PostgreSQL 14+ with pgvector
- Redis 7+
- Apache Kafka
- Google Chrome (for Playwright)

##  Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/your-org/job-scraping-service.git
cd job-scraping-service
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start with Docker Compose
```bash
docker-compose up -d
```

### 4. Check health status
```bash
curl http://localhost:8000/health
```

### 5. Access services
- API Documentation: http://localhost:8000/docs
- GraphQL Playground: http://localhost:8000/graphql
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3000 (admin/admin)
- Jaeger: http://localhost:16686

##  Configuration

### Environment Variables

Key environment variables in `.env`:

```env
# Service Configuration
ENVIRONMENT=production
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/jobscraper
VECTOR_DIMENSION=768

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# External APIs
SERP_API_KEY=your_serpapi_key
HUGGINGFACE_API_KEY=your_hf_key
CAPTCHA_SOLVER_API_KEY=your_captcha_key

# Performance
MAX_CONCURRENT_SCRAPERS=50
TARGET_DAILY_JOBS=50000
```

##  API Usage

### REST API

#### Start Scraping
```bash
curl -X POST http://localhost:8000/api/v1/scraping/start \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["linkedin", "indeed", "glassdoor"],
    "location": "Cape Town",
    "job_level": "senior"
  }'
```

#### Search Jobs
```bash
curl http://localhost:8000/api/v1/search/jobs?query=python+developer&location=Johannesburg
```

#### Get Executive Opportunities
```bash
curl http://localhost:8000/api/v1/executive/opportunities?min_salary=1000000
```

### GraphQL API

```graphql
query SearchJobs {
  searchJobs(
    query: "data scientist"
    location: "Cape Town"
    jobLevel: SENIOR
    includeHiddenMarket: true
  ) {
    total
    jobs {
      id
      title
      company {
        name
        cultureScore
      }
      salaryMin
      salaryMax
      matchScore
    }
  }
}
```

### WebSocket Real-time Updates

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/client123');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    filters: {
      job_level: 'executive',
      location: 'Johannesburg'
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New job:', data);
};
```

##  Testing

### Run unit tests
```bash
pytest tests/unit -v
```

### Run integration tests
```bash
pytest tests/integration -v
```

### Run performance tests
```bash
locust -f tests/performance/locustfile.py --host=http://localhost:8000
```

##  Monitoring

### Prometheus Metrics
- `scraper_requests_total`: Total scraping requests
- `scraper_success_rate`: Success rate by domain
- `job_extraction_duration`: Job extraction time
- `api_response_time`: API response times

### Grafana Dashboards
Pre-configured dashboards for:
- Scraper performance
- API metrics
- System health
- Business KPIs

##  Deployment

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f infrastructure/kubernetes/

# Scale scrapers
kubectl scale deployment scrapy-worker --replicas=10

# Check status
kubectl get pods -n job-scraper
```

### Production Checklist
- [ ] Set strong passwords in `.env`
- [ ] Configure SSL/TLS certificates
- [ ] Set up backup strategies
- [ ] Configure monitoring alerts
- [ ] Enable distributed tracing
- [ ] Set resource limits
- [ ] Configure auto-scaling policies

##  Security

- All secrets managed via environment variables
- Proxy rotation for anonymity
- TLS fingerprint randomization
- Rate limiting and DDoS protection
- Input validation and sanitization
- Authentication for sensitive endpoints

##  Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

##  License

This project is proprietary and confidential.

##  Support

For issues and questions:
- Create an issue in GitHub
- Contact: support@jobscraper.com
- Documentation: https://docs.jobscraper.com
