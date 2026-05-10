# CV Master PRO - Architecture & Database Schema

## Application Architecture

### High-Level Flow

```
User Input
    ↓
Local State Management (React)
    ↓
Gemini AI Processing
    ↓
Firebase Storage (Optional)
    ↓
DOCX Export
```

## Database Schema (Firestore)

### Collection Structure

```
artifacts/
└── cv-tailor-pro/
    └── users/
        └── {uid}/
            └── profiles/
                ├── {profileId1}
                ├── {profileId2}
                └── ...
```

### Profile Document Schema

```typescript
{
  id: string;                    // Auto-generated doc ID
  name: string;                  // User-defined profile name
  cvText: string;                // Original CV text
  jobDescription: string;        // Target job description
  optimizedCv: string;           // AI-optimized CV (markdown)
  signals: {
    gpa: string;                 // e.g., "3.85/4.0"
    testScores: string;          // e.g., "SAT: 1560; GMAT: 770"
    prestigeUniversity: boolean; // Signal for filtering
    cfaStatus: string;           // e.g., "CFA Level II Candidate"
    structureInstructions: string; // Custom optimization rules
  };
  optimizationMode: string;      // e.g., "finance", "tech"
  timestamp: Timestamp;          // Server timestamp
}
```

## Component Architecture

### Page Structure

```
page.tsx (Main App)
├── State Management
│   ├── CV Data (cvText, optimizedCv, coverLetter)
│   ├── Job Data (jobDescription)
│   ├── User Data (user, savedProfiles)
│   ├── UI State (activeTab, fontSize, floatingMenu)
│   └── Loading States (isGenerating, isReadingFile, etc.)
├── Hooks
│   ├── Auth Initialization
│   ├── Profile Loading
│   └── External Library Loading
├── Sections
│   ├── Input Panel (CV + JD entry)
│   ├── Preview Panel (Output display)
│   ├── Floating Menu (Text editing)
│   └── Sidebar (Profiles, Signals)
└── Utilities
    ├── File Processing
    ├── Text Rendering
    └── Export Functions
```

## Data Flow

### CV Optimization Flow

```
User Input (CV + JD)
    ↓
Validate Input ✓
    ↓
Call Gemini API
├─ Request: CV + JD + System Prompt
├─ Processing: AI analysis & optimization
└─ Response: JSON {cv, score, reasons, missing}
    ↓
Parse & Store ✓
├─ setOptimizedCv()
├─ setFitAnalysis()
└─ setActiveTab('output')
    ↓
Display Results
└─ Render preview with formatting
```

### File Upload Flow

```
User Selects File
    ↓
Determine File Type
├─ PDF → Extract with PDF.js
├─ DOCX → Extract with Mammoth
├─ Image → OCR with Gemini API
└─ Text → Direct append
    ↓
Combine with Existing CV ✓
    ↓
Update State
└─ setCvText(combinedText)
```

### Text Editing Flow

```
User Selects Text in Preview
    ↓
Store Selection
└─ setFloatingMenu({visible: true, text, chips: []})
    ↓
User Clicks "Edit" / "Ask" / "Emphasize"
    ↓
Generate AI Response
├─ Edit: Contextual rewriting
├─ Ask: Recruiter perspective
└─ Emphasize: Action items
    ↓
Apply Changes
└─ Replace text in document
    ↓
Refresh Preview ✓
```

### Profile Save/Load Flow

```
Generate Optimized CV
    ↓
User Clicks "Save"
    ↓
Prompt for Profile Name
    ↓
Add Document to Firestore
├─ Collection: artifacts/{appId}/users/{uid}/profiles
├─ Data: CV text, JD, optimization settings
└─ Timestamp: Server timestamp
    ↓
Update UI
├─ Refresh savedProfiles list
└─ Show success notification

---

Load Saved Profile
    ↓
Click Profile Card
    ↓
Populate Form
├─ setCvText(profile.cvText)
├─ setJobDescription(profile.jobDescription)
├─ setOptimizedCv(profile.optimizedCv)
└─ setSignals(profile.signals)
    ↓
Switch to Output Tab
```

## API Integration

### Gemini API Endpoints

