import { Fragment, useEffect, useState } from 'react'
import { BookOpen, Braces, Check, ChevronRight, Clock3, FlaskConical, Lightbulb, Medal, RotateCcw, Sparkles, Trophy, UserRound, X } from 'lucide-react'
import { getAnonymousUserId, supabaseClient } from './lib/supabase.js'

const playerStorageKey = 'kidthen-player'
const scoreStorageKey = 'kidthen-scores'
const playerEmojis = ['🦊', '🐼', '🐸', '🦉', '🐯', '🐙', '🚀', '🌟', '🎯', '🧠', '⚡', '🌈']

function readStoredValue(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((milliseconds % 1000) / 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function currentTimestamp() {
  return Date.now()
}

function rankScores(scores) {
  return [...scores].sort((first, second) => (
    second.score - first.score ||
    first.duration_ms - second.duration_ms ||
    new Date(first.completed_at) - new Date(second.completed_at)
  ))
}

const lessons = [
  { id: 'lesson', label: 'ประพจน์คืออะไร', number: '01', icon: BookOpen },
  { id: 'table', label: 'ตารางค่าความจริง', number: '02', icon: Braces },
  { id: 'practice', label: 'แบบฝึกหัด', number: '03', icon: Lightbulb },
]

const operators = [
  { id: 'not', symbol: '¬', label: 'นิเสธ', english: 'NOT', formula: '¬ p', short: 'กลับค่าความจริงของ p' },
  { id: 'and', symbol: '∧', label: 'และ', english: 'AND', formula: 'p ∧ q', short: 'จริงเมื่อทั้งคู่จริง' },
  { id: 'or', symbol: '∨', label: 'หรือ', english: 'OR', formula: 'p ∨ q', short: 'จริงเมื่อมีอย่างน้อยหนึ่งจริง' },
  { id: 'implies', symbol: '→', label: 'ถ้า...แล้ว', english: 'IF / THEN', formula: 'p → q', short: 'เท็จเมื่อ p จริง แต่ q เท็จ' },
  { id: 'iff', symbol: '↔', label: 'ก็ต่อเมื่อ', english: 'IFF', formula: 'p ↔ q', short: 'จริงเมื่อ p และ q มีค่าเหมือนกัน' },
]

const fillLevels = [
  { id: 'basic', label: 'พื้นฐาน', detail: 'ตัวเชื่อมเดี่ยว' },
  { id: 'intermediate', label: 'ปานกลาง', detail: 'นิพจน์ผสม' },
  { id: 'challenge', label: 'ท้าทาย', detail: 'นิพจน์หลายชั้น' },
]

const compoundChallenges = [
  { id: 'conditional-chain', level: 'intermediate', title: 'เงื่อนไขซ้อน', formula: '(p ∧ q) → r', variables: ['p', 'q', 'r'], hint: 'คำนวณในวงเล็บ p ∧ q ก่อน แล้วจึงประเมิน →', evaluate: ({ p, q, r }) => !(p && q) || r },
  { id: 'or-biconditional', level: 'intermediate', title: 'หรือและก็ต่อเมื่อ', formula: '(p ∨ q) ↔ ¬r', variables: ['p', 'q', 'r'], hint: 'หาค่า p ∨ q และ ¬r ก่อน แล้วเปรียบเทียบค่าทั้งสองฝั่งของ ↔', evaluate: ({ p, q, r }) => (p || q) === !r },
  { id: 'nested-negation', level: 'challenge', title: 'วงเล็บและนิเสธ', formula: '¬(p ∨ q) ∧ r', variables: ['p', 'q', 'r'], hint: 'ทำ p ∨ q ในวงเล็บก่อน จากนั้นปฏิเสธผล แล้วจึง AND กับ r', evaluate: ({ p, q, r }) => !(p || q) && r },
  { id: 'demorgan', level: 'challenge', title: 'กฎของเดอมอร์แกน', formula: '¬(p ∧ q) ↔ (¬p ∨ ¬q)', variables: ['p', 'q'], hint: 'เปรียบเทียบการปฏิเสธของผล AND กับ OR ของตัวปฏิเสธ', evaluate: ({ p, q }) => !(p && q) === (!p || !q) },
]

function evaluate(operator, p, q) {
  if (operator === 'not') return !p
  if (operator === 'and') return p && q
  if (operator === 'or') return p || q
  if (operator === 'implies') return !p || q
  return p === q
}

function makeTruthRows(variables) {
  return Array.from({ length: 2 ** variables.length }, (_, rowIndex) => (
    Object.fromEntries(variables.map((variable, variableIndex) => [
      variable,
      Boolean(((2 ** variables.length - 1 - rowIndex) >> (variables.length - variableIndex - 1)) & 1),
    ]))
  ))
}

const practiceQuestions = [
  { id: 'not', operator: 'not', p: 'วันนี้ฝนตก', pValue: false, answer: true, explanation: 'นิเสธจะกลับค่าความจริงของ p เมื่อ p เป็นเท็จ ดังนั้น ¬p จึงเป็นจริง' },
  { id: 'and-true', operator: 'and', p: 'ฉันอ่านหนังสือ', q: 'ฉันทำแบบฝึกหัด', pValue: true, qValue: true, answer: true, explanation: 'p ∧ q จะจริงเมื่อ p และ q จริงทั้งคู่ ซึ่งข้อนี้เป็นจริงทั้งสองประพจน์' },
  { id: 'and-false', operator: 'and', p: 'รถเมล์มาตรงเวลา', q: 'ฉันไปถึงโรงเรียนทัน', pValue: true, qValue: false, answer: false, explanation: 'ตัวเชื่อม “และ” ต้องจริงทั้งคู่ เมื่อ q เป็นเท็จ ผลของ p ∧ q จึงเป็นเท็จ' },
  { id: 'or-false', operator: 'or', p: 'ฉันดื่มชา', q: 'ฉันดื่มกาแฟ', pValue: false, qValue: false, answer: false, explanation: 'p ∨ q จะเท็จเมื่อทั้ง p และ q เท็จ ไม่มีประพจน์ใดเป็นจริงเลย' },
  { id: 'or-true', operator: 'or', p: 'วันนี้เป็นวันหยุด', q: 'พรุ่งนี้เป็นวันหยุด', pValue: false, qValue: true, answer: true, explanation: '“หรือ” แบบ inclusive เป็นจริงเมื่อมีอย่างน้อยหนึ่งประพจน์จริง ในข้อนี้ q เป็นจริง' },
  { id: 'implies-false', operator: 'implies', p: 'ฉันสอบผ่าน', q: 'ฉันได้คะแนนเกินครึ่ง', pValue: true, qValue: false, answer: false, explanation: 'p → q เท็จเฉพาะกรณี p จริงแต่ q เท็จ ซึ่งตรงกับค่าที่กำหนด' },
  { id: 'implies-true', operator: 'implies', p: 'ฉันทำการบ้าน', q: 'ครูตรวจการบ้าน', pValue: false, qValue: false, answer: true, explanation: 'ถ้า p เป็นเท็จ ประพจน์ p → q จะเป็นจริง ไม่ว่า q จะเป็นค่าใด' },
  { id: 'iff-true', operator: 'iff', p: 'จำนวน 8 เป็นจำนวนคู่', q: 'จำนวน 8 หารด้วย 2 ลงตัว', pValue: true, qValue: true, answer: true, explanation: 'p ↔ q เป็นจริงเมื่อ p และ q มีค่าความจริงเหมือนกัน ข้อนี้จริงทั้งคู่' },
  { id: 'iff-false', operator: 'iff', p: 'จำนวน 9 เป็นจำนวนคู่', q: 'จำนวน 9 หารด้วย 2 ลงตัว', pValue: false, qValue: true, answer: false, explanation: 'p ↔ q เป็นเท็จเมื่อค่าความจริงต่างกัน ข้อนี้ p เท็จ แต่ q จริง' },
]

function App() {
  const [activeLesson, setActiveLesson] = useState('lesson')
  const [activeOperator, setActiveOperator] = useState('and')
  const [propositionP, setPropositionP] = useState('วันนี้ฝนตก')
  const [propositionQ, setPropositionQ] = useState('ฉันพกร่ม')
  const [practiceMode, setPracticeMode] = useState('fill-table')
  const [fillLevel, setFillLevel] = useState('basic')
  const [fillChallengeId, setFillChallengeId] = useState('conditional-chain')
  const [fillOperator, setFillOperator] = useState('and')
  const [fillAnswers, setFillAnswers] = useState({})
  const [fillChecked, setFillChecked] = useState(false)
  const [fillStartedAt, setFillStartedAt] = useState(null)
  const [fillFinishedAt, setFillFinishedAt] = useState(null)
  const [timerNow, setTimerNow] = useState(0)
  const [completedRun, setCompletedRun] = useState(null)
  const [scoreNotice, setScoreNotice] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [quizStartedAt, setQuizStartedAt] = useState(null)
  const [quizFinishedAt, setQuizFinishedAt] = useState(null)
  const [quizRunResult, setQuizRunResult] = useState(null)
  const [player, setPlayer] = useState(() => readStoredValue(playerStorageKey, null))
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileEmoji, setProfileEmoji] = useState(playerEmojis[0])
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [pendingScore, setPendingScore] = useState(null)
  const [localScores, setLocalScores] = useState(() => readStoredValue(scoreStorageKey, []))
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0)

  const operator = operators.find((item) => item.id === activeOperator)
  const fillOperatorDetails = operators.find((item) => item.id === fillOperator)
  const fillChallenge = compoundChallenges.find((item) => item.id === fillChallengeId)
  const isBasicFill = fillLevel === 'basic'
  const fillProblem = isBasicFill ? null : fillChallenge
  const fillVariables = fillProblem?.variables ?? (fillOperator === 'not' ? ['p'] : ['p', 'q'])
  const fillFormula = fillProblem?.formula ?? fillOperatorDetails.formula
  const fillEvaluation = (row) => fillProblem ? fillProblem.evaluate(row) : evaluate(fillOperator, row.p, row.q)
  const currentQuestion = practiceQuestions[questionIndex]
  const currentOperator = operators.find((item) => item.id === currentQuestion.operator)
  const currentResponse = responses[currentQuestion.id] ?? { answer: null, submitted: false }
  const answeredCount = Object.values(responses).filter((response) => response.submitted).length
  const rows = activeOperator === 'not'
    ? [{ p: true }, { p: false }]
    : [{ p: true, q: true }, { p: true, q: false }, { p: false, q: true }, { p: false, q: false }]
  const fillRows = makeTruthRows(fillVariables)
  const fillRowKey = (row) => fillVariables.map((variable) => row[variable] ? 'T' : 'F').join('-')
  const filledCount = fillRows.filter((row) => typeof fillAnswers[fillRowKey(row)] === 'boolean').length
  const correctFillCount = fillRows.filter((row) => fillAnswers[fillRowKey(row)] === fillEvaluation(row)).length
  const elapsedMs = fillStartedAt ? Math.max(0, (fillFinishedAt ?? Math.max(timerNow, fillStartedAt)) - fillStartedAt) : 0
  const quizElapsedMs = quizStartedAt ? Math.max(0, (quizFinishedAt ?? Math.max(timerNow, quizStartedAt)) - quizStartedAt) : 0
  const rankedScores = rankScores(leaderboard)

  useEffect(() => {
    const fillIsRunning = practiceMode === 'fill-table' && fillStartedAt && !fillChecked
    const quizIsRunning = practiceMode === 'questions' && quizStartedAt && !quizFinishedAt
    if (!fillIsRunning && !quizIsRunning) return undefined
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [fillChecked, fillStartedAt, practiceMode, quizFinishedAt, quizStartedAt])

  useEffect(() => {
    if (practiceMode !== 'leaderboard') return undefined
    let cancelled = false

    async function loadScores() {
      setLeaderboardLoading(true)
      setLeaderboardError('')
      if (!supabaseClient) {
        setLeaderboard(rankScores(localScores))
        setLeaderboardLoading(false)
        return
      }

      const { data, error } = await supabaseClient
        .from('logic_scores')
        .select('id, player_name, player_emoji, score, correct_count, total_count, difficulty, challenge_title, challenge_formula, duration_ms, completed_at')
        .order('score', { ascending: false })
        .order('duration_ms', { ascending: true })
        .limit(50)

      if (cancelled) return
      if (error) {
        setLeaderboardError('โหลดอันดับออนไลน์ไม่สำเร็จ ตรวจสอบการตั้งค่า Supabase แล้วลองใหม่')
        setLeaderboard(rankScores(localScores))
      } else {
        setLeaderboard(data ?? [])
      }
      setLeaderboardLoading(false)
    }

    loadScores()
    return () => { cancelled = true }
  }, [leaderboardRefresh, localScores, practiceMode])

  function resetAnswer() {
    if (quizFinishedAt) return
    setResponses((current) => {
      const next = { ...current }
      delete next[currentQuestion.id]
      return next
    })
  }

  function chooseAnswer(value) {
    if (quizFinishedAt) return
    setResponses((current) => ({
      ...current,
      [currentQuestion.id]: { answer: value, submitted: false },
    }))
    setQuizStartedAt((current) => current ?? currentTimestamp())
  }

  function submitAnswer() {
    if (quizFinishedAt) return
    setResponses((current) => ({
      ...current,
      [currentQuestion.id]: { ...currentResponse, submitted: true },
    }))
  }

  function changeQuestion(index) {
    setQuestionIndex((index + practiceQuestions.length) % practiceQuestions.length)
  }

  function changeFillOperator(operatorId) {
    setFillOperator(operatorId)
    resetFillTable()
  }

  function changeFillLevel(level) {
    const firstChallenge = compoundChallenges.find((challenge) => challenge.level === level)
    setFillLevel(level)
    if (firstChallenge) setFillChallengeId(firstChallenge.id)
    resetFillTable()
  }

  function changeFillChallenge(challengeId) {
    setFillChallengeId(challengeId)
    resetFillTable()
  }

  function selectFillAnswer(row, value) {
    setFillAnswers((current) => ({ ...current, [fillRowKey(row)]: value }))
    setFillChecked(false)
    setFillFinishedAt(null)
    setCompletedRun(null)
    setFillStartedAt((current) => current ?? currentTimestamp())
  }

  function resetFillTable() {
    setFillAnswers({})
    setFillChecked(false)
    setFillStartedAt(null)
    setFillFinishedAt(null)
    setCompletedRun(null)
    setScoreNotice('')
    setTimerNow(currentTimestamp())
  }

  function resetQuestionRun() {
    setResponses({})
    setQuestionIndex(0)
    setQuizStartedAt(null)
    setQuizFinishedAt(null)
    setQuizRunResult(null)
    setTimerNow(currentTimestamp())
    setScoreNotice('')
  }

  async function finishQuestionRun() {
    const finishedAt = currentTimestamp()
    const correctCount = practiceQuestions.filter((question) => (
      responses[question.id]?.submitted && responses[question.id]?.answer === question.answer
    )).length
    const durationMs = Math.max(0, finishedAt - (quizStartedAt ?? finishedAt))
    const scoreRun = {
      score: Math.round((correctCount / practiceQuestions.length) * 100),
      correct_count: correctCount,
      total_count: practiceQuestions.length,
      difficulty: 'basic',
      challenge_title: 'แบบเลือกคำตอบ',
      challenge_formula: 'ตัวเชื่อมพื้นฐาน 9 ข้อ',
      duration_ms: durationMs,
      completed_at: new Date(finishedAt).toISOString(),
    }

    setQuizFinishedAt(finishedAt)
    setQuizRunResult(scoreRun)
    setScoreNotice('')
    if (player) {
      await saveScore(scoreRun, player)
    } else {
      setPendingScore(scoreRun)
      setProfileName('')
      setProfileEmoji(playerEmojis[0])
      setProfileOpen(true)
    }
  }

  function openProfileEditor() {
    setProfileName(player?.name ?? '')
    setProfileEmoji(player?.emoji ?? playerEmojis[0])
    setProfileError('')
    setProfileOpen(true)
  }

  function storeLocalScore(scoreRow) {
    const nextScores = rankScores([scoreRow, ...localScores]).slice(0, 50)
    localStorage.setItem(scoreStorageKey, JSON.stringify(nextScores))
    setLocalScores(nextScores)
  }

  async function saveScore(scoreRun, selectedPlayer) {
    const localRow = {
      ...scoreRun,
      id: `local-${currentTimestamp()}`,
      player_name: selectedPlayer.name,
      player_emoji: selectedPlayer.emoji,
      user_id: selectedPlayer.id,
    }
    storeLocalScore(localRow)

    if (!supabaseClient) {
      setScoreNotice('บันทึกบนอุปกรณ์นี้แล้ว ตั้งค่า Supabase เพื่อแชร์อันดับกับเพื่อน')
      return
    }

    try {
      const userId = await getAnonymousUserId()
      const { error } = await supabaseClient.from('logic_scores').insert({
        ...scoreRun,
        user_id: userId,
        player_name: selectedPlayer.name,
        player_emoji: selectedPlayer.emoji,
      })
      if (error) throw error
      setScoreNotice('ส่งคะแนนขึ้นอันดับเพื่อนแล้ว')
      setLeaderboardRefresh((current) => current + 1)
    } catch {
      setScoreNotice('บันทึกบนอุปกรณ์นี้แล้ว แต่ส่งขึ้นอันดับออนไลน์ไม่สำเร็จ')
    }
  }

  async function savePlayerProfile(event) {
    event.preventDefault()
    const name = profileName.trim()
    if (name.length < 2 || name.length > 24) {
      setProfileError('ชื่อเล่นต้องมี 2–24 ตัวอักษร')
      return
    }

    setProfileSaving(true)
    setProfileError('')
    try {
      const id = supabaseClient ? await getAnonymousUserId() : player?.id ?? `local-${crypto.randomUUID()}`
      const nextPlayer = { id, name, emoji: profileEmoji }
      localStorage.setItem(playerStorageKey, JSON.stringify(nextPlayer))
      setPlayer(nextPlayer)
      setProfileOpen(false)
      if (pendingScore) {
        await saveScore(pendingScore, nextPlayer)
        setPendingScore(null)
        setPracticeMode('leaderboard')
      }
    } catch {
      setProfileError('สร้างโปรไฟล์ไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setProfileSaving(false)
    }
  }

  async function finishFillRun() {
    const finishedAt = currentTimestamp()
    const durationMs = Math.max(0, finishedAt - (fillStartedAt ?? finishedAt))
    const correctCount = correctFillCount
    const accuracy = Math.round((correctCount / fillRows.length) * 100)
    const levelBonus = { basic: 0, intermediate: 5, challenge: 10 }[fillLevel]
    const scoreRun = {
      score: Math.min(110, accuracy + levelBonus),
      correct_count: correctCount,
      total_count: fillRows.length,
      difficulty: fillLevel,
      challenge_title: fillProblem?.title ?? fillOperatorDetails.label,
      challenge_formula: fillFormula,
      duration_ms: durationMs,
      completed_at: new Date(finishedAt).toISOString(),
    }

    setFillFinishedAt(finishedAt)
    setFillChecked(true)
    setCompletedRun(scoreRun)
    setScoreNotice('')
    if (player) {
      await saveScore(scoreRun, player)
    } else {
      setPendingScore(scoreRun)
      setProfileName('')
      setProfileEmoji(playerEmojis[0])
      setProfileOpen(true)
    }
  }

  return (
    <div className="logic-app min-h-screen font-sans text-ink">
      <aside className="course-sidebar">
        <a className="course-brand" href="#home" onClick={() => setActiveLesson('lesson')}>
          <span className="brand-symbol">∴</span>
          <span>คิดเป็น<span className="brand-dot">.</span></span>
        </a>
        <div className="course-tag"><span className="tag-line" /> ห้องเรียนตรรกศาสตร์</div>
        <div className="course-label">พื้นฐานตรรกศาสตร์</div>
        <nav className="lesson-nav" aria-label="บทเรียน">
          {lessons.map(({ id, label, number, icon: Icon }) => (
            <button
              aria-current={activeLesson === id ? 'page' : undefined}
              className={`lesson-link ${activeLesson === id ? 'is-active' : ''}`}
              key={id}
              onClick={() => setActiveLesson(id)}
              type="button"
            >
              <span className="lesson-number">{number}</span>
              <Icon size={17} strokeWidth={1.8} />
              <span className="lesson-name">{label}</span>
              {activeLesson === id && <ChevronRight className="lesson-chevron" size={15} />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="teacher-note"><Sparkles size={16} /><p>คิดช้า ๆ ได้<br /><strong>ขอแค่คิดให้ชัด</strong></p><span className="note-star">✳</span></div>
          <div className="classroom-credit"><span className="credit-mark">ม</span><span><strong>วิชาคณิตศาสตร์</strong><small>บทที่ 1 · ประพจน์</small></span></div>
        </div>
      </aside>

      <main className="lesson-main">
        <header className="lesson-topbar">
          <div className="topbar-course"><span>คณิตศาสตร์</span><span className="crumb-slash">/</span><strong>ตรรกศาสตร์เบื้องต้น</strong></div>
          <div className="topbar-meta">
            <span className="level-pill">ระดับเริ่มต้น</span>
            <span className="topbar-counter">บทเรียน <strong>{lessons.findIndex((lesson) => lesson.id === activeLesson) + 1}</strong> / 3</span>
            <button className="player-button" onClick={openProfileEditor} type="button">
              <span className="player-button-emoji">{player?.emoji ?? <UserRound size={15} />}</span>
              <span>{player?.name ?? 'ตั้งชื่อผู้เล่น'}</span>
            </button>
          </div>
        </header>

        <div className="lesson-content">
          <section className="lesson-heading">
            <div className="eyebrow"><span className="eyebrow-line" /> LOGIC 101 <span className="eyebrow-dot">·</span> บทนำ</div>
            <h1>คิดให้ชัด<br /><span>ด้วยตรรกศาสตร์</span></h1>
            <p>เริ่มจากข้อความง่าย ๆ แล้วค่อยดูว่าเหตุผลของเราสมเหตุสมผลแค่ไหน</p>
          </section>

          <nav className="lesson-tabs" aria-label="เลือกเนื้อหาบทเรียน">
            {lessons.map((lesson) => (
              <button
                aria-pressed={activeLesson === lesson.id}
                className={`lesson-tab ${activeLesson === lesson.id ? 'selected' : ''}`}
                key={lesson.id}
                onClick={() => setActiveLesson(lesson.id)}
                type="button"
              >
                <span>{lesson.number}</span>{lesson.label}
              </button>
            ))}
          </nav>

          {activeLesson === 'lesson' && (
            <div className="lesson-panel" key="lesson">
              <section className="definition-section">
                <div className="section-kicker">01 / THE IDEA</div>
                <div className="definition-layout">
                  <div className="definition-copy">
                    <h2>ประพจน์คือ<br />ข้อความที่ตัดสินค่าได้</h2>
                    <p>ประพจน์คือประโยคบอกเล่าที่ระบุได้แน่นอนว่า <strong>จริง</strong> หรือ <strong>เท็จ</strong> อย่างใดอย่างหนึ่ง</p>
                    <span className="definition-footnote"><span className="tiny-check">✓</span> ต้องเลือกได้เพียงค่าเดียว</span>
                  </div>
                  <div className="proposition-board" aria-label="ตัวอย่างประพจน์">
                    <div className="board-topline"><span>ตัวอย่างประพจน์</span><span>p, q</span></div>
                    <div className="proposition-example"><span className="variable-chip">p</span><span>โลกโคจรรอบดวงอาทิตย์</span><span aria-label="T แทนค่าจริง" className="truth-badge true">T</span></div>
                    <div className="proposition-example"><span className="variable-chip warm">q</span><span>7 เป็นจำนวนคู่</span><span aria-label="F แทนค่าเท็จ" className="truth-badge false">F</span></div>
                    <div className="board-caption">แต่ “ช่วยปิดประตูหน่อย” ยังไม่ใช่ประพจน์<br />เพราะไม่ใช่ข้อความที่บอกว่าจริงหรือเท็จ</div>
                  </div>
                </div>
              </section>

              <section className="operator-section">
                <div className="section-title-row"><div><div className="section-kicker">02 / THE CONNECTIVES</div><h2>ตัวเชื่อมทางตรรกะ</h2></div><span className="formula-note">สัญลักษณ์ที่ใช้เชื่อมประพจน์</span></div>
                <div className="operator-grid">
                  {operators.map((item) => (
                    <button className={`operator-card ${activeOperator === item.id ? 'operator-selected' : ''}`} key={item.id} onClick={() => { setActiveOperator(item.id); setActiveLesson('table') }} type="button">
                      <span className="operator-symbol">{item.symbol}</span>
                      <span className="operator-details"><strong>{item.label}</strong><small>{item.english}</small></span>
                      <span className="operator-formula">{item.formula}</span>
                    </button>
                  ))}
                </div>
              </section>
              <button className="continue-link" onClick={() => setActiveLesson('table')} type="button">ไปลองสร้างตารางค่าความจริง <ChevronRight size={16} /></button>
            </div>
          )}

          {activeLesson === 'table' && (
            <div className="lesson-panel" key="table">
              <section className="lab-intro">
                <div><div className="section-kicker">03 / INTERACTIVE LAB</div><h2>ลองดูว่าค่าความจริงเปลี่ยนอย่างไร</h2><p>เลือกตัวเชื่อม แล้วไล่ดูผลลัพธ์ของทุกกรณี</p></div>
                <div className="lab-stamp"><FlaskConical size={20} /><span>ทดลองได้เลย</span></div>
              </section>

              <section className="logic-lab" aria-label="เครื่องมือสร้างตารางค่าความจริง">
                <div className="lab-controls">
                  <div className="control-label">เลือกตัวเชื่อม</div>
                  <div className="operator-picker" role="group" aria-label="ตัวเชื่อมทางตรรกะ">
                    {operators.map((item) => (
                      <button aria-pressed={activeOperator === item.id} className={`operator-option ${activeOperator === item.id ? 'chosen' : ''}`} key={item.id} onClick={() => setActiveOperator(item.id)} type="button">
                        <span>{item.symbol}</span><small>{item.label}</small>
                      </button>
                    ))}
                  </div>
                  <div className="proposition-inputs">
                    <label><span><i className="input-dot dot-p" /> p แทนข้อความ</span><input maxLength={36} onChange={(event) => setPropositionP(event.target.value)} value={propositionP} /></label>
                    <label className={activeOperator === 'not' ? 'input-muted' : ''}><span><i className="input-dot dot-q" /> q แทนข้อความ</span><input disabled={activeOperator === 'not'} maxLength={36} onChange={(event) => setPropositionQ(event.target.value)} value={propositionQ} /></label>
                  </div>
                </div>

                <div className="table-heading">
                  <div><span>ตารางค่าความจริง</span><strong>{operator.formula}</strong></div>
                  <div className="table-meta"><span className="truth-legend"><b>T</b> = จริง <i>·</i> <b>F</b> = เท็จ</span><span className="row-count">{rows.length} กรณี</span></div>
                </div>
                <div className="truth-table-wrap">
                  <table className={`truth-table ${activeOperator === 'not' ? 'unary-truth-table' : 'binary-truth-table'}`}>
                    <thead><tr><th>p</th>{activeOperator !== 'not' && <th aria-label={`ตัวเชื่อม ${operator.label}`} className="connective-column">{operator.symbol}</th>}{activeOperator !== 'not' && <th>q</th>}<th className="result-column">ผลลัพธ์</th></tr></thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.p}-${row.q ?? 'x'}`}>
                          <td><span aria-label={row.p ? 'T แทนค่าจริง' : 'F แทนค่าเท็จ'} className={`table-value ${row.p ? 'value-true' : 'value-false'}`}>{row.p ? 'T' : 'F'}</span></td>
                          {activeOperator !== 'not' && <td aria-label={`ตัวเชื่อม ${operator.label}`} className="connective-column">{operator.symbol}</td>}
                          {activeOperator !== 'not' && <td><span aria-label={row.q ? 'T แทนค่าจริง' : 'F แทนค่าเท็จ'} className={`table-value ${row.q ? 'value-true' : 'value-false'}`}>{row.q ? 'T' : 'F'}</span></td>}
                          <td className="result-column"><span aria-label={evaluate(activeOperator, row.p, row.q) ? 'T แทนค่าจริง' : 'F แทนค่าเท็จ'} className={`table-value result-value ${evaluate(activeOperator, row.p, row.q) ? 'value-true' : 'value-false'}`}><span className="result-dot" />{evaluate(activeOperator, row.p, row.q) ? 'T' : 'F'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rule-note"><span className="rule-icon">i</span><p><strong>{operator.label} ({operator.english})</strong> — {operator.short}</p></div>
              </section>
              <button className="continue-link" onClick={() => setActiveLesson('practice')} type="button">พร้อมแล้ว ไปลองทำโจทย์ <ChevronRight size={16} /></button>
            </div>
          )}

          {activeLesson === 'practice' && (
            <div className="lesson-panel" key="practice">
              <section className="practice-heading">
                <div><div className="section-kicker">04 / PRACTICE</div><h2>{practiceMode === 'fill-table' ? 'เติมค่าความจริงในตาราง' : practiceMode === 'leaderboard' ? 'อันดับเพื่อน' : 'ลองคิดก่อนดูเฉลย'}</h2><p>{practiceMode === 'fill-table' ? 'เลือก T หรือ F เติมผลลัพธ์ให้ครบทุกแถว' : practiceMode === 'leaderboard' ? 'คะแนน เวลา และระดับโจทย์ของผู้เล่น' : `มี ${practiceQuestions.length} ข้อ ครอบคลุมตัวเชื่อมหลัก`}</p></div>
                {practiceMode !== 'leaderboard' && <div className="practice-progress"><strong>{practiceMode === 'fill-table' ? filledCount : answeredCount}<span> / {practiceMode === 'fill-table' ? fillRows.length : practiceQuestions.length}</span></strong><small>{practiceMode === 'fill-table' ? 'ช่องที่เติม' : 'ตอบแล้ว'}</small></div>}
              </section>
              <div className="practice-mode-switch" role="group" aria-label="รูปแบบแบบฝึกหัด">
                <button aria-pressed={practiceMode === 'fill-table'} className={practiceMode === 'fill-table' ? 'mode-active' : ''} onClick={() => setPracticeMode('fill-table')} type="button"><Braces size={16} /> เติมตาราง T/F</button>
                <button aria-pressed={practiceMode === 'questions'} className={practiceMode === 'questions' ? 'mode-active' : ''} onClick={() => setPracticeMode('questions')} type="button"><Lightbulb size={16} /> เลือกคำตอบ</button>
                <button aria-pressed={practiceMode === 'leaderboard'} className={practiceMode === 'leaderboard' ? 'mode-active' : ''} onClick={() => setPracticeMode('leaderboard')} type="button"><Trophy size={16} /> อันดับเพื่อน</button>
              </div>

              {practiceMode === 'leaderboard' ? (
                <section className="leaderboard-panel">
                  <div className="leaderboard-heading">
                    <div className="leaderboard-title"><span className="leaderboard-icon"><Trophy size={20} /></span><div><strong>ห้องเรียนของเรา</strong><small>เรียงคะแนนสูงสุด แล้วใช้เวลาเป็นตัวตัดสิน</small></div></div>
                    <span className={`leaderboard-connection ${supabaseClient ? 'connection-online' : 'connection-local'}`}><i />{supabaseClient ? 'อันดับออนไลน์' : 'เฉพาะอุปกรณ์นี้'}</span>
                  </div>
                  {!player && <div className="leaderboard-profile-prompt"><span>ตั้งชื่อและเลือกอีโมจิ เพื่อให้เพื่อนจำคุณได้ในตารางคะแนน</span><button onClick={openProfileEditor} type="button">ตั้งโปรไฟล์</button></div>}
                  {!supabaseClient && <p className="leaderboard-setup-note">ยังไม่ได้เชื่อมฐานคะแนนออนไลน์ คะแนนที่ทำในเครื่องนี้ยังไม่แสดงบนอุปกรณ์ของเพื่อน</p>}
                  {leaderboardError && <p className="leaderboard-error" role="status">{leaderboardError}</p>}
                  {leaderboardLoading ? <div className="leaderboard-empty">กำลังโหลดอันดับ...</div> : rankedScores.length ? (
                    <ol className="leaderboard-list">
                      {rankedScores.map((entry, index) => (
                        <li className={`leaderboard-row ${entry.user_id === player?.id ? 'leaderboard-self' : ''}`} key={entry.id ?? `${entry.user_id}-${entry.completed_at}-${index}`}>
                          <span className={`leaderboard-rank ${index < 3 ? `rank-${index + 1}` : ''}`}>{index === 0 ? <Trophy size={15} /> : index + 1}</span>
                          <span className="leaderboard-avatar">{entry.player_emoji}</span>
                          <span className="leaderboard-person"><strong>{entry.player_name}{entry.user_id === player?.id && <small>คุณ</small>}</strong><span>{entry.challenge_title} · {entry.challenge_formula}</span></span>
                          <span className="leaderboard-difficulty">{fillLevels.find((level) => level.id === entry.difficulty)?.label ?? entry.difficulty}</span>
                          <span className="leaderboard-score"><strong>{entry.score}</strong><small>คะแนน</small></span>
                          <span className="leaderboard-time"><Clock3 size={13} />{formatDuration(entry.duration_ms)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : <div className="leaderboard-empty"><Medal size={24} /><strong>ยังไม่มีคะแนน</strong><span>ทำแบบฝึกหัดตารางแรก แล้วคะแนนจะปรากฏที่นี่</span></div>}
                  <div className="leaderboard-footer"><span>คะแนน = % คำตอบถูก + โบนัสระดับ (ปานกลาง +5, ท้าทาย +10) · เวลาใช้ตัดสินเมื่อคะแนนเท่ากัน</span><button onClick={() => setLeaderboardRefresh((current) => current + 1)} type="button">รีเฟรชอันดับ</button></div>
                </section>
              ) : practiceMode === 'fill-table' ? (
                <section className="fill-table-exercise">
                  <div className="fill-table-controls">
                    <div className="fill-table-section-label"><span>1</span><strong>เลือกระดับโจทย์</strong></div>
                    <div className="fill-level-picker" role="group" aria-label="เลือกระดับความยาก">
                      {fillLevels.map((level) => (
                        <button aria-pressed={fillLevel === level.id} className={`fill-level-option ${fillLevel === level.id ? 'level-selected' : ''}`} key={level.id} onClick={() => changeFillLevel(level.id)} type="button">
                          <strong>{level.label}</strong><small>{level.detail}</small>
                        </button>
                      ))}
                    </div>
                    {isBasicFill ? (
                      <div className="basic-operator-picker">
                        <span className="picker-caption">เลือกตัวเชื่อม</span>
                        <div className="operator-picker fill-operator-picker" role="group" aria-label="เลือกตัวเชื่อมสำหรับแบบฝึกหัด">
                          {operators.map((item) => (
                            <button aria-pressed={fillOperator === item.id} className={`operator-option ${fillOperator === item.id ? 'chosen' : ''}`} key={item.id} onClick={() => changeFillOperator(item.id)} type="button">
                              <span>{item.symbol}</span><small>{item.label}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="fill-challenge-picker" role="group" aria-label="เลือกโจทย์นิพจน์ผสม">
                        {compoundChallenges.filter((challenge) => challenge.level === fillLevel).map((challenge) => (
                          <button aria-pressed={fillChallengeId === challenge.id} className={`fill-challenge-option ${fillChallengeId === challenge.id ? 'challenge-selected' : ''}`} key={challenge.id} onClick={() => changeFillChallenge(challenge.id)} type="button">
                            <span>{challenge.title}</span><strong>{challenge.formula}</strong>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="fill-table-instruction">
                    <div className="fill-table-section-label"><span>2</span><strong>เติมผลลัพธ์</strong></div>
                    <p>เติม <b>T</b> หรือ <b>F</b> ในทุกแถว โดยคำนวณจากนิพจน์ด้านบน</p>
                    <span className="truth-key-chip"><b>T</b> = จริง <i>·</i> <b>F</b> = เท็จ</span>
                  </div>
                  <div className="table-heading fill-table-heading">
                    <div><span>ตารางค่าความจริง</span><strong>{fillFormula}</strong></div>
                    <div className="table-meta"><span className={`difficulty-badge difficulty-${fillLevel}`}>{fillLevels.find((level) => level.id === fillLevel)?.label}</span><span className="row-count">{fillRows.length} แถว</span><span className="timer-chip"><Clock3 size={13} />{formatDuration(elapsedMs)}</span></div>
                  </div>
                  {fillProblem && <div className="challenge-hint"><Lightbulb size={16} /><span><strong>แนวคิด:</strong> {fillProblem.hint}</span></div>}
                  <div className="truth-table-wrap fill-table-wrap">
                    <table className={`truth-table fill-truth-table ${fillVariables.length > 2 ? 'three-variable-table' : fillVariables.length === 1 ? 'unary-truth-table' : 'binary-truth-table'}`}>
                      <thead>
                        <tr>
                          {fillVariables.map((variable, index) => (
                            <Fragment key={variable}>
                              <th className={`variable-heading variable-${variable}`}>{variable}</th>
                              {isBasicFill && fillOperator !== 'not' && index === 0 && <th aria-label={`ตัวเชื่อม ${fillOperatorDetails.label}`} className="connective-column">{fillOperatorDetails.symbol}</th>}
                            </Fragment>
                          ))}
                          <th className="result-column">เติมผลลัพธ์</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fillRows.map((row, index) => {
                          const rowKey = fillRowKey(row)
                          const correctValue = fillEvaluation(row)
                          const selectedValue = fillAnswers[rowKey]
                          const rowState = fillChecked ? selectedValue === correctValue ? 'fill-correct' : 'fill-incorrect' : selectedValue === undefined ? 'fill-empty' : 'fill-selected'
                          const rowLabel = fillVariables.map((variable) => `${variable} ${row[variable] ? 'T' : 'F'}`).join(', ')
                          return (
                            <tr key={rowKey}>
                              {fillVariables.map((variable, variableIndex) => (
                                <Fragment key={variable}>
                                  <td><span className={`table-value variable-value variable-${variable} ${row[variable] ? 'value-true' : 'value-false'}`}>{row[variable] ? 'T' : 'F'}</span></td>
                                  {isBasicFill && fillOperator !== 'not' && variableIndex === 0 && <td aria-label={`ตัวเชื่อม ${fillOperatorDetails.label}`} className="connective-column">{fillOperatorDetails.symbol}</td>}
                                </Fragment>
                              ))}
                              <td className="result-column">
                                <div className={`fill-answer-slot ${rowState}`}>
                                  <div className="fill-choice-group" role="group" aria-label={`แถว ${index + 1}: ${rowLabel}, เติมค่าความจริง`}>
                                    {[true, false].map((value) => (
                                      <button aria-label={`แถว ${index + 1}: ${rowLabel}: เลือก ${value ? 'T' : 'F'}`} aria-pressed={selectedValue === value} className={selectedValue === value ? 'fill-choice-selected' : ''} disabled={fillChecked} key={String(value)} onClick={() => selectFillAnswer(row, value)} type="button">{value ? 'T' : 'F'}</button>
                                    ))}
                                  </div>
                                  {fillChecked && <span className="fill-row-result">{selectedValue === correctValue ? 'ถูก' : `เฉลย ${correctValue ? 'T' : 'F'}`}</span>}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {fillChecked && <div className={`fill-summary ${correctFillCount === fillRows.length ? 'all-correct' : ''}`} role="status"><strong>{correctFillCount === fillRows.length ? 'ถูกต้องครบทุกแถว!' : `ถูก ${correctFillCount} จาก ${fillRows.length} แถว`}</strong><span>คะแนน {completedRun?.score ?? 0} · ใช้เวลา {formatDuration(completedRun?.duration_ms ?? 0)} · ระดับ{fillLevels.find((level) => level.id === fillLevel)?.label}</span>{scoreNotice && <small>{scoreNotice}</small>}</div>}
                  <div className="fill-table-actions">
                    <span>{filledCount === fillRows.length ? 'เติมครบแล้ว ตรวจคำตอบได้เลย' : `ยังเหลือ ${fillRows.length - filledCount} ช่อง`}</span>
                    <div>{fillChecked ? <button className="check-answer" onClick={resetFillTable} type="button"><RotateCcw size={15} /> เริ่มรอบใหม่</button> : <><button className="reset-answer" onClick={resetFillTable} type="button"><RotateCcw size={15} /> ล้างคำตอบ</button><button className="check-answer" disabled={filledCount !== fillRows.length} onClick={finishFillRun} type="button">ตรวจตาราง <ChevronRight size={16} /></button></>}</div>
                  </div>
                </section>
              ) : (
                <>
                  <div className="quiz-session-strip"><span><Clock3 size={14} /> เวลา {formatDuration(quizElapsedMs)}</span><span>{answeredCount} / {practiceQuestions.length} ข้อที่ตรวจแล้ว</span></div>
                  <nav className="practice-nav" aria-label="เลือกข้อแบบฝึกหัด">
                    {practiceQuestions.map((question, index) => (
                      <button
                        aria-current={questionIndex === index ? 'step' : undefined}
                        aria-label={`ข้อ ${index + 1}${responses[question.id]?.submitted ? ' ตอบแล้ว' : ''}`}
                        className={`practice-step ${questionIndex === index ? 'step-current' : ''} ${responses[question.id]?.submitted ? 'step-answered' : ''}`}
                        key={question.id}
                        onClick={() => changeQuestion(index)}
                        type="button"
                      >{index + 1}</button>
                    ))}
                  </nav>
                  <section className="question-card">
                <div className="question-label"><span className="question-mark">?</span> ข้อ {questionIndex + 1} <span className="question-total">/ {practiceQuestions.length}</span></div>
                <p className="question-story">กำหนดให้ <strong>p:</strong> {currentQuestion.p}{currentQuestion.q && <> และ <strong>q:</strong> {currentQuestion.q}</>}</p>
                <div className="question-given"><span className="question-truth-key"><b>T</b> = จริง · <b>F</b> = เท็จ</span><span><b>p</b> = {currentQuestion.pValue ? 'T' : 'F'}</span>{currentQuestion.q && <span><b>q</b> = {currentQuestion.qValue ? 'T' : 'F'}</span>}</div>
                <div className="question-expression"><span>พิจารณาประโยค</span><strong>{currentOperator.formula}</strong><small>{currentOperator.label} — {currentOperator.short}</small></div>
                <div className="answer-label">ประโยคนี้มีค่าความจริงเป็น...</div>
                <div className="answer-options" role="group" aria-label="เลือกคำตอบ">
                  {[{ value: true, label: 'จริง', symbol: 'T' }, { value: false, label: 'เท็จ', symbol: 'F' }].map((option) => (
                    <button aria-pressed={currentResponse.answer === option.value} className={`answer-option ${currentResponse.answer === option.value ? 'answer-selected' : ''} ${currentResponse.submitted && currentResponse.answer === option.value ? currentResponse.answer === currentQuestion.answer ? 'answer-correct' : 'answer-wrong' : ''}`} disabled={Boolean(quizFinishedAt)} key={option.label} onClick={() => chooseAnswer(option.value)} type="button">
                      <span className="answer-symbol">{option.symbol}</span><span>{option.label}</span>{currentResponse.submitted && currentResponse.answer === option.value && currentResponse.answer === currentQuestion.answer && <Check size={16} />}
                    </button>
                  ))}
                </div>
                {currentResponse.submitted && <div className={`answer-feedback ${currentResponse.answer === currentQuestion.answer ? 'feedback-correct' : 'feedback-wrong'}`} role="status"><strong>{currentResponse.answer === currentQuestion.answer ? 'ถูกต้อง!' : 'ยังไม่ใช่ ลองทบทวนกฎของตัวเชื่อมนี้'}</strong><span>{currentQuestion.explanation}</span></div>}
                <div className="question-actions">
                  <button className="reset-answer" disabled={Boolean(quizFinishedAt)} onClick={resetAnswer} type="button"><RotateCcw size={15} /> ล้างคำตอบ</button>
                  <div className="question-navigation">
                    <button aria-label="ข้อก่อนหน้า" className="question-step-button" onClick={() => changeQuestion(questionIndex - 1)} type="button">ก่อนหน้า</button>
                    <button className="check-answer" disabled={currentResponse.answer === null || Boolean(quizFinishedAt)} onClick={submitAnswer} type="button">ตรวจคำตอบ</button>
                    <button aria-label="ข้อถัดไป" className="check-answer" onClick={() => changeQuestion(questionIndex + 1)} type="button">ข้อถัดไป <ChevronRight size={16} /></button>
                  </div>
                </div>
              </section>
              <div className="teacher-tip"><Lightbulb size={17} /><p><strong>จำไว้:</strong> อ่านกฎของตัวเชื่อมก่อน แล้วแทนค่าความจริงของ p และ q ลงไปทีละตัว</p></div>
              {answeredCount === practiceQuestions.length && !quizFinishedAt && <div className="quiz-finish-prompt"><span><strong>ตอบครบแล้ว</strong> กดจบชุดเพื่อบันทึกคะแนนและเวลาที่ใช้</span><button className="check-answer" onClick={finishQuestionRun} type="button">จบแบบทดสอบ <ChevronRight size={16} /></button></div>}
              {quizFinishedAt && quizRunResult && <div className="quiz-result-panel" role="status"><div><span className="quiz-result-icon"><Trophy size={18} /></span><span><strong>จบแบบทดสอบแล้ว</strong><small>ระดับพื้นฐาน · ใช้เวลา {formatDuration(quizRunResult.duration_ms)}</small></span></div><strong className="quiz-result-score">{quizRunResult.score}<small> คะแนน</small></strong><p>ตอบถูก {quizRunResult.correct_count} จาก {quizRunResult.total_count} ข้อ{scoreNotice && <span>{scoreNotice}</span>}</p><div><button className="reset-answer" onClick={resetQuestionRun} type="button"><RotateCcw size={15} /> เล่นอีกครั้ง</button><button className="check-answer" onClick={() => setPracticeMode('leaderboard')} type="button">ดูอันดับเพื่อน <Trophy size={15} /></button></div></div>}
                </>
              )}
            </div>
          )}

          <footer className="lesson-footer"><span>LOGIC LAB <span>·</span> เรียนรู้ด้วยการลองคิด</span><span>01 — 03</span></footer>
        </div>
      </main>
      {profileOpen && (
        <div className="profile-backdrop">
          <section aria-labelledby="profile-title" aria-modal="true" className="player-modal" role="dialog">
            <div className="player-modal-heading">
              <span className="player-modal-icon"><UserRound size={19} /></span>
              <div><h2 id="profile-title">โปรไฟล์ผู้เล่น</h2><p>ใช้ชื่อเล่นและอีโมจิแสดงในตารางคะแนน</p></div>
              <button aria-label="ปิดหน้าต่าง" className="player-modal-close" onClick={() => setProfileOpen(false)} type="button"><X size={18} /></button>
            </div>
            <form className="player-form" onSubmit={savePlayerProfile}>
              <label className="player-name-field"><span>ชื่อเล่น <small>{profileName.trim().length}/24</small></span><input autoFocus maxLength={24} onChange={(event) => setProfileName(event.target.value)} placeholder="เช่น น้องตรรกะ" value={profileName} /></label>
              <fieldset className="emoji-picker"><legend>เลือกอีโมจิประจำตัว</legend><div>{playerEmojis.map((emoji) => <button aria-label={`เลือก ${emoji}`} aria-pressed={profileEmoji === emoji} className={profileEmoji === emoji ? 'emoji-selected' : ''} key={emoji} onClick={() => setProfileEmoji(emoji)} type="button">{emoji}</button>)}</div></fieldset>
              {pendingScore && <div className="pending-score-note"><strong>คะแนนรอบนี้ {pendingScore.score}</strong><span>{pendingScore.challenge_title} · {formatDuration(pendingScore.duration_ms)} · ระดับ{fillLevels.find((level) => level.id === pendingScore.difficulty)?.label}</span></div>}
              <p className="profile-privacy-note">ไม่ต้องใช้รหัสผ่าน ชื่อเล่นและอีโมจินี้จะแสดงต่อทุกคนที่เปิดตารางคะแนน ห้ามใช้ชื่อจริงหรือข้อมูลส่วนตัว</p>
              {profileError && <p className="profile-error" role="alert">{profileError}</p>}
              <button className="save-player-button" disabled={profileSaving || profileName.trim().length < 2} type="submit">{profileSaving ? 'กำลังบันทึก...' : player ? 'บันทึกโปรไฟล์' : 'เริ่มใช้ชื่อนี้'} <ChevronRight size={16} /></button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
