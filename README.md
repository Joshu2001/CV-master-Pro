# CV Master PRO - AI-Powered Resume Optimization Platform

A sophisticated full-stack application that transforms CVs using AI. Optimizes resumes for specific job descriptions, generates cover letters, and provides strategic portfolio recommendations.

## Features

✨ **AI-Powered Resume Tailoring**
- Tailors CVs to specific job descriptions using Gemini AI
- Calculates fit score and identifies gaps
- One-page optimization with formatting preservation

📄 **Cover Letter Generation**
- Contextually relevant cover letters
- Formatted in professional markdown
- Export to DOCX format

🎯 **Portfolio Strategy**
- Tiered project recommendations
- Bridge strategies between skill gaps
- Prestige signal analysis

✏️ **Intelligent Text Editing**
- In-preview text selection and editing
- Contextual editing suggestions
- "Emphasize" feature for highlighting strengths

📁 **File Support**
- PDF extraction
- DOCX file parsing
- Image OCR for CV screenshots
- Text paste support

💾 **Profile Management**
- Save and load optimized CVs
- Firebase-backed persistence
- Version history

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI**: Google Gemini 2.5 Flash API
- **Icons**: Lucide React
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and npm/yarn
- Firebase account (for Firestore & Auth)
- Google Cloud Project with Gemini API enabled
- Vercel account (for deployment)

## Setup Instructions

### 1. Clone/Setup the Project

```bash
# Navigate to the project directory
cd CV-Master-Pro

# Install dependencies
npm install
```

### 2. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing one
3. Enable Firestore Database (Start in test mode initially)
4. Enable Anonymous Authentication
5. Copy your Firebase configuration

### 3. Environment Variables

Update `.env.local` with your credentials:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gemini API (provided)
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyChD34v1tZH9GwZqWesN7wi-Mr2uEzL6WY

# App Configuration
NEXT_PUBLIC_APP_ID=cv-tailor-pro
```

### 4. Local Development

```bash
# Start the development server
npm run dev

# Open browser to http://localhost:3000
```

### 5. Build for Production

```bash
npm run build
npm run start
```

## Deployment on Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/cv-master-pro.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. In "Environment Variables", add:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_GEMINI_API_KEY` (use the provided key)
   - `NEXT_PUBLIC_APP_ID=cv-tailor-pro`
5. Click "Deploy"

Vercel will automatically:
- Build your Next.js app
- Optimize for production
- Deploy to a global CDN
- Provide HTTPS by default

## Firebase Firestore Security Rules

For production, update your Firestore rules:

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

## Project Structure

```
CV-Master-Pro/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main component
│   │   └── globals.css         # Global styles
├── public/                      # Static files
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                 # Vercel configuration
├── .env.local                  # Environment variables
└── .gitignore
```

## API Integration

### Gemini API Endpoints

The app uses these Gemini endpoints:
- `gemini-2.5-flash-preview-09-2025` for CV optimization
- `generateContent` with JSON response mode for structured data

### Firebase Integration

- **Firestore**: Stores user profiles and CV data
- **Auth**: Anonymous authentication for users

## Performance Optimization

- Lazy loading of external libraries (PDF.js, Mammoth)
- Code splitting with Next.js
- Image optimization
- CSS minification via Tailwind

## Troubleshooting

### "Firebase initialization error"
- Verify `.env.local` has correct Firebase credentials
- Check Firebase console for project settings

### "API response failed"
- Verify Gemini API key is correct
- Check API quotas in Google Cloud Console
- Ensure Gemini API is enabled

### "Firestore permission denied"
- Check Firestore security rules
- Verify authentication is working (check browser console)
- Start with test mode rules while developing

### Build errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Run `npm run build` to check for TypeScript errors

## Security Considerations

- All API keys use environment variables
- Gemini API key is for server-side only (marked as `NEXT_PUBLIC_` for preview)
- Firestore rules restrict data access to authenticated users
- Anonymous auth prevents unauthorized Firestore access

## Performance Tips

1. **Reduce API calls**: Cache CV optimization results
2. **Optimize images**: Compress screenshots before uploading
3. **Monitor quotas**: Track Gemini API usage in Google Cloud Console
4. **Database indexes**: Enable Firestore composite indexes for queries

## Support & Issues

For issues or feature requests:
1. Check existing GitHub issues
2. Review Vercel deployment logs
3. Check browser console for errors
4. Verify environment variables in Vercel dashboard

## License

Proprietary - CV Master PRO

## Credits

- Built with Next.js, React, and TypeScript
- Powered by Google Gemini AI
- Styled with Tailwind CSS
- Hosted on Vercel
