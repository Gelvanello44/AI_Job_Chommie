# AI Job Chommie API Testing with Postman

## Quick Setup Guide

### 1. Import Collection and Environments

**Import the API Collection:**
1. Open Postman
2. Click "Import" in the top left
3. Select `AI-Job-Chommie-API.postman_collection.json`
4. Click "Import"

**Import Environment Files:**
1. Click "Import" again
2. Select both environment files:
   - `AI-Job-Chommie-Development.postman_environment.json`
   - `AI-Job-Chommie-Production.postman_environment.json`
3. Click "Import"

### 2. Select Environment

1. In the top-right corner, select "AI Job Chommie - Development" from the environment dropdown
2. This will configure all requests to use `http://localhost:5000/api/v1` as the base URL

### 3. Start Testing

**First, ensure your backend is running:**
```bash
cd ai-job-chommie-backend
npm run dev
```

**Test the API:**
1. Start with "Health Check" in the "Health & System" folder to verify the API is running
2. Register a new user with "Register User" in the "Authentication" folder
3. Login with "Login User" - this will automatically store your auth tokens
4. Try other endpoints - they'll automatically use your stored authentication

## Key Features of This Postman Setup

### Automatic Authentication
- **Token Management**: Login automatically stores your JWT tokens
- **Auto-Bearer**: All requests automatically include your auth token
- **Token Refresh**: Built-in token refresh logic when tokens expire
- **Multiple User Types**: Separate credentials for job seekers, employers, and admins

### Smart Variable Management
- **Dynamic IDs**: Job IDs, application IDs, and other identifiers are automatically captured and reused
- **Environment Switching**: Easy switching between development and production
- **Secure Storage**: Passwords and tokens are stored securely

### Built-in Testing
- **Response Validation**: Each request includes test scripts to validate responses
- **Status Code Checks**: Automatic validation of expected HTTP status codes
- **Data Structure Tests**: Validation that responses contain expected fields
- **Flow Testing**: Some requests store data for use in subsequent requests

### Professional Features (With Your 30-Day Trial)

#### API Documentation
- **Auto-Generated Docs**: Postman can generate beautiful API documentation
- **Live Examples**: Real request/response examples with your actual data
- **Team Sharing**: Share collections with your development team

#### Mock Server
- **Frontend Development**: Create mock responses for frontend development
- **Offline Testing**: Test frontend when backend isn't available
- **Custom Responses**: Define specific responses for different scenarios

#### Automated Testing
- **Collection Runner**: Run entire test suites automatically
- **CI/CD Integration**: Integrate with your deployment pipeline
- **Monitoring**: Set up API monitoring to check endpoints regularly

#### Advanced Features
- **Code Generation**: Generate client code in multiple languages
- **API Versioning**: Manage different API versions
- **Performance Testing**: Load testing with realistic scenarios

## Testing Workflows

### Complete User Journey Testing

**1. New User Registration Flow:**
```
Authentication → Register User → Login User → Get User Profile
```

**2. Job Search and Application Flow:**
```
Jobs → Get All Jobs → Get Job by ID → Submit Job Application → Get Application Details
```

**3. AI Matching Testing:**
```
AI Matching → Get Job Matches → Get Match Details → Update Matching Preferences
```

**4. Professional Features Testing:**
```
CV Management → Upload CV → Analyze CV with ATS → Professional Features → Take Leadership Assessment
```

### Environment-Specific Testing

**Development Environment Testing:**
- Test all endpoints with sample data
- Validate error handling and edge cases
- Test file uploads with actual files
- Verify authentication flows

**Production Environment Testing:**
- Health checks and system status
- Performance validation
- Security testing
- Production data validation

## Postman Professional Features for AI Job Chommie

### Mock Server Setup
1. Right-click collection → "Mock collection"
2. Set up mock responses for:
   - Job listings when scraping service is down
   - User data for frontend development
   - AI matching responses for testing

### Monitor Setup
1. Click "Monitors" in sidebar
2. Create monitor for critical endpoints:
   - Health check every 5 minutes
   - Authentication flow daily
   - Payment webhook validation

### Documentation Generation
1. Click "View complete documentation"
2. Publish documentation for:
   - Developer onboarding
   - API reference for integrations
   - Client implementation guides

### Team Collaboration
1. Create workspace for "AI Job Chommie Development"
2. Invite team members
3. Share collections and environments
4. Track API changes and updates

## Advanced Testing Scenarios

### Load Testing Configuration
```javascript
// Collection Runner Settings
{
  "iterations": 100,
  "delay": 1000,
  "dataFile": "user_test_data.csv",
  "environment": "AI Job Chommie - Development"
}
```

