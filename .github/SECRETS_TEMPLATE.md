# GitHub Secrets Setup Template

Copy this template when adding secrets to GitHub:
https://github.com/Naz-Tac/N24R-dashboard/settings/secrets/actions

---

## Required Secrets for Vercel Deployment

### 1. VERCEL_TOKEN
```
Name: VERCEL_TOKEN
Value: [Paste your Vercel token from https://vercel.com/account/tokens]
```

### 2. VERCEL_ORG_ID
```
Name: VERCEL_ORG_ID
Value: [Paste orgId from .vercel/project.json]
```

### 3. VERCEL_PROJECT_ID
```
Name: VERCEL_PROJECT_ID
Value: [Paste projectId from .vercel/project.json]
```

---

## Already Configured (from earlier phases)

These should already exist in your GitHub Secrets:

### 4. NEXT_PUBLIC_SUPABASE_URL
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: [Your Supabase project URL]
```

### 5. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Your Supabase anonymous key]
```

### 6. SUPABASE_SERVICE_ROLE_KEY
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Your Supabase service role key]
```

---

## Verification

After adding secrets, verify they're all set:
```bash
# Go to GitHub Secrets page
open https://github.com/Naz-Tac/N24R-dashboard/settings/secrets/actions
```

You should see 6 secrets total:
- ✅ VERCEL_TOKEN
- ✅ VERCEL_ORG_ID
- ✅ VERCEL_PROJECT_ID
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY

---

## Getting Your Values

### Vercel Token:
1. Visit: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "GitHub Actions - N24R Dashboard"
4. Copy the token (you won't see it again!)

### Vercel IDs:
```bash
# Link project first if you haven't:
vercel link

# Then view your IDs:
cat .vercel/project.json
```

### Supabase Credentials:
1. Visit your Supabase project dashboard
2. Go to Settings > API
3. Copy Project URL, anon/public key, and service_role key

---

## Quick Copy Commands

After running `vercel link`, extract IDs:

```bash
# macOS - copy org ID to clipboard
cat .vercel/project.json | grep orgId | awk -F'"' '{print $4}' | pbcopy

# macOS - copy project ID to clipboard
cat .vercel/project.json | grep projectId | awk -F'"' '{print $4}' | pbcopy
```

---

Last Updated: October 30, 2025
