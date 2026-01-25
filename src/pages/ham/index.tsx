import { useEffect, useMemo, useRef, useState } from 'react'

import './index.scss'

type BankListItem = {
  id: string
  label: string
  hasQuestions: boolean
  questionCount: number
  pdfUrl: string
}

type Question = {
  id: string
  q: string
  options: Record<string, string>
  answer: string
}

type BankPayload = {
  source: string
  count: number
  questions: Question[]
}

type Mode = 'preview' | 'quiz' | 'wrong'

type ShuffleMap = {
  displayToOriginal: Record<string, string>
  originalToDisplay: Record<string, string>
}

type SavedQuizPosition = {
  bankId: string
  questionId: string
  index: number
  savedAt: number
}

type SavedQuizPositionByBank = Record<string, SavedQuizPosition>

const STORAGE_KEY_LAST_POSITION = 'ham:lastQuizPosition:v2'
const STORAGE_KEY_LAST_POSITION_LEGACY = 'ham:lastQuizPosition:v1'

const STORAGE_KEY_LAST_BANK = 'ham:lastSelectedBank:v1'

type WrongByBank = Record<string, string[]>

const STORAGE_KEY_WRONG_BY_BANK = 'ham:wrongByBank:v1'

function readWrongByBank(): WrongByBank {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WRONG_BY_BANK)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return {}
    return v as WrongByBank
  } catch {
    return {}
  }
}

function writeWrongByBank(v: WrongByBank) {
  try {
    localStorage.setItem(STORAGE_KEY_WRONG_BY_BANK, JSON.stringify(v))
  } catch {
    // ignore
  }
}

function readSavedPositions(): SavedQuizPositionByBank {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_POSITION)
    if (raw) {
      const v = JSON.parse(raw) as unknown
      if (v && typeof v === 'object') return v as SavedQuizPositionByBank
    }
  } catch {
    // ignore
  }

  // 兼容旧版本单条记录
  try {
    const legacyRaw = localStorage.getItem(STORAGE_KEY_LAST_POSITION_LEGACY)
    if (!legacyRaw) return {}
    const legacy = JSON.parse(legacyRaw) as Partial<SavedQuizPosition>
    if (!legacy.bankId || !legacy.questionId) return {}
    const index = Number.isFinite(legacy.index as number) ? Number(legacy.index) : 0
    const savedAt = Number.isFinite(legacy.savedAt as number) ? Number(legacy.savedAt) : Date.now()
    return {
      [String(legacy.bankId)]: {
        bankId: String(legacy.bankId),
        questionId: String(legacy.questionId),
        index: Math.max(0, index),
        savedAt
      }
    }
  } catch {
    return {}
  }
}

function readSavedPosition(bankId: string): SavedQuizPosition | null {
  if (!bankId) return null
  const all = readSavedPositions()
  const v = all[bankId]
  if (!v || !v.questionId) return null
  const index = Number.isFinite(v.index as number) ? Number(v.index) : 0
  const savedAt = Number.isFinite(v.savedAt as number) ? Number(v.savedAt) : Date.now()
  return {
    bankId: String(v.bankId || bankId),
    questionId: String(v.questionId),
    index: Math.max(0, index),
    savedAt
  }
}

function writeSavedPosition(bankId: string, v: SavedQuizPosition) {
  if (!bankId) return
  try {
    const all = readSavedPositions()
    all[bankId] = v
    localStorage.setItem(STORAGE_KEY_LAST_POSITION, JSON.stringify(all))
  } catch {
    // ignore
  }
}

function readLastBankId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_BANK)
    if (!raw) return null
    return String(raw)
  } catch {
    return null
  }
}

function writeLastBankId(bankId: string) {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_BANK, String(bankId))
  } catch {
    // ignore
  }
}