#### Endpoint 1: CV Optimization
```
POST /v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent

Request Body:
{
  "contents": [{
    "parts": [{
      "text": "CV: {cvText}\nJD: {jobDescription}"
    }]
  }],
  "systemInstruction": {
    "parts": [{ "text": "Optimization prompt..." }]
  },
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}

Response:
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "{\"cv\": \"...\", \"score\": 85, \"reasons\": [...], \"missing\": [...]}"
      }]
    }
  }]
}
```

#### Endpoint 2: Image OCR
```
POST /v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent

Request Body:
{
  "contents": [{
    "parts": [
      { "text": "Extract text from CV screenshot." },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "{base64ImageData}"
        }
      }
    ]
  }]
}
```

## External Libraries

### Runtime Dependencies

| Library | Purpose | Size |
|---------|---------|------|
| react | UI framework | 42KB |
| react-dom | DOM rendering | 130KB |
| next | Framework | - |
| firebase | Backend services | 200KB |
| lucide-react | Icons | 100KB |
| axios | HTTP client | 14KB |
| tailwindcss | Styling | 0KB (build time) |

### Loaded Runtime

| Library | Purpose | Async |
|---------|---------|-------|
| mammoth | DOCX parsing | ✓ |
| pdf.js | PDF extraction | ✓ |
| docx | DOCX generation | ✓ |

## Authentication Flow

```
User Visits App
    ↓
Check Firebase Auth State
    ↓
No User?
    ↓
Sign In Anonymously
├─ Firebase creates unique UID
└─ Store in local auth state
    ↓
User Object Available
├─ Access: user.uid
└─ Use for: Firestore data isolation
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: External libraries loaded on demand
2. **Debouncing**: Textarea input doesn't cause re-renders
3. **Memoization**: Could add React.memo() to preview
4. **Code Splitting**: Next.js automatically splits routes
5. **Image Optimization**: Next.js Image component ready

### Bundle Size

- Initial: ~500KB (gzipped)
- After lazy loading all libraries: ~1.2MB

## Scaling Considerations

### Database Growth

With 1000 users saving 10 profiles each:
- Firestore operations: ~10k documents
- Storage: ~50MB (average CV + metadata)
- Cost: ~$0.30-0.50/month

### API Usage

- Per optimization: 2-5 API calls
- Average token count: 2000-5000
- Per user/month: 5-100 optimizations
- Estimated cost: $0.10-1.00/user/month

### Concurrent Users

- Vercel: Scales automatically
- Firebase: Tested to 10k concurrent connections
- Gemini API: Rate limited by default quota

## Security Architecture

### Data Flow

```
Frontend (Browser)
    ↓ HTTPS
Backend/API (Next.js)
    ↓ Environment Variables
External Services
├─ Firebase (User Auth + Data)
├─ Gemini API (Text Processing)
└─ DOCX Export (Client-side only)
```

### Security Rules

#### Firestore
- Only authenticated users can read/write
- Users can only access their own profiles
- Server-side timestamp prevents tampering

#### API Keys
- Gemini API key: Public but rate-limited
- Firebase keys: Safe for web (restricted by rules)
- All secrets in environment variables

## Monitoring Points

### Recommended Logging

1. **API Calls**: Log all Gemini requests/responses
2. **Errors**: Capture and send to error tracking
3. **User Actions**: Track CV optimizations
4. **Performance**: Monitor API response times

### Metrics to Track

- Average optimization time
- API call success rate
- Firestore query latency
- User session duration
- Conversion rate (users who export DOCX)

---

## Future Enhancements

### Potential Features

1. **Analytics Dashboard**: Track CV performance
2. **Batch Processing**: Optimize for multiple jobs
3. **Template Library**: Pre-built optimization rules
4. **Team Collaboration**: Share CVs with reviewers
5. **ATS Compliance**: Score against ATS systems
6. **Interview Prep**: Generated interview questions
7. **Salary Negotiation**: Role-based market data
8. **LinkedIn Integration**: Auto-import profile data

### Scalability Roadmap

- Database: Consider Neon PostgreSQL for complex queries
- API: Implement request caching/CDN
- Frontend: Progressive Web App (PWA) capability
- Backend: API routes for sensitive operations
