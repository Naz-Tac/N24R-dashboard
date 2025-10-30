# Vercel Deployment Setup Checklist

## 🚀 Quick Start Guide

This guide will walk you through setting up automatic Vercel deployments for the N24R Dashboard.

---

## Step 1: Install Vercel CLI (If Not Already Installed)

```bash
npm install -g vercel@latest
```

Verify installation:
```bash
vercel --version
```

---

## Step 2: Link Your Project to Vercel

Run this command in your project directory:

```bash
vercel link
```

You'll be prompted to:
1. **Log in to Vercel** (opens browser for authentication)
2. **Select your scope** (personal account or team)
3. **Link to existing project or create new**
   - Choose "Create new project" if this is your first deployment
   - Or select existing project if you've deployed before

This creates a `.vercel` directory with:
- `project.json` — Contains your `orgId` and `projectId`
- `README.txt` — Vercel-specific notes

**Important:** The `.vercel` directory is gitignored for security. You'll extract IDs from it next.

---

## Step 3: Extract Vercel IDs

After linking, extract your organization and project IDs:

```bash
cat .vercel/project.json
```

You'll see output like:
```json
{
  "orgId": "team_xxxxxxxxxxxxxxxxxx",
  "projectId": "prj_yyyyyyyyyyyyyyyyyyyy"
}
```

**Copy these values** — you'll need them for GitHub Secrets in Step 5.

---

## Step 4: Get Vercel Authentication Token

1. Go to **Vercel Account Settings**: https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Name it: `GitHub Actions - N24R Dashboard`
4. Scope: **Full Account** (or restrict to specific projects if preferred)
5. Click **"Create"**
6. **Copy the token immediately** (you won't see it again!)

---

## Step 5: Add GitHub Secrets

Go to your GitHub repository:
```
https://github.com/Naz-Tac/N24R-dashboard/settings/secrets/actions
```

Click **"New repository secret"** and add these **three required secrets**:

### 5.1 VERCEL_TOKEN
- **Name:** `VERCEL_TOKEN`
- **Value:** The token you created in Step 4
- Click **"Add secret"**

### 5.2 VERCEL_ORG_ID
- **Name:** `VERCEL_ORG_ID`
- **Value:** The `orgId` from `.vercel/project.json` (Step 3)
- Click **"Add secret"**

### 5.3 VERCEL_PROJECT_ID
- **Name:** `VERCEL_PROJECT_ID`
- **Value:** The `projectId` from `.vercel/project.json` (Step 3)
- Click **"Add secret"**

---

## Step 6: Configure Vercel Environment Variables

Your Supabase secrets are already in GitHub, but you need to add them to Vercel too.

### Option A: Via Vercel Dashboard (Recommended)

1. Go to your project on Vercel: https://vercel.com/dashboard
2. Click your project → **Settings** → **Environment Variables**
3. Add these three variables for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Use the same values from your GitHub Secrets (or `.env.local`).

### Option B: Via Vercel CLI

```bash
# Set production environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Set preview environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

When prompted, paste your Supabase values.

---

## Step 7: Verify GitHub Secrets Are Set

Check that all secrets are configured:

```
https://github.com/Naz-Tac/N24R-dashboard/settings/secrets/actions
```

You should see:
- ✅ `VERCEL_TOKEN`
- ✅ `VERCEL_ORG_ID`
- ✅ `VERCEL_PROJECT_ID`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 8: Test Manual Deployment (Optional)

Before triggering via tag, test a manual deployment:

### Via Vercel CLI:
```bash
vercel --prod
```

### Via GitHub Actions:
1. Go to: https://github.com/Naz-Tac/N24R-dashboard/actions/workflows/deploy.yml
2. Click **"Run workflow"**
3. Select **branch: main**
4. Choose **environment: production**
5. Click **"Run workflow"**

Watch the deployment in the Actions tab. On success, you'll see:
- ✅ Build completed
- ✅ Deployment URL in job summary
- ✅ Health checks passed

---

## Step 9: Tag for Automatic Deployment

Once manual deployment works, enable automatic deployments via tags:

```bash
# Wait for current CI to pass
git pull origin main

# Create and push a version tag
git tag v1.0.14 -m "v1.0.14 – AI Assistant Integration (Dispatch & Insights)"
git push origin v1.0.14
```

This triggers:
1. **`test.yml`** workflow (CI tests including Stage 18)
2. **`deploy.yml`** workflow (Vercel deployment)

---

## Step 10: Monitor Deployment

### Watch GitHub Actions:
```
https://github.com/Naz-Tac/N24R-dashboard/actions
```

You'll see two workflows running:
- **API Integration Tests** (test.yml)
- **Deploy to Vercel** (deploy.yml)

### Expected Timeline:
- Tests: ~5-8 minutes
- Deployment: ~3-5 minutes
- Total: ~10-15 minutes

### On Success:
- ✅ All CI stages pass (1-18)
- ✅ Deployment completes
- ✅ Preview URL available in Actions summary
- ✅ Health checks confirm app is live

---

## Step 11: Verify Live Deployment

Once deployed, test these URLs (replace with your actual domain):

```bash
# Root
curl -I https://n24r-dashboard.vercel.app

# Health check
curl https://n24r-dashboard.vercel.app/api/availability/health

# Admin dashboard (should redirect to signin)
curl -I https://n24r-dashboard.vercel.app/dashboard

# Analytics
curl -I https://n24r-dashboard.vercel.app/analytics
```

Or visit in browser:
- https://n24r-dashboard.vercel.app/signin
- https://n24r-dashboard.vercel.app/dashboard
- https://n24r-dashboard.vercel.app/analytics
- https://n24r-dashboard.vercel.app/agent/dashboard
- https://n24r-dashboard.vercel.app/org/dashboard

---

## 🎉 You're Done!

Future deployments are now automatic:
1. Make changes to code
2. Commit and push to `main`
3. Create version tag: `git tag v1.0.x`
4. Push tag: `git push origin v1.0.x`
5. Sit back and watch CI + Vercel deploy automatically! 🚀

---

## Troubleshooting

### "Error: Missing required secrets"
- **Fix:** Double-check Step 5 — ensure all three Vercel secrets are added

### "Vercel deployment failed"
- **Check:** Vercel dashboard build logs
- **Common fix:** Verify environment variables in Vercel settings (Step 6)

### "Health check failed"
- **Check:** Supabase credentials are correct in Vercel
- **Fix:** Update environment variables in Vercel dashboard

### ".vercel directory not found"
- **Fix:** Run `vercel link` again (Step 2)
- Make sure you're in the project root directory

### "Permission denied deploying to Vercel"
- **Fix:** Recreate Vercel token with full account scope (Step 4)
- Update `VERCEL_TOKEN` secret in GitHub

---

## Quick Reference

### GitHub Secrets Required:
```
VERCEL_TOKEN          → From Vercel account settings
VERCEL_ORG_ID         → From .vercel/project.json
VERCEL_PROJECT_ID     → From .vercel/project.json
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Vercel Environment Variables Required:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Workflow Files (Already Created):
- `.github/workflows/deploy.yml` — Vercel deployment
- `.github/workflows/test.yml` — CI tests (18 stages)
- `vercel.json` — Vercel configuration
- `.vercelignore` — Deployment exclusions

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **GitHub Actions:** https://docs.github.com/en/actions
- **Supabase:** https://supabase.com/docs

---

Last Updated: October 30, 2025