function getApiBase(): string {
  const v = (import.meta as any).env?.VITE_HAM_API_BASE as string | undefined
  return (v && v.trim()) || 'http://cuihongyu.com'
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function rand01(): number {
  try {
    if (globalThis.crypto && crypto.getRandomValues) {
      const a = new Uint32Array(1)
      crypto.getRandomValues(a)
      return a[0] / 2 ** 32
    }
  } catch {
    // ignore
  }
  return Math.random()
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand01() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function isMultiAnswer(answer: string): boolean {
  return (answer || '').length > 1
}

function toDisplayAnswer(originalAnswer: string, originalToDisplay: Record<string, string>): string {
  const letters = String(originalAnswer || '')
    .toUpperCase()
    .split('')
    .filter(Boolean)
  return letters
    .map((c) => originalToDisplay[c] || c)
    .filter((c) => c)
    .sort()
    .join('')
}

export default function Ham() {
  const apiBase = useMemo(() => getApiBase(), [])

  const [isDarkMode, setIsDarkMode] = useState(false)

  const initialSavedBankId = useMemo(() => readLastBankId(), [])
  const initialSaved = useMemo(
    () => (initialSavedBankId ? readSavedPosition(initialSavedBankId) : null),
    [initialSavedBankId]
  )

  const [mode, setMode] = useState<Mode>(() => ('quiz' as Mode))
  const [banks, setBanks] = useState<BankListItem[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string>(
    () => initialSaved?.bankId || initialSavedBankId || 'a'
  )
  const [bank, setBank] = useState<BankPayload | null>(null)
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState(false)
  const [resultText, setResultText] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [selectionsById, setSelectionsById] = useState<Record<string, string[]>>({})
  const [randomSubmitted, setRandomSubmitted] = useState(false)

  const [jumpValue, setJumpValue] = useState<string>('')

  const [wrongByBank, setWrongByBank] = useState<WrongByBank>(() => readWrongByBank())

  const optionShuffleByIdRef = useRef<Map<string, ShuffleMap>>(new Map())
  const bankCacheRef = useRef<Map<string, BankPayload>>(new Map())
  const inflightRef = useRef<Map<string, Promise<BankPayload>>>(new Map())

  const selectedBank = useMemo(
    () => banks.find((b) => b.id === selectedBankId) || null,
    [banks, selectedBankId]
  )

  const canQuizLoad = selectedBank?.hasQuestions ?? true

  const pdfUrl = useMemo(() => {
    if (selectedBank?.pdfUrl) return `${apiBase}${selectedBank.pdfUrl}`
    return `${apiBase}/api/pdfs/${encodeURIComponent(selectedBankId)}`
  }, [apiBase, selectedBank, selectedBankId])

  const current = sessionQuestions[index] || null

  const isRandomSet = Boolean(
    bank?.questions && sessionQuestions.length > 0 && sessionQuestions.length !== bank.questions.length
  )

  const wrongIdsForSelected = useMemo(() => {
    const ids = wrongByBank[selectedBankId] || []
    return new Set(ids)
  }, [wrongByBank, selectedBankId])

  const answeredCount = useMemo(() => {
    if (sessionQuestions.length === 0) return 0
    let count = 0
    for (const q of sessionQuestions) {
      if (selectionsById[q.id]?.length) count++
    }
    return count
  }, [sessionQuestions, selectionsById])

  const randomConfig = useMemo(() => {
    const configMap: Record<string, { single: number; multi: number }> = {
      a: { single: 32, multi: 8 },
      b: { single: 45, multi: 15 },
      c: { single: 70, multi: 20 }
    }
    return configMap[selectedBankId] || null
  }, [selectedBankId])

  function resetPerQuestionState() {
    if (isRandomSet && current) {
      const saved = selectionsById[current.id] || []
      setSelected(new Set(saved))
      setRevealed(false)
      if (!randomSubmitted) setResultText('')
      return
    }
    setSelected(new Set())
    setRevealed(false)
    setResultText('')
  }

  function getShuffleMapForQuestion(q: Question): ShuffleMap {
    const cached = optionShuffleByIdRef.current.get(q.id)
    if (cached) return cached

    const displayKeysSorted = Object.keys(q.options || {}).sort()
    const originalKeys = [...displayKeysSorted]
    const shuffledOriginalKeys = shuffleInPlace([...originalKeys])

    const displayToOriginal: Record<string, string> = {}
    const originalToDisplay: Record<string, string> = {}

    for (let i = 0; i < displayKeysSorted.length; i++) {
      const displayKey = displayKeysSorted[i]
      const originalKey = shuffledOriginalKeys[i]
      displayToOriginal[displayKey] = originalKey
      originalToDisplay[originalKey] = displayKey
    }

    const m: ShuffleMap = { displayToOriginal, originalToDisplay }
    optionShuffleByIdRef.current.set(q.id, m)
    return m
  }

  async function fetchBankPayload(bankId: string): Promise<BankPayload> {
    const cached = bankCacheRef.current.get(bankId)
    if (cached) return cached

    const existing = inflightRef.current.get(bankId)
    const p: Promise<BankPayload> =
      existing ||
      (async () => {
        const res = await fetch(`${apiBase}/api/banks/${encodeURIComponent(bankId)}`, {
          cache: 'no-store'
        })
        if (!res.ok) throw new Error(`加载题库失败：${res.status}`)
        return (await res.json()) as BankPayload
      })()

    if (!existing) inflightRef.current.set(bankId, p)

    try {
      const data = await p
      bankCacheRef.current.set(bankId, data)
      return data
    } finally {
      inflightRef.current.delete(bankId)
    }
  }

  async function loadBanks() {
    setError('')
    try {
      const res = await fetch(`${apiBase}/api/banks`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`加载题库列表失败：${res.status}`)
      const data = (await res.json()) as BankListItem[]
      setBanks(data)
      if (data.length > 0 && !data.some((b) => b.id === selectedBankId)) {
        setSelectedBankId(data[0].id)
      }
    } catch (e: any) {
      setError(e?.message || String(e))
      // fallback
      setBanks([
        { id: 'a', label: 'A类题库', hasQuestions: true, questionCount: 0, pdfUrl: '/api/pdfs/a' },
        { id: 'b', label: 'B类题库', hasQuestions: true, questionCount: 0, pdfUrl: '/api/pdfs/b' },
        { id: 'c', label: 'C类题库', hasQuestions: true, questionCount: 0, pdfUrl: '/api/pdfs/c' },
        { id: 'all', label: '总题库', hasQuestions: true, questionCount: 0, pdfUrl: '/api/pdfs/all' },
        { id: 'all_img', label: '总题库附图', hasQuestions: false, questionCount: 0, pdfUrl: '/api/pdfs/all_img' }
      ])
    }
  }
  async function loadBankQuestions(bankId: string) {
    setError('')
    setBank(null)
    setSessionQuestions([])
    setIndex(0)
    optionShuffleByIdRef.current = new Map()
    setSelectionsById({})
    setRandomSubmitted(false)
    resetPerQuestionState()

    const applyData = (data: BankPayload) => {
      setBank(data)
      const questions = data.questions || []
      setSessionQuestions(questions)

      const saved = readSavedPosition(bankId)
      if (saved && saved.bankId === bankId && saved.questionId && questions.length > 0) {
        const found = questions.findIndex((q) => q.id === saved.questionId)
        if (found >= 0) {
          setIndex(found)
        } else {
          setIndex(Math.min(Math.max(0, saved.index || 0), questions.length - 1))
        }
      } else {
        setIndex(0)
      }
    }

    try {
      const data = await fetchBankPayload(bankId)
      applyData(data)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  async function loadWrongQuestions(bankId: string) {
    setError('')
    setBank(null)
    setSessionQuestions([])
    setIndex(0)
    optionShuffleByIdRef.current = new Map()
    setSelectionsById({})
    setRandomSubmitted(false)
    resetPerQuestionState()

    try {
      const data = await fetchBankPayload(bankId)
      setBank(data)
      const ids = new Set((readWrongByBank()[bankId] || []).filter(Boolean))
      const questions = (data.questions || []).filter((q) => ids.has(q.id))
      setSessionQuestions(questions)
      setIndex(0)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  function markWrong(bankId: string, questionId: string) {
    if (!bankId || !questionId) return
    setWrongByBank((prev) => {
      const prevIds = prev[bankId] || []
      if (prevIds.includes(questionId)) return prev
      const next: WrongByBank = { ...prev, [bankId]: [...prevIds, questionId] }
      writeWrongByBank(next)
      return next
    })
  }

  function clearWrong(bankId: string, questionId: string) {
    if (!bankId || !questionId) return
    setWrongByBank((prev) => {
      const prevIds = prev[bankId] || []
      if (!prevIds.includes(questionId)) return prev
      const nextIds = prevIds.filter((id) => id !== questionId)
      const next: WrongByBank = { ...prev }
      if (nextIds.length === 0) delete next[bankId]
      else next[bankId] = nextIds
      writeWrongByBank(next)
      return next
    })
  }

  function jumpTo(valueRaw: string) {
    const value = String(valueRaw || '').trim()
    if (!value || sessionQuestions.length === 0) return

    // 纯数字 => 题号（1-based）
    if (/^\d+$/.test(value)) {
      const n = Number(value)
      const nextIndex = n - 1
      if (!Number.isFinite(nextIndex)) return
      setIndex(Math.min(Math.max(0, nextIndex), sessionQuestions.length - 1))
      return
    }

    // 否则当作题目 ID
    const found = sessionQuestions.findIndex((q) => q.id === value)
    if (found >= 0) setIndex(found)
  }

  function toggleSelect(letter: string, multi: boolean) {
    const next = new Set(selected)
    if (!multi) {
      next.clear()
      next.add(letter)
    } else if (next.has(letter)) next.delete(letter)
    else next.add(letter)
    setSelected(next)
    if (current && isRandomSet) {
      const arr = Array.from(next)
      setSelectionsById((prev) => ({ ...prev, [current.id]: arr }))
    }
    if (revealed) {
      setRevealed(false)
      setResultText('')
    }
    if (isRandomSet && randomSubmitted) {
      setRandomSubmitted(false)
      setResultText('')
    }
  }

  function checkAnswer() {
    if (!current) return
    const shuffleMap = getShuffleMapForQuestion(current)
    const displayAnswer = toDisplayAnswer(current.answer || '', shuffleMap.originalToDisplay)
    const correct = displayAnswer.split('').filter(Boolean)
    const chosen = Array.from(selected)

    const correctSet = new Set(correct)
    const chosenSet = new Set(chosen)

    let ok = correct.length === chosen.length
    if (ok) {
      for (const c of correctSet) {
        if (!chosenSet.has(c)) {
          ok = false
          break
        }
      }
    }

    setResultText(
      ok
        ? `正确 ✅（答案：${displayAnswer || '未知'}）`
        : `错误 ❌（正确答案：${displayAnswer || '未知'}；你的选择：${chosen.sort().join('') || '未选'}）`
    )
    setRevealed(true)

    if (ok) {
      clearWrong(selectedBankId, current.id)

      // 错题模式下：答对后从错题集中移除并跳到下一题（或空集提示）
      if (mode === 'wrong') {
        setSessionQuestions((prev) => {
          const next = prev.filter((q) => q.id !== current.id)
          setIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
          return next
        })
        resetPerQuestionState()
      }
    } else {
      markWrong(selectedBankId, current.id)
    }
  }

  function submitRandomQuiz() {
    if (!isRandomSet || sessionQuestions.length === 0) return
    let score = 0
    for (const q of sessionQuestions) {
      const shuffleMap = getShuffleMapForQuestion(q)
      const displayAnswer = toDisplayAnswer(q.answer || '', shuffleMap.originalToDisplay)
      const correct = displayAnswer.split('').filter(Boolean)
      const chosen = selectionsById[q.id] || []

      const correctSet = new Set(correct)
      const chosenSet = new Set(chosen)

      let ok = correct.length === chosen.length
      if (ok) {
        for (const c of correctSet) {
          if (!chosenSet.has(c)) {
            ok = false
            break
          }
        }
      }
      if (ok) score += 1
    }
    setRandomSubmitted(true)
    setResultText(`完成！得分：${score}/${sessionQuestions.length}`)
  }

  function random() {
    if (!bank?.questions || bank.questions.length === 0) return
    const total = bank.questions.length
    const configMap: Record<string, { single: number; multi: number }> = {
      a: { single: 32, multi: 8 },
      b: { single: 45, multi: 15 },
      c: { single: 70, multi: 20 }
    }
    const cfg = configMap[selectedBankId]

    if (!cfg) {
      const n = Math.min(30, total)
      const indices = Array.from({ length: total }, (_, i) => i)
      shuffleInPlace(indices)
      const chosen = indices.slice(0, n).sort((a, b) => a - b)
      setSessionQuestions(chosen.map((i) => bank.questions[i]))
      setIndex(0)
      optionShuffleByIdRef.current = new Map()
      resetPerQuestionState()
      return
    }

    const singles = bank.questions.filter((q) => !isMultiAnswer(q.answer || ''))
    const multis = bank.questions.filter((q) => isMultiAnswer(q.answer || ''))
    shuffleInPlace(singles)
    shuffleInPlace(multis)

    const singleCount = Math.min(cfg.single, singles.length)
    const multiCount = Math.min(cfg.multi, multis.length)
    const totalTarget = Math.min(cfg.single + cfg.multi, total)

    let chosenQuestions = [...singles.slice(0, singleCount), ...multis.slice(0, multiCount)]

    if (chosenQuestions.length < totalTarget) {
      const remaining = [
        ...singles.slice(singleCount),
        ...multis.slice(multiCount)
      ]
      shuffleInPlace(remaining)
      chosenQuestions = chosenQuestions.concat(
        remaining.slice(0, Math.min(totalTarget - chosenQuestions.length, remaining.length))
      )
    }

    const indexById = new Map(bank.questions.map((q, i) => [q.id, i]))
    const chosenIndices = chosenQuestions
      .map((q) => indexById.get(q.id))
      .filter((i): i is number => typeof i === 'number' && i >= 0)
      .sort((a, b) => a - b)

    setSessionQuestions(chosenIndices.map((i) => bank.questions[i]))
    setIndex(0)
    optionShuffleByIdRef.current = new Map()
    setSelectionsById({})
    setRandomSubmitted(false)
    resetPerQuestionState()
  }

  useEffect(() => {
    loadBanks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'
    const isDark = savedTheme === 'dark'
    setIsDarkMode(isDark)
    if (isDark) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [])

  const toggleTheme = () => {
    const nextIsDark = !isDarkMode
    setIsDarkMode(nextIsDark)
    if (nextIsDark) {
      document.body.classList.add('dark-mode')
      localStorage.setItem('theme', 'dark')
    } else {
      document.body.classList.remove('dark-mode')
      localStorage.setItem('theme', 'light')
    }
  }

  useEffect(() => {
    // 记录最近选择的题库
    if (!selectedBankId) return
    writeLastBankId(selectedBankId)
  }, [selectedBankId])

  useEffect(() => {
    // 练习模式：进入页面或切换题库时自动加载并恢复上次题目
    if (mode !== 'quiz') return
    if (!canQuizLoad) return
    if (!selectedBankId) return
    loadBankQuestions(selectedBankId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedBankId, canQuizLoad])

  useEffect(() => {
    // 切到错题模式：显示当前题库全部错题
    if (mode !== 'wrong') return
    if (!canQuizLoad) return
    loadWrongQuestions(selectedBankId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedBankId, canQuizLoad])

  useEffect(() => {
    // 切题时清理本题状态
    resetPerQuestionState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isRandomSet, current])

  useEffect(() => {
    // 每次切题都把“当前题”持久化，刷新/重进能续上
    if (mode !== 'quiz') return
    if (isRandomSet) return
    const q = current
    if (!q) return
    writeSavedPosition(selectedBankId, {
      bankId: selectedBankId,
      questionId: q.id,
      index,
      savedAt: Date.now()
    })
  }, [mode, selectedBankId, index, current, isRandomSet])

  const randomTargetCount = randomConfig ? randomConfig.single + randomConfig.multi : 30
  const randomLabel = `随机${randomTargetCount}题`

  const questionSuffix =
    bank?.questions && sessionQuestions.length !== bank.questions.length
      ? randomConfig
        ? `  |  练习集：${randomLabel}`
        : `  |  练习集：随机${sessionQuestions.length}题`
      : ''

  const currentKeysSorted = current ? Object.keys(current.options || {}).sort() : []
  const shuffleMap = current ? getShuffleMapForQuestion(current) : null
  const displayAnswer =
    current && shuffleMap ? toDisplayAnswer(current.answer || '', shuffleMap.originalToDisplay) : ''
  const multi = current ? isMultiAnswer(current.answer || '') : true
  const randomResultText =
    isRandomSet && randomSubmitted && current
      ? (() => {
          const chosen = (selectionsById[current.id] || []).slice().sort().join('') || '未选'
          const correctLetters = displayAnswer.split('').filter(Boolean)
          const chosenLetters = (selectionsById[current.id] || []).slice().sort()
          const correctSet = new Set(correctLetters)
          const chosenSet = new Set(chosenLetters)
          let ok = correctLetters.length === chosenLetters.length
          if (ok) {
            for (const c of correctSet) {
              if (!chosenSet.has(c)) {
                ok = false
                break
              }
            }
          }
          return `${ok ? '正确 ✅' : '错误 ❌'}（正确答案：${
            displayAnswer || '未知'
          }；你的选择：${chosen}）`
        })()
      : ''

  return (
    <div className="hamPage">
      <div className="hamHeader">
        <h1 className="hamTitle">
          业余电台操作证书考试题库（2025版）
          <button className="hamThemeToggle" onClick={toggleTheme} title="切换主题" type="button">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </h1>
        <div className="hamControls">
          <label>
            <div className="label">模式：</div>
            <select
              className="hamSelect"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              {/* <option value="preview">PDF 预览</option> */}
              <option value="quiz">逐题练习</option>
              <option value="wrong">错题模式</option>
            </select>
          </label>

          <label>
            <div className="label">题库：</div>
            <select
              className="hamSelect"
              value={selectedBankId}
              onChange={(e) => {
                setSelectedBankId(e.target.value)
                setBank(null)
                setSessionQuestions([])
                setIndex(0)
                optionShuffleByIdRef.current = new Map()
                resetPerQuestionState()
              }}
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}{b.hasQuestions ? '' : '（仅PDF）'}
                </option>
              ))}
            </select>
          </label>

          <a className="hamPdfLink" href={pdfUrl} target="_blank" rel="noreferrer">
            新标签页打开原版题库PDF
          </a>
          {/* <span style={styles.hint}>后端：{apiBase}</span> */}
          {error ? <span className="hamError">错误：{error}</span> : null}
        </div>
      </div>

      <div className="hamMain">
        <section className={`hamPanel ${mode === 'preview' ? 'isActive' : ''}`}>
          <iframe title="PDF 预览" className="hamViewer" src={pdfUrl} />
        </section>

        <section className={`hamPanel ${mode === 'quiz' || mode === 'wrong' ? 'isActive' : ''}`}>
          <div className="hamQuiz">
            <div className="hamRow">
              <button
                type="button"
                disabled={!canQuizLoad}
                onClick={() => (mode === 'wrong' ? loadWrongQuestions(selectedBankId) : loadBankQuestions(selectedBankId))}
              >
                {mode === 'wrong' ? '加载错题' : '加载'}
              </button>
              {mode === 'quiz' ? (
                <button
                  type="button"
                  disabled={!bank || sessionQuestions.length === 0}
                  onClick={random}
                >
                  {randomLabel}
                </button>
              ) : null}
              <input
                className="hamJumpInput"
                value={jumpValue}
                placeholder="跳转：题号(如 12) / ID"
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') jumpTo(jumpValue)
                }}
                disabled={!bank || sessionQuestions.length === 0}
              />
              <button
                type="button"
                disabled={!bank || sessionQuestions.length === 0 || !jumpValue.trim()}
                onClick={() => jumpTo(jumpValue)}
              >
                跳转
              </button>

              <button
                type="button"
                disabled={!current}
                onClick={resetPerQuestionState}
              >
                清空本题选择
              </button>
              <button
                type="button"
                disabled={index <= 0}
                onClick={() => setIndex((v) => Math.max(0, v - 1))}
              >
                上一题
              </button>
              <button
                type="button"
                disabled={index >= sessionQuestions.length - 1}
                onClick={() => setIndex((v) => Math.min(sessionQuestions.length - 1, v + 1))}
              >
                下一题
              </button>
              {!isRandomSet ? (
                <button
                  type="button"
                  disabled={!current}
                  onClick={checkAnswer}
                >
                  提交判定
                </button>
              ) : null}
              {isRandomSet && answeredCount === sessionQuestions.length ? (
                <button type="button" onClick={submitRandomQuiz}>
                  提交
                </button>
              ) : null}
            </div>

            <div className="hamQBox">
              {current ? (
                <>
                  <div className="hamQMeta">
                    来源：{bank?.source || '未加载'} ｜ 题目：{index + 1} / {sessionQuestions.length} ｜ ID：
                    {current.id}
                    {questionSuffix}
                    {isRandomSet ? `  |  题型：${multi ? '多选' : '单选'}` : ''}
                    {mode === 'wrong' ? `  |  错题数：${wrongIdsForSelected.size}` : ''}
                  </div>
                  <p className="hamQText">{current.q}</p>
                  <div className="hamOptions">
                    {currentKeysSorted.map((displayKey) => {
                      const originalKey = shuffleMap?.displayToOriginal[displayKey]
                      const text = originalKey ? current.options[originalKey] : current.options[displayKey]
                      const checked = selected.has(displayKey)

                      const correctSet = new Set(displayAnswer.split('').filter(Boolean))
                      const isCorrect = revealed && correctSet.has(displayKey)
                      const isWrong = revealed && checked && !correctSet.has(displayKey)

                      const borderColor = isCorrect
                        ? '#2c7a2c'
                        : isWrong
                          ? '#b3261e'
                          : '#e5e5e5'

                      return (
                        <label
                          key={displayKey}
                          className="hamOption"
                          style={{
                            borderColor,
                            outline: isCorrect
                              ? '2px solid #2c7a2c'
                              : isWrong
                                ? '2px solid #b3261e'
                                : 'none'
                          }}
                        >
                          <input
                            type={multi ? 'checkbox' : 'radio'}
                            name="opt"
                            checked={checked}
                            onChange={() => toggleSelect(displayKey, multi)}
                            style={{ marginTop: 2 }}
                          />
                          <span
                            dangerouslySetInnerHTML={{
                              __html: `<strong>${displayKey}</strong>：${escapeHtml(text || '')}`
                            }}
                          />
                        </label>
                      )
                    })}
                  </div>
                  <div className="hamResult">
                    {isRandomSet && randomSubmitted ? randomResultText : resultText}
                  </div>
                  {isRandomSet && randomSubmitted ? (
                    <div className="hamResult">{resultText}</div>
                  ) : null}
                </>
              ) : (
                <div className="hamEmpty">
                  {mode === 'wrong'
                    ? '当前题库暂无错题（或尚未加载）。'
                    : '尚未加载题库数据。'}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
