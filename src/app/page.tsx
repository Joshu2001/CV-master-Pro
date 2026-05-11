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
  ChevronLeft,
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
  Sparkles,
  Maximize2,
  Minimize2
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

type GeminiRequestOptions = {
  model?: string
  timeoutMs?: number
  cacheTtlMs?: number
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

interface GenerationSummary {
  headline: string
  changes: string[]
  structure: string[]
  why: string[]
}

const signalFieldKeys = ['gpa', 'testScores', 'cfaStatus'] as const
const GEMINI_CACHE_TTL_MS = 90_000
const GEMINI_REQUEST_TIMEOUT_MS = 6_500
const GEMINI_MAX_RETRIES = 2
const GEMINI_RETRY_BASE_DELAY_MS = 120

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const parseJsonResponse = (value: string | undefined) => {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const compactPromptText = (value: string) =>
  value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const normalizeGeminiPayload = (value: unknown): unknown => {
  if (typeof value === 'string') return compactPromptText(value)
  if (Array.isArray(value)) return value.map(normalizeGeminiPayload)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, normalizeGeminiPayload(entryValue)])
    )
  }

  return value
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`
}

const buildGeminiCacheKey = (payload: Record<string, unknown>, options: GeminiRequestOptions) =>
  stableStringify({ payload, model: options.model || 'default' })

const isRetryableGeminiError = (message: string) =>
  /timed out|failed to reach gemini|429|5\d\d|503|502|504/i.test(message)

const sleep = (delayMs: number) => new Promise((resolve) => window.setTimeout(resolve, delayMs))

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
  const [copiedTarget, setCopiedTarget] = useState<'output' | 'coverletter' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'coverletter' | 'portfolio'>('input')
  const [fontSize, setFontSize] = useState(10)
  const [savedProfiles, setSavedProfiles] = useState<Profile[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [removeEmDashes, setRemoveEmDashes] = useState(false)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [isManualEditing, setIsManualEditing] = useState(false)
  const [manualDraft, setManualDraft] = useState('')
  const [editHistory, setEditHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [cvLastModified, setCvLastModified] = useState(0)
  const [coverLetterGeneratedAt, setCoverLetterGeneratedAt] = useState(0)
  const [isCoverLetterOutOfSync, setIsCoverLetterOutOfSync] = useState(false)
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
  const [contextualError, setContextualError] = useState<string | null>(null)
  const [cvSummary, setCvSummary] = useState<GenerationSummary | null>(null)
  const [coverLetterSummary, setCoverLetterSummary] = useState<GenerationSummary | null>(null)
  const [isSummarizingCv, setIsSummarizingCv] = useState(false)
  const [isSummarizingCoverLetter, setIsSummarizingCoverLetter] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const manualEditorRef = useRef<HTMLDivElement>(null)
  const manualHtmlRef = useRef('')
  const selectionRangeRef = useRef<Range | null>(null)
  const geminiResponseCacheRef = useRef(new Map<string, { expiresAt: number; data: any }>())
  const geminiInflightRequestsRef = useRef(new Map<string, Promise<any>>())
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

  // Track when CV is modified to detect sync state with cover letter
  useEffect(() => {
    if (optimizedCv && cvLastModified === 0) {
      // First time CV is generated
      setCvLastModified(Date.now())
    } else if (optimizedCv && cvLastModified > 0) {
      // CV already existed, it's been modified
      setCvLastModified(Date.now())
      setIsCoverLetterOutOfSync(true)
    }
  }, [optimizedCv])

  useEffect(() => {
    setIsManualEditing(false)
    setManualDraft('')
    clearSelectionHighlight()
  }, [activeTab])

  useEffect(() => {
    if (!copiedTarget) return

    const timeoutId = window.setTimeout(() => {
      setCopiedTarget(null)
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [copiedTarget])

  useEffect(() => {
    if (!isManualEditing || !manualEditorRef.current) return
    const editor = manualEditorRef.current
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [isManualEditing])

  useEffect(() => {
    if (!isManualEditing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isManualEditing, historyIndex, editHistory])

  const clearSelectionHighlight = () => {
    selectionRangeRef.current = null

    const cssApi = CSS as typeof CSS & {
      highlights?: {
        delete: (name: string) => void
      }
    }

    cssApi.highlights?.delete('context-selection')

    const selection = window.getSelection()
    selection?.removeAllRanges()
  }

  const applySelectionHighlight = (range: Range) => {
    selectionRangeRef.current = range.cloneRange()

    const cssApi = CSS as typeof CSS & {
      highlights?: {
        set: (name: string, highlight: unknown) => void
        delete: (name: string) => void
      }
    }
    const highlightConstructor = (window as Window & {
      Highlight?: new (...ranges: Range[]) => unknown
    }).Highlight

    cssApi.highlights?.delete('context-selection')

    if (cssApi.highlights && highlightConstructor) {
      cssApi.highlights.set('context-selection', new highlightConstructor(range.cloneRange()))
      return
    }

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range.cloneRange())
  }

  const normalizeForMatch = (value: string) =>
    value
      .replace(/[*_#>`-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

  const findMatchingMarkdownSection = (documentText: string, selectedText: string) => {
    const normalizedSelection = normalizeForMatch(selectedText)
    if (!normalizedSelection) return null

    const blocks = documentText
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)

    const exactBlockMatch = blocks.find((block) => normalizeForMatch(block).includes(normalizedSelection))
    if (exactBlockMatch) return exactBlockMatch

    const lines = documentText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    return lines.find((line) => normalizeForMatch(line).includes(normalizedSelection)) || null
  }

  const getActiveDocumentMarkdown = () => {
    if (isManualEditing) {
      return htmlToMarkdown(manualEditorRef.current?.innerHTML || manualHtmlRef.current || manualDraft)
    }

    return activeTab === 'output' ? optimizedCv : coverLetter
  }

  const hideFloatingMenu = () => {
    setFloatingMenu({ visible: false, text: '', prompt: '', mode: 'edit', chatResponse: null, chips: [] })
    setContextualError(null)
    clearSelectionHighlight()
  }

  const applyUpdatedDocument = (updatedDocument: string) => {
    if (isManualEditing) {
      const updatedHtml = renderPreviewHtml(getProcessedText(updatedDocument))
      setManualDraft(updatedHtml)
      manualHtmlRef.current = updatedHtml
      if (manualEditorRef.current) {
        manualEditorRef.current.innerHTML = updatedHtml
      }
      setEditHistory((prev) => [...prev.slice(0, historyIndex + 1), updatedHtml])
      setHistoryIndex((prev) => prev + 1)
      return
    }

    if (activeTab === 'output') {
      setOptimizedCv(updatedDocument)
    } else {
      setCoverLetter(updatedDocument)
    }
  }

  const applyLocalInstruction = (section: string, instruction: string) => {
    const trimmedInstruction = instruction.trim()
    const addMatch = trimmedInstruction.match(/^(add|append|include|insert)\s+(.+)$/i)
    if (addMatch) {
      const addition = addMatch[2].trim()
      if (!addition) return null

      if (section.includes(':') && !section.includes('\n')) {
        const separator = /[:,;]\s*$/.test(section) ? ' ' : ', '
        return `${section}${separator}${addition}`
      }

      if (section.startsWith('- ')) {
        return `${section}; ${addition}`
      }

      return `${section}${section.endsWith('\n') ? '' : ' '}${addition}`
    }

    const replaceMatch = trimmedInstruction.match(/^replace\s+(.+?)\s+with\s+(.+)$/i)
    if (replaceMatch) {
      const target = replaceMatch[1].trim()
      const replacement = replaceMatch[2].trim()
      return section.includes(target) ? section.replace(target, replacement) : null
    }

    const removeMatch = trimmedInstruction.match(/^(remove|delete)\s+(.+)$/i)
    if (removeMatch) {
      const target = removeMatch[2].trim()
      return section.includes(target) ? section.replace(target, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim() : null
    }

    return null
  }

  const copyActiveBody = async () => {
    const activeKey = activeTab === 'output' ? 'output' : 'coverletter'
    const bodyText = getProcessedText(getActiveDocumentMarkdown())
    if (!bodyText) return

    try {
      await navigator.clipboard.writeText(bodyText)
      setCopiedTarget(activeKey)
    } catch (err) {
      setError(getErrorMessage(err, 'Copy failed.'))
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    const isInPreview = previewRef.current && selection?.anchorNode && previewRef.current.contains(selection.anchorNode)
    const isInManual = manualEditorRef.current && selection?.anchorNode && manualEditorRef.current.contains(selection.anchorNode)

    if (text && (isInPreview || isInManual) && selection?.rangeCount) {
      applySelectionHighlight(selection.getRangeAt(0).cloneRange())
      setContextualError(null)

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

  const openManualEditor = () => {
    const activeDoc = activeTab === 'output' ? optimizedCv : coverLetter
    const html = renderPreviewHtml(getProcessedText(activeDoc))
    setManualDraft(html)
    manualHtmlRef.current = html
    hideFloatingMenu()
    setIsManualEditing(true)
    // Initialize history when entering manual edit mode
    setEditHistory([html])
    setHistoryIndex(0)
  }

  const saveManualEdits = () => {
    const html = manualEditorRef.current?.innerHTML || manualHtmlRef.current || manualDraft
    const markdown = htmlToMarkdown(html)
    
    // Add to edit history when saving
    setEditHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(html)
      return newHistory
    })
    setHistoryIndex((prev) => prev + 1)
    
    if (activeTab === 'output') {
      setOptimizedCv(markdown)
      // Mark cover letter as out of sync when CV is modified
      setCvLastModified(Date.now())
      setIsCoverLetterOutOfSync(true)
    } else {
      setCoverLetter(markdown)
    }
    setIsManualEditing(false)
    setManualDraft('')
    manualHtmlRef.current = ''
    setEditHistory([])
    setHistoryIndex(-1)
  }

  const handleUndo = () => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    setManualDraft(editHistory[newIndex])
    manualHtmlRef.current = editHistory[newIndex]
    if (manualEditorRef.current) {
      manualEditorRef.current.innerHTML = editHistory[newIndex]
    }
  }

  const handleRedo = () => {
    if (historyIndex >= editHistory.length - 1) return
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    setManualDraft(editHistory[newIndex])
    manualHtmlRef.current = editHistory[newIndex]
    if (manualEditorRef.current) {
      manualEditorRef.current.innerHTML = editHistory[newIndex]
    }
  }

  const cancelManualEdits = () => {
    setIsManualEditing(false)
    setManualDraft('')
    manualHtmlRef.current = ''
    clearSelectionHighlight()
  }

  const handlePreviewTap = () => {
    if (isManualEditing) return
    const selectionText = window.getSelection()?.toString().trim()
    if (selectionText) return
    openManualEditor()
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

  const callGemini = async (payload: Record<string, unknown>, options: GeminiRequestOptions = {}) => {
    const normalizedPayload = normalizeGeminiPayload(payload) as Record<string, unknown>
    const mergedOptions: GeminiRequestOptions = {
      timeoutMs: options.timeoutMs ?? GEMINI_REQUEST_TIMEOUT_MS,
      cacheTtlMs: options.cacheTtlMs ?? GEMINI_CACHE_TTL_MS,
      model: options.model
    }
    const cacheKey = buildGeminiCacheKey(normalizedPayload, mergedOptions)
    const now = Date.now()
    const cached = geminiResponseCacheRef.current.get(cacheKey)

    if (cached && cached.expiresAt > now) {
      return cached.data
    }

    const inflight = geminiInflightRequestsRef.current.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const requestPromise = (async () => {
      let lastError: unknown = null

      for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
        try {
          const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...normalizedPayload,
              model: mergedOptions.model,
              timeoutMs: mergedOptions.timeoutMs
            })
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data?.error || 'Gemini request failed.')
          }

          geminiResponseCacheRef.current.set(cacheKey, {
            expiresAt: Date.now() + (mergedOptions.cacheTtlMs || GEMINI_CACHE_TTL_MS),
            data
          })

          return data
        } catch (error) {
          lastError = error
          const message = getErrorMessage(error, 'Gemini request failed.')

          if (attempt === GEMINI_MAX_RETRIES || !isRetryableGeminiError(message)) {
            throw error
          }

          await sleep(GEMINI_RETRY_BASE_DELAY_MS * (attempt + 1))
        }
      }

      throw lastError
    })()

    geminiInflightRequestsRef.current.set(cacheKey, requestPromise)

    try {
      return await requestPromise
    } finally {
      geminiInflightRequestsRef.current.delete(cacheKey)
    }
  }

  const generateArtifactSummary = async ({
    artifactType,
    sourceText,
    outputText
  }: {
    artifactType: 'cv' | 'coverletter'
    sourceText: string
    outputText: string
  }) => {
    const setLoading = artifactType === 'cv' ? setIsSummarizingCv : setIsSummarizingCoverLetter
    const setSummary = artifactType === 'cv' ? setCvSummary : setCoverLetterSummary

    setLoading(true)

    try {
      const data = await callGemini({
        contents: [
          {
            parts: [
              {
                text: `Job Description:\n${jobDescription}\n\nOriginal Source:\n${sourceText}\n\nGenerated ${artifactType === 'cv' ? 'CV' : 'Cover Letter'}:\n${outputText}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: `Explain the generated ${artifactType === 'cv' ? 'CV' : 'cover letter'} to the user in concise plain English. Return JSON in this exact shape: {"headline":"...","changes":["..."],"structure":["..."],"why":["..."]}. Keep each array to 2-4 short items focused on what changed, how it is structured, and why those choices help.`
            }
          ]
        },
        generationConfig: { responseMimeType: 'application/json' }
      })

      const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
      setSummary({
        headline: typeof parsed.headline === 'string' ? parsed.headline : artifactType === 'cv' ? 'CV rewrite summary' : 'Cover letter summary',
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        structure: Array.isArray(parsed.structure) ? parsed.structure : [],
        why: Array.isArray(parsed.why) ? parsed.why : []
      })
    } catch (err) {
      console.error(`Failed to summarize ${artifactType}`, err)
    } finally {
      setLoading(false)
    }
  }

  const askContextualQuestion = async () => {
    if (!floatingMenu.text || !floatingMenu.prompt) return
    setIsAsking(true)
    setContextualError(null)
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
    if (!floatingMenu.text || !activePrompt?.trim()) {
      setContextualError('Add edit instructions before sending.')
      return
    }

    setIsEditingSelection(true)
    setContextualError(null)
    if (overridePrompt) setFloatingMenu((prev) => ({ ...prev, prompt: activePrompt, mode: 'edit' }))

    const activeDocumentText = getActiveDocumentMarkdown()
    const matchedSection = findMatchingMarkdownSection(activeDocumentText, floatingMenu.text)

    if (!matchedSection) {
      setContextualError('Could not locate the selected section to edit.')
      setIsEditingSelection(false)
      return
    }

    const localRewrite = applyLocalInstruction(matchedSection, activePrompt)
    if (localRewrite && localRewrite !== matchedSection) {
      applyUpdatedDocument(activeDocumentText.replace(matchedSection, localRewrite))
      hideFloatingMenu()
      setError(null)
      setIsEditingSelection(false)
      return
    }

    try {
      const data = await callGemini({
        contents: [
          {
            parts: [
              {
                text: `Instruction: ${activePrompt.trim()}\nSelected Text: "${floatingMenu.text}"\nSection To Rewrite:\n${matchedSection}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: 'Rewrite only the provided markdown section based on the instruction. Preserve markdown structure and professional formatting. Return JSON: {"rewritten_markdown": "..."}'
            }
          ]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 220
        }
      }, {
        model: 'gemini-2.5-flash',
        timeoutMs: 5000
      })
      const parsed = parseJsonResponse(data.candidates?.[0]?.content?.parts?.[0]?.text)

      if (!parsed?.rewritten_markdown || typeof parsed.rewritten_markdown !== 'string') {
        setContextualError('No usable rewrite came back. Try a shorter instruction or a more specific command like add, replace, or remove.')
        return
      }

      if (parsed.rewritten_markdown) {
        const updatedDocument = activeDocumentText.replace(matchedSection, parsed.rewritten_markdown)
        applyUpdatedDocument(updatedDocument)

        hideFloatingMenu()
        setError(null)
      }
    } catch (err) {
      setContextualError(getErrorMessage(err, 'Edit failed. Try a shorter selection or specific add/replace/remove instruction.'))
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
      const cleanedCv = res.cv.replace(/\*\*\*/g, '')
      setOptimizedCv(cleanedCv)
      setFitAnalysis({ score: res.score, reasons: res.reasons, missing: res.missing })
      setActiveTab('output')
      void generateArtifactSummary({
        artifactType: 'cv',
        sourceText: cvText,
        outputText: cleanedCv
      })
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
      const generatedLetter = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/\*\*\*/g, '') || ''
      setCoverLetter(generatedLetter)
      setCoverLetterGeneratedAt(Date.now())
      setIsCoverLetterOutOfSync(false)
      setActiveTab('coverletter')
      void generateArtifactSummary({
        artifactType: 'coverletter',
        sourceText: optimizedCv,
        outputText: generatedLetter
      })
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
      .replace(/^\s*###\s+(.*$)/gim, '<h3 class="font-bold mt-4 mb-1 text-[1em]">$1</h3>')
      .replace(/^\s*##\s+(.*$)/gim, '<div class="mt-6 mb-3 border-b border-black"><h2 class="font-bold uppercase tracking-tight text-[1.05em]">$1</h2></div>')
      .replace(/^\s*#\s+(.*$)/gim, '<h1 class="text-center font-bold uppercase border-b-2 border-black mb-6 pb-1 text-[1.2em]">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\s*\*\s+(.*$)/gim, '<li class="ml-5 list-disc pl-1 mb-1.5 marker:text-slate-400">$1</li>')
      .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-5 list-disc pl-1 mb-1.5 marker:text-slate-400">$1</li>')
      .replace(/\*\*/g, '')
      .replace(/(^|\s)##\s+/gm, '$1')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br/>')
  }

  const renderInlineMarkdown = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const element = node as Element
    const content = Array.from(element.childNodes).map(renderInlineMarkdown).join('')
    const tag = element.tagName.toLowerCase()

    if (tag === 'strong' || tag === 'b') return `**${content}**`
    if (tag === 'em' || tag === 'i') return `*${content}*`
    if (tag === 'br') return '\n'
    return content
  }

  const htmlToMarkdown = (html: string) => {
    if (typeof window === 'undefined') return html

    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="manual-root">${html}</div>`, 'text/html')
    const root = doc.getElementById('manual-root')
    if (!root) return ''

    const lines: string[] = []

    for (const node of Array.from(root.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim()
        if (text) lines.push(text)
        continue
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue

      const element = node as Element
      const tag = element.tagName.toLowerCase()

      if (tag === 'h1') {
        lines.push(`# ${renderInlineMarkdown(element).trim()}`)
        continue
      }

      if (tag === 'h2') {
        lines.push(`## ${renderInlineMarkdown(element).trim()}`)
        continue
      }

      if (tag === 'h3') {
        lines.push(`### ${renderInlineMarkdown(element).trim()}`)
        continue
      }

      if (tag === 'ul' || tag === 'ol') {
        for (const li of Array.from(element.querySelectorAll('li'))) {
          lines.push(`- ${renderInlineMarkdown(li).trim()}`)
        }
        continue
      }

      if (tag === 'li') {
        lines.push(`- ${renderInlineMarkdown(element).trim()}`)
        continue
      }

      if (tag === 'div' && element.children.length === 1 && element.firstElementChild?.tagName.toLowerCase() === 'h2') {
        lines.push(`## ${renderInlineMarkdown(element.firstElementChild).trim()}`)
        continue
      }

      const line = renderInlineMarkdown(element).trim()
      if (line) lines.push(line)
    }

    return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  const getProcessedText = (text: string) => {
    if (!text) return ''
    return removeEmDashes ? text.replace(/—|–/g, '-') : text
  }

  const activeSummary = activeTab === 'output' ? cvSummary : activeTab === 'coverletter' ? coverLetterSummary : null
  const isSummaryLoading = activeTab === 'output' ? isSummarizingCv : activeTab === 'coverletter' ? isSummarizingCoverLetter : false
  const copyLabel = activeTab === 'output' ? 'CV' : 'Cover Letter'
  const canSubmitContextAction =
    floatingMenu.mode === 'edit'
      ? !!floatingMenu.prompt.trim() && !isEditingSelection
      : !!floatingMenu.prompt.trim() && !isAsking

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(148,163,184,0.18),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_45%,_#f8fafc_100%)] text-slate-900 font-sans selection:bg-blue-100 relative">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />
      <header className="bg-zinc-950/95 backdrop-blur border-b border-zinc-800 sticky top-0 z-40 shadow-md px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-inner shadow-blue-950/40">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight">
              CV Master <span className="text-blue-400 font-black">PRO</span>
            </h1>
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">High-Stakes Recruitment Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user && savedProfiles.length > 0 && (
            <div className="text-[10px] text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <History className="w-3 h-3" />
              {savedProfiles.length} Readiness Points
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto grid grid-cols-1 ${isPreviewExpanded ? 'max-w-none px-0 py-0' : 'lg:grid-cols-12 max-w-7xl px-6 py-8'} gap-8 relative transition-all duration-300 ease-in-out`}>
        {!isPreviewExpanded && (
        <div className="lg:col-span-4 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in zoom-in-95">
              <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
            </div>
          )}

          {savedProfiles.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">
                <Layers className="w-3.5 h-3.5" /> Starting Point Library
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {savedProfiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => loadProfile(p)}
                    className="flex-shrink-0 w-44 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 cursor-pointer relative group transition-all"
                  >
                    <h4 className="text-[11px] font-bold text-slate-800 truncate pr-4">{p.name}</h4>
                    <button
                      onClick={(e) => {
                        deleteProfile(e, p.id)
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 border border-slate-200"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-zinc-900 text-white rounded-xl p-6 shadow-lg border border-zinc-800 space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {signalFieldKeys.map((k) => (
                <div key={k}>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1.5 tracking-wider">
                    {k.replace(/([A-Z])/g, ' $1')}
                  </label>
                  <input
                    type="text"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
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
            <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase text-blue-400 tracking-widest">
                <BookOpen className="w-3.5 h-3.5" /> Strategic Philosophy
              </div>
              <textarea
                className="w-full h-32 bg-transparent text-[11px] font-mono leading-relaxed focus:outline-none text-zinc-300 resize-none"
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

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2 font-bold text-slate-700 text-xs tracking-tight">
                <FileText className="w-4 h-4 text-blue-600" /> Source CV Data
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 hover:text-blue-600 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Upload className="w-3 h-3" /> Upload Files
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
              className="w-full h-48 p-5 text-xs font-mono focus:outline-none bg-transparent placeholder:text-slate-400 transition-all focus:bg-slate-50/50 resize-none leading-relaxed"
              placeholder="Paste text or snapshots here. AI automatically OCRs and bridges your data..."
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/80 font-bold text-slate-700 text-xs tracking-tight">
              <Target className="w-4 h-4 text-blue-600" /> Target Job Profile
            </div>
            <textarea
              className="w-full h-32 p-5 text-xs focus:outline-none bg-transparent placeholder:text-slate-400 resize-none"
              placeholder="Paste JD..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 pb-8">
            <button
              onClick={generateTailoredCV}
              disabled={isGenerating || !cvText || !jobDescription}
              className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold uppercase text-[11px] tracking-widest shadow-md hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Rewrite CV & Score Fit
            </button>
            <button
              onClick={() => {
                setActiveTab('portfolio')
                generatePortfolioStrategy()
              }}
              disabled={isStrategizing || !cvText || !jobDescription}
              className="w-full py-4 rounded-xl bg-zinc-900 text-white font-bold uppercase text-[11px] tracking-widest shadow-md hover:bg-zinc-800 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all"
            >
              {isStrategizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />} Analyze Portfolio Strategy
            </button>
          </div>
        </div>
        )}

        <div className={`${isPreviewExpanded ? 'fixed inset-x-0 top-16 bottom-0 z-50 p-6 bg-slate-100/95 backdrop-blur-sm' : 'lg:col-span-8 h-[calc(100vh-140px)] sticky top-24'} flex flex-col relative transition-all duration-300 ease-in-out`}>
          <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-200 text-[10px] font-bold uppercase mb-4 shrink-0">
            <button
              onClick={() => setActiveTab('output')}
              disabled={!optimizedCv}
              className={`flex-1 py-3 rounded-2xl transition-all ${
                activeTab === 'output' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              CV Preview
            </button>
            <button
              onClick={() => setActiveTab('coverletter')}
              disabled={!optimizedCv}
              className={`flex-1 py-3 rounded-2xl transition-all ${
                activeTab === 'coverletter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cover Letter
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              disabled={!portfolioStrategy}
              className={`flex-1 py-3 rounded-2xl transition-all ${
                activeTab === 'portfolio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tiered Strategy
            </button>
          </div>

          {(activeTab === 'output' || activeTab === 'coverletter') && optimizedCv && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex flex-col h-full relative">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                {activeTab === 'output' && fitAnalysis && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border border-blue-200 flex items-center justify-center relative bg-white">
                      <span className="text-[10px] font-black text-blue-700">{fitAnalysis.score}%</span>
                      <div
                        className="absolute inset-0 rounded-full border-2 border-blue-600 transition-all duration-1000"
                        style={{ clipPath: `inset(0 ${100 - fitAnalysis.score}% 0 0)` }}
                      ></div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Fit Analysis</div>
                  </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                    className="p-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-600 transition-all shadow-sm"
                    title={isPreviewExpanded ? 'Minimize' : 'Expand Fullscreen'}
                  >
                    {isPreviewExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  {isManualEditing && (
                    <>
                      <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="p-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:text-slate-300 disabled:hover:bg-white transition-all shadow-sm"
                        title="Undo (Ctrl+Z)"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleRedo}
                        disabled={historyIndex >= editHistory.length - 1}
                        className="p-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:text-slate-300 disabled:hover:bg-white transition-all shadow-sm"
                        title="Redo (Ctrl+Y)"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {(activeTab === 'output' || activeTab === 'coverletter') && (
                    <button
                      onClick={() => (isManualEditing ? saveManualEdits() : openManualEditor())}
                      className="px-3 py-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-700 transition-all shadow-sm text-[10px] font-bold uppercase tracking-wide"
                    >
                      {isManualEditing ? 'Save Manual Edit' : 'Manual Edit'}
                    </button>
                  )}
                  {activeTab === 'coverletter' && coverLetter && (
                    <button
                      onClick={generateCoverLetter}
                      disabled={isGeneratingLetter}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border flex items-center gap-2 ${
                        isCoverLetterOutOfSync
                          ? 'animate-pulse-glow bg-blue-600 text-white border-blue-600 shadow-lg'
                          : 'hover:bg-slate-200 bg-white border-slate-200 text-slate-700 shadow-sm'
                      }`}
                      title={isCoverLetterOutOfSync ? 'Refresh cover letter to match updated CV' : 'Refresh cover letter'}
                    >
                      {isGeneratingLetter ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Refresh
                    </button>
                  )}
                  {isManualEditing && (
                    <button
                      onClick={cancelManualEdits}
                      className="px-3 py-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-700 transition-all shadow-sm text-[10px] font-bold uppercase tracking-wide"
                    >
                      Cancel
                    </button>
                  )}
                  {(activeTab === 'output' || activeTab === 'coverletter') && (
                    <button
                      onClick={copyActiveBody}
                      className="px-3 py-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-700 transition-all shadow-sm text-[10px] font-bold uppercase tracking-wide flex items-center gap-2"
                      title={`Copy ${copyLabel} body`}
                    >
                      {copiedTarget === activeTab ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copiedTarget === activeTab ? 'Copied' : 'Copy Body'}
                    </button>
                  )}
                  <button
                    onClick={saveCurrentProfile}
                    className="p-2 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-slate-600 transition-all shadow-sm"
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
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-blue-700 transition-all"
                  >
                    <FileDown className="w-4 h-4" /> .DOCX
                  </button>
                </div>
              </div>

              <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-6 shrink-0">
                <div className="flex items-center gap-3 flex-1 max-w-xs">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="range"
                    min="8"
                    max="13"
                    step="0.5"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[10px] font-bold text-slate-600 w-8 text-right">{fontSize}pt</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-600 uppercase hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={removeEmDashes}
                    onChange={(e) => setRemoveEmDashes(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  Remove Em-Dashes
                </label>
                <div className="text-[9px] text-blue-500 uppercase font-bold tracking-widest bg-blue-50 px-2.5 py-1 rounded-md hidden md:block border border-blue-100">
                  Tap once to edit. Select text for AI.
                </div>
              </div>

              {(isSummaryLoading || activeSummary) && (activeTab === 'output' || activeTab === 'coverletter') && (
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 mb-3">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    What Changed And Why
                  </div>

                  {isSummaryLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" /> Preparing explanation...
                    </div>
                  ) : activeSummary ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-800">{activeSummary.headline}</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600 mb-2">Changes</div>
                          <ul className="space-y-1.5 text-xs text-slate-600">
                            {activeSummary.changes.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 mb-2">Structure</div>
                          <ul className="space-y-1.5 text-xs text-slate-600">
                            {activeSummary.structure.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 mb-2">Why</div>
                          <ul className="space-y-1.5 text-xs text-slate-600">
                            {activeSummary.why.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 shadow-inner relative group">
                {isManualEditing ? (
                  <div
                    ref={manualEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onMouseUp={handleTextSelection}
                    onPointerUp={handleTextSelection}
                    onTouchEnd={handleTextSelection}
                    onKeyUp={handleTextSelection}
                    onInput={(e) => {
                      manualHtmlRef.current = (e.currentTarget as HTMLDivElement).innerHTML
                    }}
                    className="bg-white shadow-md mx-auto p-12 min-h-full h-full w-full border border-slate-200 text-black text-justify transition-all cursor-text selection:bg-blue-200/50 leading-normal focus:outline-none focus:ring-2 focus:ring-blue-200"
                    style={{
                      fontFamily: '"Times New Roman", serif',
                      fontSize: `${fontSize}pt`,
                      maxWidth: '8.5in'
                    }}
                    dangerouslySetInnerHTML={{ __html: manualDraft }}
                  />
                ) : (
                  <div
                    ref={previewRef}
                    onMouseUp={handleTextSelection}
                    onClick={handlePreviewTap}
                    onPointerUp={handlePreviewTap}
                    className="bg-white shadow-md mx-auto p-12 min-h-full border border-slate-200 text-black text-justify transition-all cursor-text selection:bg-blue-200/50 leading-normal"
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
                )}

                {activeTab === 'coverletter' && !coverLetter && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 p-12 text-center animate-in fade-in">
                    <FileSignature className="w-12 h-12 text-slate-300 mb-4" />
                    <button
                      onClick={() => {
                        generateCoverLetter()
                      }}
                      disabled={isGeneratingLetter}
                      className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all hover:bg-zinc-800"
                    >
                      {isGeneratingLetter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Draft Cover Letter
                    </button>
                  </div>
                )}

                {floatingMenu.visible && (
                  <div 
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 w-11/12 max-w-md bg-white border border-slate-200 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-4 animate-in slide-in-from-bottom-6 z-50"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3 px-1">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFloatingMenu((prev) => ({ ...prev, mode: 'edit' }))}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                            floatingMenu.mode === 'edit' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setFloatingMenu((prev) => ({ ...prev, mode: 'ask' }))}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                            floatingMenu.mode === 'ask' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Ask
                        </button>
                        <button
                          onClick={generateEmphasizeChips}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                            floatingMenu.mode === 'emphasize' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Emphasize
                        </button>
                      </div>
                      <button
                        onClick={hideFloatingMenu}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600 mb-1">Selected Text</div>
                      <p className="text-xs text-slate-700 leading-relaxed">{floatingMenu.text}</p>
                    </div>

                    {contextualError && floatingMenu.mode === 'edit' && (
                      <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {contextualError}
                      </div>
                    )}

                    {floatingMenu.mode === 'emphasize' && (
                      <div className="mb-3">
                        {isGeneratingChips ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500 italic px-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Mining strategic angles...
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {floatingMenu.chips?.map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => applyContextualEdit(chip)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold transition-all text-left"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {floatingMenu.mode === 'ask' && floatingMenu.chatResponse && (
                      <div className="mb-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-700 border border-slate-200 shadow-sm leading-relaxed">
                        {floatingMenu.chatResponse}
                      </div>
                    )}

                    {floatingMenu.mode !== 'emphasize' && (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                          placeholder={floatingMenu.mode === 'edit' ? 'Instructions...' : 'Ask recruiter...'}
                          value={floatingMenu.prompt}
                          onChange={(e) => setFloatingMenu((prev) => ({ ...prev, prompt: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleContextualAction()
                            }
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleContextualAction()
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={!canSubmitContextAction}
                          className={`${
                            floatingMenu.mode === 'edit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                          } p-2 rounded-xl text-white shadow-sm transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit`}
                        >
                          {(floatingMenu.mode === 'edit' ? isEditingSelection : isAsking) ? (
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-md h-full p-8 overflow-y-auto space-y-8 animate-in slide-in-from-right-4">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Prestige Strategy Guide</h2>
              </div>
              <div className="space-y-4">
                {(Array.isArray(portfolioStrategy.projects) ? portfolioStrategy.projects : []).map((p, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-6 bg-slate-50 shadow-sm hover:shadow-md transition-all group">
                    <span className="text-[9px] font-bold px-3 py-1 rounded-md bg-zinc-900 text-white uppercase tracking-widest mb-3 inline-block">
                      {String(p.tier)}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm mb-2">{String(p.title)}</h4>
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed">{String(p.description)}</p>
                    <div className="text-[10px] font-bold text-blue-600 border-t border-slate-200 pt-3 uppercase flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Readiness Signal: <span className="text-slate-800">{String(p.outcomeGoal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!optimizedCv && (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-400 p-8 text-center shadow-sm">
              <Target className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="font-bold text-slate-700 text-lg mb-2">Target Locked</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">Paste your target job and raw CV data to calculate high-prestige alignment.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
