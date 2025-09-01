#!/bin/bash
# ============================================
# AI Job Chommie - Local Testing & Validation Script
# Run this before deploying to production
# ============================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

# ============================================
# Pre-flight Checks
# ============================================
log_info "Starting pre-production validation..."

# Check Docker installation
if command -v docker &> /dev/null; then
    log_success "Docker is installed"
else
    log_failure "Docker is not installed"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    log_success "Docker Compose is installed"
else
    log_failure "Docker Compose is not installed"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_success "Node.js is installed: $NODE_VERSION"
else
    log_failure "Node.js is not installed"
fi

# ============================================
# Environment Configuration Tests
# ============================================
log_info "Checking environment configuration..."

# Check for environment files
if [ -f ".env.production.example" ]; then
    log_success "Production environment template exists"
else
    log_failure "Production environment template missing"
fi

# Check for Docker files
if [ -f "docker-compose.prod.yml" ]; then
    log_success "Production Docker Compose file exists"
else
    log_failure "Production Docker Compose file missing"
fi

if [ -f "frontend/Dockerfile" ]; then
    log_success "Frontend Dockerfile exists"
else
    log_failure "Frontend Dockerfile missing"
fi

if [ -f "backend/Dockerfile" ]; then
    log_success "Backend Dockerfile exists"
else
    log_failure "Backend Dockerfile missing"
fi

# ============================================
# Frontend Tests
# ============================================
log_info "Testing frontend build..."

cd frontend
if npm ci --legacy-peer-deps > /dev/null 2>&1; then
    log_success "Frontend dependencies installed"
else
    log_failure "Frontend dependency installation failed"
fi

if npm run build > /dev/null 2>&1; then
    log_success "Frontend build successful"
    
    # Check build output
    if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        log_success "Frontend build artifacts generated"
        
        # Check for Facebook domain verification meta tag
        if grep -q "facebook-domain-verification" dist/index.html; then
            log_success "Facebook domain verification meta tag present"
        else
            log_warning "Facebook domain verification meta tag not found"
        fi
    else
        log_failure "Frontend build artifacts missing"
    fi
else
    log_failure "Frontend build failed"
fi

cd ..

# ============================================
# Backend Tests
# ============================================
log_info "Testing backend configuration..."

cd backend
if npm ci > /dev/null 2>&1; then
    log_success "Backend dependencies installed"
else
    log_failure "Backend dependency installation failed"
fi

# Check for Hugging Face integration
if [ -f "services/huggingface.service.js" ]; then
    log_success "Hugging Face AI service configured"
else
    log_failure "Hugging Face AI service missing"
fi

cd ..

# ============================================
# Docker Build Tests
# ============================================
log_info "Testing Docker builds..."

# Test frontend Docker build
if docker build -t aijc-frontend-test ./frontend > /dev/null 2>&1; then
    log_success "Frontend Docker image builds successfully"
    docker rmi aijc-frontend-test > /dev/null 2>&1
else
    log_failure "Frontend Docker build failed"
fi

# Test backend Docker build
if docker build -t aijc-backend-test ./backend > /dev/null 2>&1; then
    log_success "Backend Docker image builds successfully"
    docker rmi aijc-backend-test > /dev/null 2>&1
else
    log_failure "Backend Docker build failed"
fi

# ============================================
# Security Checks
# ============================================
log_info "Running security checks..."

# Check for exposed secrets
if grep -r "sk_live" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".example"; then
    log_failure "Exposed API keys found in code!"
else
    log_success "No exposed API keys in code"
fi

# Check for console.log statements in production code
CONSOLE_LOGS=$(find frontend/src backend/src -name "*.js" -o -name "*.jsx" 2>/dev/null | xargs grep -l "console.log" | wc -l)
if [ "$CONSOLE_LOGS" -gt 0 ]; then
    log_warning "Found $CONSOLE_LOGS files with console.log statements"
else
    log_success "No console.log statements in production code"
fi

# ============================================
# Local Docker Compose Test
# ============================================
log_info "Testing local Docker Compose setup..."

# Create test environment file
cat > .env.test << EOF
NODE_ENV=test
DB_PASSWORD=testpassword123
JWT_SECRET=testsecretkey1234567890abcdefghij
HUGGINGFACE_API_TOKEN=hf_test_token
EOF

# Validate Docker Compose configuration
if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    log_success "Docker Compose configuration is valid"
else
    log_failure "Docker Compose configuration is invalid"
fi

# Clean up test file
rm -f .env.test

# ============================================
# Network Configuration Checks
# ============================================
log_info "Checking network requirements..."

# Check if ports are available
for PORT in 80 443 5432 6379; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port $PORT is already in use"
    else
        log_success "Port $PORT is available"
    fi
done

# ============================================
# Results Summary
# ============================================
echo ""
echo "============================================"
echo "        PRE-PRODUCTION TEST RESULTS         "
echo "============================================"
echo -e "${GREEN}Passed:${NC} $PASSED_TESTS"
echo -e "${RED}Failed:${NC} $FAILED_TESTS"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${BLUE}Total Tests:${NC} $TOTAL_TESTS"
echo "============================================"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN} All critical tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run local integration test: docker-compose -f docker-compose.prod.yml up"
    echo "2. Test at http://localhost"
    echo "3. If successful, proceed with staging deployment"
    exit 0
else
    echo -e "${RED} Some tests failed. Please fix issues before deploying.${NC}"
    exit 1
fi
