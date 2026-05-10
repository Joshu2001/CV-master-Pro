'use client'

import React, { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import {
  FileText,
  Briefcase,
  Wand2,
  Copy,
  Check,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  Loader2,
  Upload,
  FileDown,
  ShieldCheck,
  GraduationCap,
  TrendingUp,
  Award,
  BookOpen,
  Lightbulb,
  Zap,
  Save,
  History,
  Trash2,
  Type,
  Edit3,
  Send,
  X,
  MessageSquare,
  Target,
  FileSignature,
  Layers,
  Sparkles
} from 'lucide-react'

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: any
let auth: any
let db: any

// Initialize Firebase only on client side
if (typeof window !== 'undefined' && !app) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
  } catch (err) {
    console.error('Firebase initialization error:', err)
  }
}

const appId = process.env.NEXT_PUBLIC_APP_ID || 'cv-tailor-pro'

type FloatingMenuState = {
  visible: boolean
  text: string
  prompt: string
  mode: 'edit' | 'ask' | 'emphasize'
  chatResponse: string | null
  chips: string[]
}

interface Signals {
  gpa: string
  testScores: string
  prestigeUniversity: boolean
  cfaStatus: string
  structureInstructions: string
}

interface Profile {
  id: string
  name: string
  cvText: string
  jobDescription: string
  optimizedCv: string
  signals: Signals
  optimizationMode: string
  timestamp?: any
}

interface FitAnalysis {
  score: number
  reasons: string[]
  missing: string[]
}

interface PortfolioStrategy {
  projects: Array<{
    title: string
    tier: string
    description: string
    tools: string
    outcomeGoal: string
  }>
  bridge: {
    from: string
    to: string
    reasoning: string
  }
}

