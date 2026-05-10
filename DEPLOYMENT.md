# CV Master PRO - Vercel Deployment Guide

## Quick Start Deployment (5 minutes)

### Prerequisites
- GitHub account
- Vercel account (free)
- Firebase account (free tier works)
- Google Gemini API key provided

### Step-by-Step Deployment

#### 1. Prepare Firebase (2 min)

1. Visit [Firebase Console](https://console.firebase.google.com)
2. Click "Create Project" → Enter name → Continue
3. Disable Google Analytics (optional) → Create
4. In left menu: Click "Firestore Database"
5. Click "Create Database" → Select "Start in test mode" → Continue → Select region → Enable
6. Go to "Authentication" tab → Click "Anonymous" provider → Enable → Save
7. Go to Project Settings (⚙️) → Copy all credentials for `.env.local`

#### 2. Prepare GitHub

1. Go to [GitHub](https://github.com/new)
2. Create new repository: `cv-master-pro`
3. Clone locally:
   ```bash
   git clone https://github.com/yourusername/cv-master-pro.git
   cd cv-master-pro
   ```
4. Copy all files from this project into the directory
5. Push to GitHub:
   ```bash
   git add .
   git commit -m "Initial CV Master Pro commit"
   git push origin main
   ```

#### 3. Deploy on Vercel

1. Visit [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Search for `cv-master-pro` → Click "Import"
5. **Environment Variables** - Add these:
   
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=from_firebase_settings
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyChD34v1tZH9GwZqWesN7wi-Mr2uEzL6WY
   NEXT_PUBLIC_APP_ID=cv-tailor-pro
   ```

6. Click "Deploy"
7. Wait for build to complete (usually 1-2 min)
8. Click "Visit" to see your live site

**Your app is now live on Vercel!** 🚀

---

## Production Setup

### Firebase Security Rules

After deployment, update Firestore security rules:

1. Go to Firebase Console → Firestore Database → Rules tab
2. Replace with:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/users/{uid}/profiles/{document=**} {
         allow read, write: if request.auth.uid == uid;
         allow create: if request.auth != null;
       }
     }
   }
   ```
3. Click "Publish"

### Gemini API Quota Management

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to "Generative AI" → "Quotas"
4. Set usage limits to prevent unexpected charges
5. Set up billing alerts

### Custom Domain (Optional)

1. In Vercel dashboard, go to project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration steps

---

## Troubleshooting Deployment

### Build fails with "Firebase init error"
- Check all environment variables are set correctly in Vercel
- Ensure Firebase project is created and credentials are valid

### App loads but shows blank page
- Check browser console for errors (F12)
- Verify environment variables in Vercel Settings
- Check Firebase is initialized properly

### "Firestore permission denied" errors
- Update security rules (see above)
- Ensure Anonymous auth is enabled in Firebase
- Check Firestore database is in test mode initially

### API calls fail
- Verify Gemini API key in environment variables
- Check Google Cloud project has Gemini API enabled
- Monitor API quotas in Google Cloud Console

### Performance issues
- Monitor "Vercel Analytics" dashboard
- Check "Vercel Observability" for slow API calls
- Consider upgrading to Pro plan for better performance

---

## Monitoring & Maintenance

### Vercel Monitoring
- Access "Analytics" tab to see performance metrics
- Check "Deployments" for build status
- Monitor "Edge Network" for geographic distribution

### Firebase Monitoring
- View "Firestore Usage" to track database operations
- Check "Authentication" dashboard for active users
- Monitor "Storage" usage

### Cost Optimization

**Vercel**
- Free tier includes: 100 GB bandwidth, unlimited deployments
- Typical hobby project: $0-20/month

**Firebase**
- Free tier includes: 1 GB storage, 50k read/write operations
- Firestore: $0.06 per 100k read operations
- Typical hobby project: $0-10/month

**Gemini API**
- Flash model: $0.075 per 1M input tokens
- Typical CV optimization: 2-5 API calls = $0.01-0.05 per user
- Free tier available with usage limits

---

## Updating Your App

1. Make changes locally
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Vercel automatically redeploys
4. Check deployment status in Vercel dashboard

---

## Rollback

If something breaks:
1. Go to Vercel dashboard
2. Click "Deployments"
3. Find previous working version
4. Click "..." → "Promote to Production"

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Gemini API Docs**: https://ai.google.dev

Deployment complete! Your CV Master Pro is now live. 🎉
