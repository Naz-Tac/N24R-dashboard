#!/bin/bash

# Vercel Setup Verification Script
# This script checks if all prerequisites for Vercel deployment are in place

set -e

echo "🔍 Vercel Deployment Setup Verification"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Track overall status
ERRORS=0
WARNINGS=0

echo "📦 Checking local setup..."
echo ""

# 1. Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
    VERSION=$(vercel --version)
    check_pass "Vercel CLI installed (version: $VERSION)"
else
    check_fail "Vercel CLI not installed"
    echo "   Install with: npm install -g vercel@latest"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check if .vercel directory exists
if [ -d ".vercel" ]; then
    check_pass ".vercel directory exists"
    
    # Check if project.json exists
    if [ -f ".vercel/project.json" ]; then
        check_pass ".vercel/project.json found"
        
        # Extract and display IDs
        if command -v jq &> /dev/null; then
            ORG_ID=$(jq -r '.orgId' .vercel/project.json 2>/dev/null || echo "")
            PROJECT_ID=$(jq -r '.projectId' .vercel/project.json 2>/dev/null || echo "")
            
            if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
                check_pass "Organization ID found: ${ORG_ID:0:20}..."
            else
                check_fail "Organization ID not found in project.json"
                ERRORS=$((ERRORS + 1))
            fi
            
            if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
                check_pass "Project ID found: ${PROJECT_ID:0:20}..."
            else
                check_fail "Project ID not found in project.json"
                ERRORS=$((ERRORS + 1))
            fi
        else
            check_warn "jq not installed - cannot parse project.json"
            check_warn "Install jq with: brew install jq (macOS) or apt-get install jq (Linux)"
            echo "   You can manually check .vercel/project.json for orgId and projectId"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        check_fail ".vercel/project.json not found"
        echo "   Run 'vercel link' to create it"
        ERRORS=$((ERRORS + 1))
    fi
else
    check_fail ".vercel directory not found"
    echo "   Run 'vercel link' to link your project"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📋 Checking workflow files..."
echo ""

# 3. Check if deploy workflow exists
if [ -f ".github/workflows/deploy.yml" ]; then
    check_pass "deploy.yml workflow exists"
else
    check_fail "deploy.yml workflow not found"
    ERRORS=$((ERRORS + 1))
fi

# 4. Check if test workflow exists
if [ -f ".github/workflows/test.yml" ]; then
    check_pass "test.yml workflow exists"
else
    check_fail "test.yml workflow not found"
    ERRORS=$((ERRORS + 1))
fi

# 5. Check if vercel.json exists
if [ -f "vercel.json" ]; then
    check_pass "vercel.json configuration exists"
else
    check_warn "vercel.json not found (optional but recommended)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🔐 Checking environment files..."
echo ""

# 6. Check for local environment files
if [ -f ".env.local" ]; then
    check_pass ".env.local exists"
    
    # Check for required Supabase variables
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null; then
        check_pass "NEXT_PUBLIC_SUPABASE_URL found in .env.local"
    else
        check_warn "NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local 2>/dev/null; then
        check_pass "NEXT_PUBLIC_SUPABASE_ANON_KEY found in .env.local"
    else
        check_warn "NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local 2>/dev/null; then
        check_pass "SUPABASE_SERVICE_ROLE_KEY found in .env.local"
    else
        check_warn "SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    check_warn ".env.local not found (optional for local development)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "📊 Summary"
echo "=========="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! You're ready to deploy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Add GitHub Secrets (see VERCEL_SETUP.md Step 5)"
    echo "2. Configure Vercel Environment Variables (Step 6)"
    echo "3. Test manual deployment (Step 8)"
    echo "4. Tag for automatic deployment (Step 9)"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Setup complete with $WARNINGS warning(s).${NC}"
    echo "Review warnings above and proceed with deployment setup."
elif [ $ERRORS -eq 1 ]; then
    echo -e "${RED}❌ Found $ERRORS error. Please fix before deploying.${NC}"
    exit 1
else
    echo -e "${RED}❌ Found $ERRORS errors. Please fix before deploying.${NC}"
    exit 1
fi

echo ""
echo "📖 Full setup guide: VERCEL_SETUP.md"
echo ""