const signalFieldKeys = ['gpa', 'testScores', 'cfaStatus'] as const

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function CVMasterPro() {
  const [user, setUser] = useState<any>(null)
  const [cvText, setCvText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [optimizedCv, setOptimizedCv] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [portfolioStrategy, setPortfolioStrategy] = useState<PortfolioStrategy | null>(null)
  const [fitAnalysis, setFitAnalysis] = useState<FitAnalysis | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false)
  const [isStrategizing, setIsStrategizing] = useState(false)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'coverletter' | 'portfolio'>('input')
  const [fontSize, setFontSize] = useState(10)
  const [savedProfiles, setSavedProfiles] = useState<Profile[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [removeEmDashes, setRemoveEmDashes] = useState(false)
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState>({
    visible: false,
    text: '',
    prompt: '',
    mode: 'edit',
    chatResponse: null,
    chips: []
  })
  const [isEditingSelection, setIsEditingSelection] = useState(false)
  const [isAsking, setIsAsking] = useState(false)
  const [isGeneratingChips, setIsGeneratingChips] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [optimizationMode, setOptimizationMode] = useState('finance')
  const [signals, setSignals] = useState<Signals>({
    gpa: '3.85/4.0',
    testScores: 'SAT: 1560; GMAT: 770',
    prestigeUniversity: true,
    cfaStatus: 'CFA Level II Candidate',
    structureInstructions: `PHILOSOPHY: Relatability > History. Risk Minimization & Signal Density.
HIERARCHY: 
- Tier 1: Direct Skill Correlation (Stock Pitches, Deal Sheets).
- Tier 2: Transferable Methodology (Portfolio Optimization, Risk Models).
- Tier 3: Prestigious Past Work (Leadership, Massive Budget Mgmt).
BRIDGE STRATEGY:
- Academic/Research -> Modeling & Statistical Rigor.
- Non-Finance Tech -> Logic, Error-checking, Optimization.
- Ops/Admin -> ROI, Cost-savings, Budget Mgmt.
STRUCTURE: Strictly 1-page. Header (Centered), Professional Summary (3-4 lines Framing), Education (GPA/SAT), Experience (Action+Quant), Skills/Interests.`
  })

  // Initialize auth
  useEffect(() => {
    if (!auth) return

    const initAuth = async () => {
      try {
        await signInAnonymously(auth)
      } catch (err) {
        console.error('Auth failed:', err)
      }
    }

    initAuth()
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return () => unsubscribe()
  }, [])

  // Load saved profiles
  useEffect(() => {
    if (!user || !db) return

    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'profiles'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profiles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Profile))
      setSavedProfiles(profiles.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)))
    })
    return () => unsubscribe()
  }, [user])

  // Load external scripts
  useEffect(() => {
    const loadScript = (src: string) => {
      if (document.querySelector(`script[src="${src}"]`)) return
      const script = document.createElement('script')
      script.src = src
      script.async = true
      document.body.appendChild(script)
    }

    loadScript('https://unpkg.com/mammoth@1.4.21/mammoth.browser.min.js')
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js')
    loadScript('https://cdn.jsdelivr.net/npm/docx@7.8.2/build/index.min.js')
  }, [])

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (text && previewRef.current && selection?.anchorNode && previewRef.current.contains(selection.anchorNode)) {
      setFloatingMenu((prev) => ({
        ...prev,
        visible: true,
        text: text,
        chatResponse: prev.text !== text ? null : prev.chatResponse,
        chips: prev.text !== text ? [] : prev.chips
      }))
    }
  }

  const handleContextualAction = () => {
    if (floatingMenu.mode === 'edit') applyContextualEdit()
    else if (floatingMenu.mode === 'ask') askContextualQuestion()
  }

  const generateEmphasizeChips = async () => {
    setFloatingMenu((prev) => ({ ...prev, mode: 'emphasize' }))
    if (floatingMenu.chips?.length > 0 || !floatingMenu.text) return

    setIsGeneratingChips(true)
    try {
      const data = await callGemini({
        contents: [
          {
            parts: [
              {
                text: `Analyze this resume snippet: "${floatingMenu.text}". Suggest 4 distinct, highly-actionable editing directives (max 4-5 words each) to rewrite and emphasize a specific strength (e.g., "Quantify financial impact", "Highlight technical leadership", "Reframe as Deal Exposure", "Make it more concise"). Return ONLY a JSON array of strings.`
              }
            ]
          }
        ],
        generationConfig: { responseMimeType: 'application/json' }
      })
      const generatedChips = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text)
      if (Array.isArray(generatedChips)) {
        setFloatingMenu((prev) => ({ ...prev, chips: generatedChips }))
      }
    } catch (err) {
      console.error('Failed to generate chips', err)
      setError(getErrorMessage(err, 'Failed to generate suggestions.'))
    } finally {
      setIsGeneratingChips(false)
    }
  }

  const callGemini = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.error || 'Gemini request failed.')
    }

    return data
  }

  const askContextualQuestion = async () => {
    if (!floatingMenu.text || !floatingMenu.prompt) return
    setIsAsking(true)
    setFloatingMenu((prev) => ({ ...prev, chatResponse: null }))
    try {
      const data = await callGemini({
        contents: [
          {
            parts: [
              {
                text: `User Selection: "${floatingMenu.text}"\nQuestion: "${floatingMenu.prompt}"\nSystem: Answer like a brief WhatsApp message from a recruiter (1-3 sentences).`
              }
            ]
          }
        ]
      })
      setFloatingMenu((prev) => ({
        ...prev,
        chatResponse: data.candidates?.[0]?.content?.parts?.[0]?.text,
        prompt: ''
      }))
    } catch (err) {
      setError(getErrorMessage(err, 'AI response failed.'))
    } finally {
      setIsAsking(false)
    }
  }

  const applyContextualEdit = async (overridePrompt: string | null = null) => {
    const activePrompt = overridePrompt || floatingMenu.prompt
    if (!floatingMenu.text || !activePrompt) return

    setIsEditingSelection(true)
    if (overridePrompt) setFloatingMenu((prev) => ({ ...prev, prompt: activePrompt, mode: 'edit' }))

    const activeDocumentText = activeTab === 'output' ? optimizedCv : coverLetter

    try {
      const data = await callGemini({
        contents: [
          {
            parts: [
              {
                text: `Instruction: ${activePrompt}\nSelection: ${floatingMenu.text}\nFull Document: ${activeDocumentText}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: 'Locate and rewrite ONLY the selected markdown section based on the instruction. Maintain strict professional formatting (use **bold** for titles/companies). Output JSON: {"original_markdown": "...", "new_markdown": "..."}'
            }
          ]
        },
        generationConfig: { responseMimeType: 'application/json' }
      })
      const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text)
      if (parsed.original_markdown && parsed.new_markdown) {
        if (activeTab === 'output') {
          setOptimizedCv((prev) => prev.replace(parsed.original_markdown, parsed.new_markdown))
        } else {
          setCoverLetter((prev) => prev.replace(parsed.original_markdown, parsed.new_markdown))
        }
        setFloatingMenu({ visible: false, text: '', prompt: '', mode: 'edit', chatResponse: null, chips: [] })
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Edit failed.'))
    } finally {
      setIsEditingSelection(false)
    }
  }

  const saveCurrentProfile = async () => {
    if (!user || !optimizedCv || !db) return
    setIsSaving(true)
    try {
      const name = prompt('Name this profile:') || `Ready Profile ${new Date().toLocaleDateString()}`
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'profiles'), {
        name,
        cvText,
        jobDescription,
        optimizedCv,
        signals,
        optimizationMode,
        timestamp: serverTimestamp()
      })
    } catch (err) {
      setError('Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteProfile = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation()
    if (!db || !user) return
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profiles', profileId))
    } catch (err) {
      setError('Delete failed.')
    }
  }

  const loadProfile = (p: Profile) => {
    setCvText(p.cvText)
    setJobDescription(p.jobDescription)
    setOptimizedCv(p.optimizedCv)
    setSignals(p.signals)
    setOptimizationMode(p.optimizationMode)
    setActiveTab('output')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) await processFiles(files)
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) await processFiles(files)
  }

  const processFiles = async (files: File[]) => {
    setIsReadingFile(true)
    let combinedText = cvText
    try {
      for (const file of files) {
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const mammoth = (window as any).mammoth
          if (mammoth) {
            const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
            combinedText += (combinedText ? '\n\n' : '') + res.value
          }
        } else if (file.type === 'application/pdf') {
          const pdfjsLib = (window as any).pdfjsLib
          if (pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
            const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
            let txt = ''
            for (let i = 1; i <= pdf.numPages; i++) {
              const pg = await pdf.getPage(i)
              const content = await pg.getTextContent()
              txt += content.items.map((item: any) => item.str).join(' ') + '\n'
            }
            combinedText += (combinedText ? '\n\n' : '') + txt
          }
        } else if (file.type.startsWith('image/')) {
          const base64 = await toBase64(file)
          const data = await callGemini({
            contents: [
              {
                parts: [
                  { text: 'Extract text from CV screenshot.' },
                  { inlineData: { mimeType: file.type, data: base64 } }
                ]
              }
            ]
          })
          combinedText += (combinedText ? '\n\n' : '') + (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
        }
      }
      setCvText(combinedText)
    } catch (err) {
      setError(getErrorMessage(err, 'Extraction error.'))
    } finally {
      setIsReadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toBase64 = (file: File) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result!.toString().split(',')[1])
    })

  const generateTailoredCV = async () => {
    if (!cvText || !jobDescription) return
    setIsGenerating(true)
    const prompt = `Elite IB Resume Expert. Rules: Strictly one page. No artifacts (***).
    
    MANDATORY FORMATTING:
    - Use bold (**text**) for Company Names, Institutions, and Job Titles to make them pop.
    - Ensure a clear blank line before every new section header (##).
    - Format experience headers clearly (e.g. **Company Name** | **Job Title** | Dates).
    
    MANDATORY STRUCTURE: Header (Centered), Professional Summary (3-4 lines Framing), Education (GPA ${signals.gpa}, Test ${signals.testScores}), Experience (Action+Quant), Skills/Interests. 
    Logic: ${signals.structureInstructions}. 
    Perform FIT ANALYSIS. JSON Output: { "cv": "...", "score": 0, "reasons": [], "missing": [] }`

    try {
      const resData = await callGemini({
        contents: [{ parts: [{ text: `CV: ${cvText}\nJD: ${jobDescription}` }] }],
        systemInstruction: { parts: [{ text: prompt }] },
        generationConfig: { responseMimeType: 'application/json' }
      })
      const res = JSON.parse(resData.candidates[0].content.parts[0].text)
      setOptimizedCv(res.cv.replace(/\*\*\*/g, ''))
      setFitAnalysis({ score: res.score, reasons: res.reasons, missing: res.missing })
      setActiveTab('output')
    } catch (err) {
      setError(getErrorMessage(err, 'Generation failed.'))
    } finally {
      setIsGenerating(false)
    }
  }

  const generateCoverLetter = async () => {
    if (!optimizedCv || !jobDescription) return
    setIsGeneratingLetter(true)
    const letterPrompt = `Create a matching cover letter for this high-stakes finance role. Limit to 350 words. Format in clean markdown. No artifacts (***).`

    try {
      const data = await callGemini({
        contents: [{ parts: [{ text: `CV: ${optimizedCv}\nJOB: ${jobDescription}` }] }],
        systemInstruction: { parts: [{ text: letterPrompt }] }
      })
      setCoverLetter(data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/\*\*\*/g, '') || '')
      setActiveTab('coverletter')
    } catch (err) {
      setError(getErrorMessage(err, 'Letter generation failed.'))
    } finally {
      setIsGeneratingLetter(false)
    }
  }

  const generatePortfolioStrategy = async () => {
    if (!cvText || !jobDescription) return
    setIsStrategizing(true)
    const portfolioPrompt = `Specialized Finance Portfolio Strategist. Analyze CV and Job. Output format: { "projects": [{ "title", "tier", "description", "tools", "outcomeGoal" }], "bridge": { "from", "to", "reasoning" } }`

    try {
      const data = await callGemini({
        contents: [{ parts: [{ text: `CV: ${cvText}\nJOB: ${jobDescription}` }] }],
        systemInstruction: { parts: [{ text: portfolioPrompt }] },
        generationConfig: { responseMimeType: 'application/json' }
      })
      setPortfolioStrategy(JSON.parse(data.candidates[0].content.parts[0].text))
      setActiveTab('portfolio')
    } catch (err) {
      setError(getErrorMessage(err, 'Strategy failed.'))
    } finally {
      setIsStrategizing(false)
    }
  }

  const exportToDocx = async (text: string, fileName: string) => {
    const docxLib = (window as any).docx
    if (!docxLib) return

    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = docxLib
      const parseLine = (t: string) =>
        t
          .split(/(\*\*.*?\*\*)/g)
          .filter((p) => p)
          .map(
            (part) =>
              new TextRun({
                text: part.startsWith('**') ? part.slice(2, -2) : part,
                bold: part.startsWith('**'),
                font: 'Times New Roman',
                size: fontSize * 2
              })
          )

      const children = text
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => {
          if (line.startsWith('# '))
            return new Paragraph({
              text: line.replace('# ', '').toUpperCase(),
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
              border: { bottom: { color: '000000', space: 1, value: BorderStyle.SINGLE, size: 12 } }
            })
          if (line.startsWith('## '))
            return new Paragraph({
              text: line.replace('## ', '').toUpperCase(),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 360, after: 120 },
              border: { bottom: { color: '000000', space: 1, value: BorderStyle.SINGLE, size: 6 } }
            })
          if (line.startsWith('### '))
            return new Paragraph({
              children: parseLine(line.replace('### ', '')),
              spacing: { before: 120, after: 60 },
              bold: true
            })
          if (line.startsWith('* ') || line.startsWith('- '))
            return new Paragraph({
              children: parseLine(line.slice(2)),
              bullet: { level: 0 },
              spacing: { after: 60 }
            })
          return new Paragraph({
            children: parseLine(line),
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED
          })
        })

      const blob = await Packer.toBlob(
        new Document({
          sections: [
            {
              properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
              children
            }
          ]
        })
      )
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${fileName}.docx`
      link.click()
    } catch (err) {
      console.error(err)
    }
  }

  const renderPreviewHtml = (markdown: string) => {
    if (!markdown) return ''
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-center font-bold uppercase border-b-2 border-black mb-6 pb-1 text-[1.2em]"> $1 </h1>')
      .replace(/^## (.*$)/gim, '<div class="mt-6 mb-3 border-b border-black"><h2 class="font-bold uppercase tracking-tight text-[1.05em]"> $1 </h2></div>')
      .replace(/^### (.*$)/gim, '<h3 class="font-bold mt-4 mb-1 text-[1em]"> $1 </h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\* (.*$)/gim, '<li class="ml-5 list-disc pl-1 mb-1.5 marker:text-slate-400"> $1 </li>')
      .replace(/^- (.*$)/gim, '<li class="ml-5 list-disc pl-1 mb-1.5 marker:text-slate-400"> $1 </li>')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br/>')
  }

  const getProcessedText = (text: string) => {
    if (!text) return ''
    return removeEmDashes ? text.replace(/—|–/g, '-') : text
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100 relative">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-600/30">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">
              CV Master <span className="text-indigo-400 font-black">PRO</span>
            </h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">High-Stakes Recruitment Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user && savedProfiles.length > 0 && (
            <div className="text-[10px] text-slate-400 font-bold bg-slate-800 px-3 py-1 rounded-full">
              <History className="w-3 h-3 inline mr-1" />
              {savedProfiles.length} Readiness Points
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        <div className="lg:col-span-7 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in zoom-in-95">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          {savedProfiles.length > 0 && (
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">
                <Layers className="w-3.5 h-3.5" /> Starting Point Library
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {savedProfiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => loadProfile(p)}
                    className="flex-shrink-0 w-44 p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-indigo-50 cursor-pointer relative group transition-all"
                  >
                    <h4 className="text-[11px] font-bold text-slate-800 truncate pr-4">{p.name}</h4>
                    <button
                      onClick={(e) => {
                        deleteProfile(e, p.id)
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl space-y-8 border border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {signalFieldKeys.map((k) => (
                <div key={k}>
                  <label className="text-[10px] uppercase font-black text-slate-500 block mb-2 tracking-widest">
                    {k.replace(/([A-Z])/g, ' $1')}
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    value={signals[k]}
                    onChange={(e) =>
                      setSignals({
                        ...signals,
                        [k]: e.target.value
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                <BookOpen className="w-4 h-4" /> Strategic Philosophy & Structure (Editable)
              </div>
              <textarea
                className="w-full h-40 bg-transparent text-[12px] font-mono leading-relaxed focus:outline-none text-slate-200 resize-none"
                value={signals.structureInstructions}
                onChange={(e) =>
                  setSignals({
                    ...signals,
                    structureInstructions: e.target.value
                  })
                }
                placeholder="Define the core optimization logic..."
              />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2 font-black text-slate-800 text-[11px] uppercase tracking-widest">
                <FileText className="w-4 h-4 text-indigo-600" /> Source CV Data
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Upload className="w-4 h-4" /> Upload Files/Screenshots
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.docx,.txt,image/*"
                onChange={(e) => handleFileUpload(e)}
              />
            </div>
            <textarea
              onPaste={handlePaste}
              className="w-full h-80 p-8 text-sm font-mono focus:outline-none bg-transparent placeholder:text-slate-300 transition-all focus:bg-white resize-none leading-relaxed"
              placeholder="Paste text or snapshots here. AI automatically OCRs and bridges your data..."
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50 font-black text-slate-800 text-[11px] uppercase tracking-widest">
              <Target className="w-4 h-4 text-indigo-600" /> Target Job Profile
            </div>
            <textarea
              className="w-full h-40 p-8 text-sm focus:outline-none bg-transparent placeholder:text-slate-300"
              placeholder="Paste JD..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={generateTailoredCV}
              disabled={isGenerating || !cvText || !jobDescription}
              className="flex-1 py-6 rounded-[2rem] bg-indigo-600 text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:bg-slate-200 flex items-center justify-center gap-3 transition-all active:translate-y-1"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />} Rewrite My CV & Score Fit
            </button>
            <button
              onClick={() => {
                setActiveTab('portfolio')
                generatePortfolioStrategy()
              }}
              disabled={isStrategizing || !cvText || !jobDescription}
              className="px-10 py-6 rounded-[2rem] bg-slate-900 text-white font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-black disabled:bg-slate-200 flex items-center justify-center transition-all active:translate-y-1"
            >
              {isStrategizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lightbulb className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4 h-[calc(100vh-140px)] sticky top-24 flex flex-col relative">
          <div className="flex bg-slate-200/50 p-1.5 rounded-[1.5rem] border border-slate-200 text-[10px] font-black uppercase">
            <button
              onClick={() => setActiveTab('output')}
              disabled={!optimizedCv}
              className={`flex-1 py-3 rounded-2xl transition-all ${
                activeTab === 'output' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              CV Preview
            </button>
            <button
              onClick={() => setActiveTab('coverletter')}
              disabled={!optimizedCv}
              className={`flex-1 py-3 rounded-2xl transition-all ${
                activeTab === 'coverletter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              Cover Letter
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              disabled={!portfolioStrategy}
              className={`flex-1 py-3 rounded-2xl transition-all ${
                activeTab === 'portfolio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              Tiered Strategy
            </button>
          </div>

          {(activeTab === 'output' || activeTab === 'coverletter') && optimizedCv && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-full relative">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                {activeTab === 'output' && fitAnalysis && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-indigo-100 flex items-center justify-center relative">
                      <span className="text-[11px] font-black text-indigo-600">{fitAnalysis.score}%</span>
                      <div
                        className="absolute inset-0 rounded-full border-2 border-indigo-600 transition-all duration-1000"
                        style={{ clipPath: `inset(0 ${100 - fitAnalysis.score}% 0 0)` }}
                      ></div>
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Fit Analysis</div>
                  </div>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={saveCurrentProfile}
                    className="p-3 hover:bg-slate-100 rounded-2xl text-slate-600 transition-all active:scale-95 shadow-sm border border-slate-100 flex items-center justify-center"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      exportToDocx(
                        activeTab === 'output' ? getProcessedText(optimizedCv) : getProcessedText(coverLetter),
                        activeTab === 'output' ? 'Ready_Resume' : 'Ready_Letter'
                      )
                    }
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black shadow-xl hover:bg-black transition-all active:scale-95"
                  >
                    <FileDown className="w-4 h-4" /> .DOCX
                  </button>
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-6">
                <div className="flex items-center gap-3 flex-1">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="range"
                    min="8"
                    max="13"
                    step="0.5"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[10px] font-black text-slate-600 w-8 text-right">{fontSize}pt</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-500 uppercase hover:text-slate-700">
                  <input
                    type="checkbox"
                    checked={removeEmDashes}
                    onChange={(e) => setRemoveEmDashes(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Remove Em-Dashes (—)
                </label>
                <div className="text-[8px] text-indigo-400 uppercase font-black tracking-widest border border-indigo-100 px-2 py-1 rounded-full animate-pulse hidden md:block">
                  Select text to edit
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-slate-50/50 shadow-inner relative group">
                <div
                  ref={previewRef}
                  onMouseUp={handleTextSelection}
                  className="bg-white shadow-2xl mx-auto p-12 min-h-full border border-slate-100 text-black text-justify transition-all cursor-text selection:bg-indigo-200 leading-normal"
                  style={{
                    fontFamily: '"Times New Roman", serif',
                    fontSize: `${fontSize}pt`,
                    maxWidth: '8.5in'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: renderPreviewHtml(
                      activeTab === 'output'
                        ? getProcessedText(optimizedCv)
                        : getProcessedText(coverLetter) || 'Generate Cover Letter to view...'
                    )
                  }}
                />

                {activeTab === 'coverletter' && !coverLetter && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10 p-12 text-center animate-in fade-in">
                    <FileSignature className="w-16 h-16 text-slate-200 mb-6" />
                    <button
                      onClick={() => {
                        generateCoverLetter()
                      }}
                      disabled={isGeneratingLetter}
                      className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
                    >
                      {isGeneratingLetter ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Draft Cover Letter
                    </button>
                  </div>
                )}

                {floatingMenu.visible && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-slate-900 border border-slate-700 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-[2rem] p-5 animate-in slide-in-from-bottom-8 z-50">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3 px-1">
                      <div className="flex gap-4">
                        <button
                          onClick={() => setFloatingMenu((prev) => ({ ...prev, mode: 'edit' }))}
                          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${
                            floatingMenu.mode === 'edit' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setFloatingMenu((prev) => ({ ...prev, mode: 'ask' }))}
                          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${
                            floatingMenu.mode === 'ask' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Ask
                        </button>
                        <button
                          onClick={generateEmphasizeChips}
                          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${
                            floatingMenu.mode === 'emphasize' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Emphasize
                        </button>
                      </div>
                      <button
                        onClick={() =>
                          setFloatingMenu({
                            visible: false,
                            text: '',
                            prompt: '',
                            mode: 'edit',
                            chatResponse: null,
                            chips: []
                          })
                        }
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {floatingMenu.mode === 'emphasize' && (
                      <div className="mb-4">
                        {isGeneratingChips ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400 italic px-2 py-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Mining strategic angles...
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {floatingMenu.chips?.map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => applyContextualEdit(chip)}
                                className="px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border border-amber-500/30 rounded-xl text-[11px] font-bold transition-all text-left"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {floatingMenu.mode === 'ask' && floatingMenu.chatResponse && (
                      <div className="mb-4 bg-slate-800 rounded-2xl p-4 text-xs text-slate-200 border border-slate-700 shadow-inner leading-relaxed animate-in fade-in slide-in-from-top-2">
                        {floatingMenu.chatResponse}
                      </div>
                    )}

                    {floatingMenu.mode !== 'emphasize' && (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 shadow-inner"
                          placeholder={floatingMenu.mode === 'edit' ? 'Instructions...' : 'Ask recruiter...'}
                          value={floatingMenu.prompt}
                          onChange={(e) => setFloatingMenu((prev) => ({ ...prev, prompt: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleContextualAction()}
                        />
                        <button
                          onClick={handleContextualAction}
                          className={`${
                            floatingMenu.mode === 'edit' ? 'bg-indigo-600' : 'bg-emerald-600'
                          } p-3 rounded-2xl text-white shadow-lg active:scale-95 transition-all flex items-center justify-center`}
                        >
                          {floatingMenu.mode === 'edit' ? isEditingSelection : isAsking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'portfolio' && portfolioStrategy && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl h-full p-10 overflow-y-auto space-y-10 animate-in slide-in-from-right-8">
              <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                <Zap className="w-8 h-8 text-amber-500 fill-amber-500" />
                <h2 className="font-black text-slate-900 uppercase tracking-tighter text-xl">Prestige Strategy Guide</h2>
              </div>
              <div className="space-y-6">
                {(Array.isArray(portfolioStrategy.projects) ? portfolioStrategy.projects : []).map((p, i) => (
                  <div key={i} className="border border-slate-100 rounded-[2rem] p-8 bg-white shadow-sm hover:shadow-2xl transition-all group">
                    <span className="text-[9px] font-black px-4 py-1.5 rounded-full bg-slate-900 text-white uppercase tracking-[0.2em] mb-4 inline-block">
                      {String(p.tier)}
                    </span>
                    <h4 className="font-black text-slate-800 text-base mb-3 group-hover:text-indigo-600 transition-colors">{String(p.title)}</h4>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">{String(p.description)}</p>
                    <div className="text-[10px] font-black text-indigo-600 border-t border-slate-50 pt-5 uppercase flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> READINESS SIGNAL: <span className="text-slate-800 font-bold">{String(p.outcomeGoal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!optimizedCv && (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 px-16 text-center shadow-inner">
              <Target className="w-20 h-16 text-slate-200 mb-8" />
              <h3 className="font-black text-slate-800 text-xl mb-4 uppercase tracking-[0.2em]">Target Locked</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">Paste your target job and raw CV data to calculate high-prestige alignment.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