### Custom Test Scripts
```javascript
// Pre-request script for rate limiting testing
setTimeout(() => {
  // Execute request after delay to test rate limiting
}, Math.random() * 1000);

// Test script for response time validation
pm.test("Response time is less than 500ms", function () {
  pm.expect(pm.response.responseTime).to.be.below(500);
});

// Test script for data consistency
pm.test("User data consistency", function () {
  const user = pm.response.json().user;
  pm.expect(user.email).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  pm.expect(user.role).to.be.oneOf(['JOB_SEEKER', 'EMPLOYER', 'ADMIN']);
});
```

### Webhook Testing
```javascript
// Paystack webhook validation
pm.test("Webhook signature is valid", function () {
  const signature = pm.request.headers.get('x-paystack-signature');
  pm.expect(signature).to.not.be.empty;
});

pm.test("Payment data is complete", function () {
  const data = pm.response.json().data;
  pm.expect(data).to.have.property('amount');
  pm.expect(data).to.have.property('reference');
  pm.expect(data.status).to.equal('success');
});
```

## File Upload Testing

### CV Upload Testing
1. Add sample CV files to your local directory:
   - `sample_cv.pdf`
   - `sample_cv.docx`
   - `invalid_file.txt` (for error testing)

2. Test file upload scenarios:
   - Valid PDF upload
   - Valid DOCX upload  
   - Invalid file type rejection
   - File size limit validation

### Audio File Testing (Voice Features)
1. Add sample audio files:
   - `sample_audio.wav`
   - `sample_audio.mp3`
   - `multilingual_audio.wav`

2. Test voice processing:
   - English speech recognition
   - Afrikaans speech recognition
   - isiZulu speech recognition
   - Invalid audio format handling

## Data-Driven Testing

### Test Data Files
Create CSV files for bulk testing:

**users_test_data.csv:**
```csv
email,password,firstName,lastName,role,province,city
user1@test.com,Password123!,John,Doe,JOB_SEEKER,Gauteng,Johannesburg
user2@test.com,Password123!,Jane,Smith,JOB_SEEKER,Western Cape,Cape Town
employer1@test.com,Password123!,Mike,Johnson,EMPLOYER,KwaZulu-Natal,Durban
```

**job_search_data.csv:**
```csv
query,location,jobType,experienceLevel,expectedResults
software developer,Johannesburg,FULL_TIME,MID,>5
marketing manager,Cape Town,FULL_TIME,SENIOR,>3
data analyst,Durban,REMOTE,JUNIOR,>2
```

### Running Data-Driven Tests
1. Click "Runner" in Postman
2. Select your collection
3. Upload CSV file
4. Configure iterations
5. Run comprehensive test suite

## API Performance Benchmarking

### Key Metrics to Monitor
- **Authentication**: Login should complete under 200ms
- **Job Search**: Search results under 500ms
- **AI Matching**: Match calculation under 2 seconds
- **File Upload**: CV processing under 5 seconds
- **Voice Processing**: Speech-to-text under 3 seconds

### Setting Up Performance Tests
```javascript
// Response time benchmarks
pm.test("Fast authentication", () => {
  pm.expect(pm.response.responseTime).to.be.below(200);
});

pm.test("Efficient job search", () => {
  pm.expect(pm.response.responseTime).to.be.below(500);
});

pm.test("AI matching performance", () => {
  pm.expect(pm.response.responseTime).to.be.below(2000);
});
```

## Troubleshooting Common Issues

### Authentication Problems
- **Token Expired**: Use "Refresh Token" request
- **Invalid Credentials**: Check environment variables
- **CORS Issues**: Verify frontend URL in CORS configuration

### Request Failures
- **404 Errors**: Check if backend is running on correct port
- **500 Errors**: Check backend logs for detailed error information
- **Rate Limiting**: Wait or use different test account

### Environment Issues
- **Wrong Base URL**: Verify environment selection in top-right
- **Missing Variables**: Check environment variables are set correctly
- **SSL Issues**: Use HTTP for development, HTTPS for production

## Getting Maximum Value from Postman Professional

### Documentation Features
1. **Generate Documentation**: Create public API docs
2. **Code Examples**: Auto-generate client code samples
3. **Sync with Git**: Version control your collections

### Collaboration Features
1. **Team Workspaces**: Share with development team
2. **Comment System**: Add notes and feedback on requests
3. **Version History**: Track changes to your API tests

### Monitoring and Alerts
1. **Uptime Monitoring**: Monitor critical endpoints 24/7
2. **Performance Alerts**: Get notified of slow responses
3. **Error Tracking**: Track API error rates over time

This Postman setup gives you enterprise-grade API testing capabilities that far exceed what we could build internally. You can test the entire AI Job Chommie platform, validate all integrations, and ensure production readiness with professional-grade tools.

Perfect timing with your 30-day trial - this will be invaluable for testing and validating the platform before launch!
