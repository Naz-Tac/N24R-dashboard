# Vercel Deployment Guide

## Required GitHub Secrets

The following secrets must be configured in GitHub Settings > Secrets and variables > Actions:

### Vercel Credentials
- `VERCEL_TOKEN` - Authentication token from Vercel account settings
- `VERCEL_ORG_ID` - Organization ID from Vercel project settings (.vercel/project.json)
- `VERCEL_PROJECT_ID` - Project ID from Vercel project settings (.vercel/project.json)

### Supabase Credentials (for production build)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Setup Instructions

### 1. Get Vercel Token
1. Go to https://vercel.com/account/tokens
2. Create a new token with deployment permissions
3. Add as `VERCEL_TOKEN` secret in GitHub

### 2. Link Vercel Project
```bash
# Install Vercel CLI locally
npm i -g vercel

# Link to your Vercel project
vercel link

# This creates .vercel/project.json with your org and project IDs
```

### 3. Extract IDs
```bash
# Get your organization and project IDs
cat .vercel/project.json
```

Add `orgId` as `VERCEL_ORG_ID` and `projectId` as `VERCEL_PROJECT_ID` in GitHub secrets.

### 4. Configure Vercel Environment Variables
In Vercel dashboard, add the same Supabase environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deployment Workflow

### Automatic Deployment
Push a tag starting with `v1.`:
```bash
git tag v1.0.13
git push origin v1.0.13
```

This triggers the deploy workflow which:
1. Builds the Next.js app
2. Deploys to Vercel
3. Outputs the preview URL
4. Runs health checks

### Manual Deployment
Go to Actions > Deploy to Vercel > Run workflow

Select environment:
- `production` - Deploy to production domain
- `preview` - Deploy to preview URL

## Verification

After deployment:
1. Check the GitHub Actions summary for the deployment URL
2. Visit the URL to verify the app is live
3. Test key routes:
   - `/dashboard`
   - `/analytics`
   - `/agent/dashboard`
   - `/org/dashboard`

## Troubleshooting

### Build fails on Vercel
- Check that all environment variables are set in Vercel dashboard
- Verify the build command in `package.json` matches Vercel settings
- Review build logs in Vercel dashboard

### Deployment URL not accessible
- Wait 30-60 seconds for DNS propagation
- Check Vercel dashboard for deployment status
- Verify domain settings in Vercel

### Health check fails
- Ensure Supabase credentials are correct
- Check API routes are built correctly
- Review server logs in Vercel dashboard

## Next Steps

After successful deployment:
1. Add custom domain in Vercel settings
2. Configure production environment variables
3. Set up monitoring and alerts
4. Add Slack/webhook notifications (optional)

## Reference
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitHub Actions Vercel Integration](https://vercel.com/docs/concepts/deployments/github-actions)
