import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import './MapLayout.css'
import { addPersonalBest, addWorkout, clearAllData, db, exportData, importData, type Note, type PersonalBest, type Workout } from './db'
import { canonicalMuscleId, MUSCLES, muscleById, type BodyView, type Muscle } from './muscles'
import { pathsForMuscle } from './musclePaths'

type Tab = 'home' | 'notes' | 'stats' | 'settings'
type Toast = { message: string; undo?: () => Promise<void> }
const date = (v: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(v))
const time = (v: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(v))
const activityDateTime = (v: string) => {
  const logged = new Date(v)
  const today = new Date()
  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(logged.getFullYear(), logged.getMonth(), logged.getDate())) / 86400000)
  const relative = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days > 1 ? `${days} days ago` : `In ${Math.abs(days)} days`
  const weekdayDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(logged)
  return `${weekdayDate} · ${relative} · ${time(v)}`
}
const localDateTime = (v: string) => { const d = new Date(v); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function App() {
  const [tab, setTab] = useState<Tab>('home'), [view, setView] = useState<'front' | 'back'>('front')
  const [workouts, setWorkouts] = useState<Workout[]>([]), [pbs, setPbs] = useState<PersonalBest[]>([]), [notes, setNotes] = useState<Note[]>([])
  const [recovery, setRecovery] = useState(72), [detail, setDetail] = useState<Muscle | null>(null), [pbMuscle, setPbMuscle] = useState<Muscle | null>(null), [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const refresh = async () => { const [w, p, n, s] = await Promise.all([db.workouts.orderBy('timestamp').reverse().toArray(), db.personalBests.orderBy('timestamp').reverse().toArray(), db.notes.orderBy('updatedAt').reverse().toArray(), db.settings.get('recoveryHours')]); setWorkouts(w); setPbs(p); setNotes(n); setRecovery(Number(s?.value ?? 72)) }
  useEffect(() => { void refresh() }, [])
  const notify = (next: Toast) => { clearTimeout(timer.current); setToast(next); timer.current = window.setTimeout(() => setToast(null), 1000) }
  const latest = useMemo(() => { const map = new Map<string, Workout>(); workouts.forEach((w) => { const id = canonicalMuscleId(w.muscleId); const existing = map.get(id); if (!existing || new Date(w.timestamp) > new Date(existing.timestamp)) map.set(id, w) }); return map }, [workouts])
  const state = (id: string) => { const w = latest.get(id); if (!w) return 'idle'; const age = Date.now() - new Date(w.timestamp).getTime(); if (age >= recovery * 3600000) return 'idle'; return age < 86400000 ? 'fresh' : age < 172800000 ? 'warm' : 'cool' }
  const log = async (m: Muscle) => { const prior = latest.get(m.id); if (prior && Date.now() - new Date(prior.timestamp).getTime() < 10000 && prior.id) { await db.workouts.delete(prior.id); await refresh(); notify({ message: `${m.name} log removed`, undo: async () => { await addWorkout(m.id, prior.timestamp); await refresh() } }); return } if (state(m.id) !== 'idle') { setDetail(m); return } const id = await addWorkout(m.id); await refresh(); notify({ message: `${m.name} logged`, undo: async () => { await db.workouts.delete(id); await refresh() } }) }
  return <main className="app-shell"><header className={`topbar${tab === 'notes' ? ' topbar-notes' : ''}`}><h1>Training log</h1></header><section className="page-content">
    {tab === 'home' && <Home view={view} setView={setView} state={state} workouts={workouts} pbs={pbs} onTap={log} onLong={setPbMuscle} onStats={() => setTab('stats')} />}
    {tab === 'notes' && <Notes notes={notes} refresh={refresh} notify={notify} />}
    {tab === 'stats' && <Stats workouts={workouts} pbs={pbs} />}
    {tab === 'settings' && <Settings recovery={recovery} setRecovery={async (n) => { const value = Math.max(1, Math.min(168, n || 72)); await db.settings.put({ key: 'recoveryHours', value }); setRecovery(value); notify({ message: `Recovery set to ${value} hours` }) }} workouts={workouts} pbs={pbs} notes={notes} refresh={refresh} notify={notify} />}
  </section><nav className="bottom-nav" aria-label="Main navigation">{([['home', '◎', 'Home'], ['notes', '▤', 'Notes'], ['stats', '◔', 'Stats'], ['settings', '⚙', 'Settings']] as const).map(([id, icon, label]) => <button className={tab === id ? 'nav-item active' : 'nav-item'} key={id} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>)}</nav>
  {detail && <Detail muscle={detail} workout={latest.get(detail.id)} recovery={recovery} onClose={() => setDetail(null)} onLog={async () => { await addWorkout(detail.id); await refresh(); setDetail(null); notify({ message: `${detail.name} logged again` }) }} onPb={() => { setPbMuscle(detail); setDetail(null) }} onRemove={async () => { const w = latest.get(detail.id); if (w?.id) await db.workouts.delete(w.id); await refresh(); setDetail(null); notify({ message: `${detail.name} log removed` }) }} />}
  {pbMuscle && <PBModal muscle={pbMuscle} onClose={() => setPbMuscle(null)} refresh={refresh} notify={notify} />}{toast && <div className="toast" role="status">{toast.message}{toast.undo && <button onClick={() => { void toast.undo?.(); setToast(null) }}>Undo</button>}</div>}</main>
}

function Home({ view, setView, state, workouts, pbs, onTap, onLong, onStats }: { view: BodyView; setView: (v: BodyView) => void; state: (id: string) => string; workouts: Workout[]; pbs: PersonalBest[]; onTap: (m: Muscle) => void; onLong: (m: Muscle) => void; onStats: () => void }) {
  const week = workouts.filter((w) => new Date(w.timestamp).getTime() > Date.now() - 604800000)
  return <><div className="segmented"><button className={view === 'front' ? 'selected' : ''} onClick={() => setView('front')}>Front</button><button className={view === 'back' ? 'selected' : ''} onClick={() => setView('back')}>Back</button></div><Diagram view={view} state={state} onTap={onTap} onLong={onLong} /><div className="legend"><span><i className="fresh" /> &lt;24h</span><span><i className="warm" /> 24-48h</span><span><i className="cool" /> 48h+</span></div><div className="summary-row"><Metric value={String(week.length)} label="this week" /><Metric value={String(new Set(week.map((w) => canonicalMuscleId(w.muscleId))).size)} label="muscles" /><Metric value={String(pbs.filter((p) => new Date(p.timestamp).getTime() > Date.now() - 604800000).length)} label="new PBs" /></div><section className="section-block"><div className="section-title"><h2>Recent activity</h2><button className="text-button" onClick={onStats}>See stats</button></div>{workouts.length ? <div className="activity-list">{workouts.slice(0, 7).map((w) => <div className="activity" key={w.id}><strong>{muscleById(w.muscleId)?.name ?? w.muscleId}</strong><span>{activityDateTime(w.timestamp)}</span></div>)}</div> : <Empty text="Your latest training will appear here." />}</section></>
}
function Metric({ value, label }: { value: string; label: string }) { return <div className="summary"><strong>{value}</strong><span>{label}</span></div> }
function Empty({ text }: { text: string }) { return <p className="empty">{text}</p> }

function Diagram({ view, state, onTap, onLong }: { view: BodyView; state: (id: string) => string; onTap: (m: Muscle) => void; onLong: (m: Muscle) => void }) {
  const timer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const image = `${import.meta.env.BASE_URL}bodymap-${view}.png`
  const artistViewBox = '0 0 660.46 1206.46'

  return <div className="body-wrap">
    <svg className="body-diagram" viewBox={artistViewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${view} interactive muscle map`}>
      <image href={image} x="0" y="0" width="660.46" height="1206.46" preserveAspectRatio="none" />
      {MUSCLES.filter((muscle) => muscle.pathGroups[view]).flatMap((muscle) =>
        pathsForMuscle(muscle, view).map((path, index) => {
          const current = state(muscle.id)
          return <path
            key={`${muscle.id}-${index}`}
            className={`muscle ${current}`}
            d={path}
            style={current === 'idle'
              ? { fill: 'transparent', stroke: 'transparent', pointerEvents: 'all', cursor: 'pointer' }
              : { fillOpacity: .72, stroke: '#ffb15c', strokeWidth: 4, pointerEvents: 'all', cursor: 'pointer' }}
            tabIndex={0}
            aria-label={muscle.name}
            onPointerDown={() => {
              held.current = false
              timer.current = window.setTimeout(() => { held.current = true; onLong(muscle) }, 550)
            }}
            onPointerUp={() => { clearTimeout(timer.current); if (!held.current) onTap(muscle) }}
            onPointerLeave={() => clearTimeout(timer.current)}
            onKeyDown={(event) => { if (event.key === 'Enter') onTap(muscle) }}
          />
        }),
      )}
    </svg>
  </div>
}

function Detail({ muscle, workout, recovery, onClose, onLog, onPb, onRemove }: { muscle: Muscle; workout?: Workout; recovery: number; onClose: () => void; onLog: () => void; onPb: () => void; onRemove: () => void }) { const hours = workout ? Math.max(0, recovery - (Date.now() - new Date(workout.timestamp).getTime()) / 3600000) : 0; return <Modal onClose={onClose}><h2>{muscle.name}</h2><p className="modal-subtitle">Recovering for about {Math.ceil(hours)} more hours.</p><p className="detail-time">Last trained {workout ? `${date(workout.timestamp)} at ${time(workout.timestamp)}` : 'never'}</p><div className="detail-actions"><button className="secondary-button" onClick={onLog}>Log this muscle again</button><button className="primary-button" onClick={onPb}>Add personal best</button><button className="danger-button" onClick={onRemove}>Remove latest log</button></div></Modal> }
function PBModal({ muscle, onClose, refresh, notify }: { muscle: Muscle; onClose: () => void; refresh: () => Promise<void>; notify: (t: Toast) => void }) { const [exercise, setExercise] = useState(''), [weight, setWeight] = useState(''), [notes, setNotes] = useState(''); const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!exercise || !weight) return; await addPersonalBest({ muscleId: muscle.id, exercise, weightKg: Number(weight), notes }); await refresh(); onClose(); notify({ message: `PB saved for ${muscle.name}` }) }; return <Modal onClose={onClose}><h2>New personal best</h2><p className="modal-subtitle">{muscle.name} · logs a workout if not already logged this hour</p><form className="form-stack" onSubmit={submit}><label>Exercise<input autoFocus value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="e.g. Barbell bench press" /></label><label>Weight (kg)<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><label>Note <span>(optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button className="primary-button">Save PB</button></form></Modal> }

function Notes({ notes, refresh, notify }: { notes: Note[]; refresh: () => Promise<void>; notify: (t: Toast) => void }) {
  const [edit, setEdit] = useState<Note | 'new' | null>(null)
  const [query, setQuery] = useState('')
  const shown = notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase()))

  if (edit) return <NoteEditor note={edit === 'new' ? undefined : edit} onBack={() => setEdit(null)} refresh={refresh} notify={notify} />

  return <>
    <section className="notes-header">
      <div><h2>Notes</h2><span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div>
      <button className="notes-compose" aria-label="Create note" onClick={() => setEdit('new')}>＋</button>
    </section>
    <label className="notes-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
    {shown.length ? <div className="notes-list">{shown.map((note) => {
      const preview = note.content.replace(/\s+/g, ' ').trim()
      const updated = new Date(note.updatedAt)
      const today = new Date()
      const isToday = updated.toDateString() === today.toDateString()
      return <button className="note-row" key={note.id} onClick={() => setEdit(note)}>
        <time>{isToday ? `Today, ${time(note.updatedAt)}` : date(note.updatedAt)}</time>
        <strong>{note.title.trim() || 'New Note'}</strong>
        <span>{preview || 'No additional text'}</span>
        <b aria-hidden="true">›</b>
      </button>
    })}</div> : <div className="notes-empty"><span aria-hidden="true">▤</span><strong>{query ? 'No Matches' : 'No Notes'}</strong><p>{query ? 'Try a different search.' : 'Your training thoughts and reminders will appear here.'}</p><button className="small-primary" onClick={() => setEdit('new')}>Create a note</button></div>}
  </>
}

function NoteEditor({ note, onBack, refresh, notify }: { note?: Note; onBack: () => void; refresh: () => Promise<void>; notify: (t: Toast) => void }) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [saving, setSaving] = useState(false)

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (saving) return
    setSaving(true)
    const now = new Date().toISOString()
    if (note?.id !== undefined) await db.notes.update(note.id, { title, content, updatedAt: now })
    else if (title.trim() || content.trim()) await db.notes.add({ title, content, createdAt: now, updatedAt: now })
    await refresh()
    onBack()
    if (title.trim() || content.trim()) notify({ message: 'Note saved' })
  }

  const remove = async () => {
    if (note?.id === undefined || !confirm('Delete this note? This cannot be undone.')) return
    await db.notes.delete(note.id)
    await refresh()
    onBack()
    notify({ message: 'Note deleted' })
  }

  return <section className="note-editor-page">
    <header className="note-editor-header">
      <button className="note-back" onClick={() => void save()}><span aria-hidden="true">‹</span> Notes</button>
      <button className="note-done" onClick={() => void save()}>Done</button>
    </header>
    <form className="note-editor-form" onSubmit={(event) => void save(event)}>
      <input className="note-title-input" autoFocus={!note} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" aria-label="Note title" />
      <textarea className="note-content-input" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Start writing…" aria-label="Note contents" />
    </form>
    <footer className="note-editor-footer">
      {note && <button className="note-delete" onClick={() => void remove()} aria-label="Delete note">Delete note</button>}
      <span>{note ? `Edited ${date(note.updatedAt)}` : 'On this device'}</span>
    </footer>
  </section>
}
function NoteModal({ note, onClose, refresh, notify }: { note?: Note; onClose: () => void; refresh: () => Promise<void>; notify: (t: Toast) => void }) { const [title, setTitle] = useState(note?.title ?? ''), [content, setContent] = useState(note?.content ?? ''); const save = async (e: React.FormEvent) => { e.preventDefault(); const now = new Date().toISOString(); if (note?.id) await db.notes.update(note.id, { title, content, updatedAt: now }); else await db.notes.add({ title, content, createdAt: now, updatedAt: now }); await refresh(); onClose(); notify({ message: 'Note saved' }) }; return <Modal onClose={onClose}><h2>{note ? 'Edit note' : 'New note'}</h2><form className="form-stack" onSubmit={save}><label>Title<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" /></label><label>Note<textarea className="note-area" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write something useful..." /></label><button className="primary-button">Save note</button>{note?.id && <button type="button" className="danger-button" onClick={async () => { await db.notes.delete(note.id!); await refresh(); onClose(); notify({ message: 'Note deleted' }) }}>Delete note</button>}</form></Modal> }

function Stats({ workouts, pbs }: { workouts: Workout[]; pbs: PersonalBest[] }) {
  const [days, setDays] = useState(30)
  const [statsTab, setStatsTab] = useState<'overview' | 'sessions'>('overview')
  const recent = workouts.filter((w) => new Date(w.timestamp).getTime() >= Date.now() - days * 86400000)
  const data = MUSCLES.map((m) => ({ name: m.name, count: recent.filter((w) => canonicalMuscleId(w.muscleId) === m.id).length })).filter((x) => x.count)
  const workoutCounts = new Map<string, number>()
  workouts.forEach((workout) => {
    const key = localDayKey(new Date(workout.timestamp))
    workoutCounts.set(key, (workoutCounts.get(key) ?? 0) + 1)
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - 6, 1)
  const sixMonthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(today.getDate(), new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()))
  const firstSunday = new Date(sixMonthStart.getFullYear(), sixMonthStart.getMonth(), sixMonthStart.getDate() - sixMonthStart.getDay())
  const currentSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  const weekCount = Math.floor((Date.UTC(currentSunday.getFullYear(), currentSunday.getMonth(), currentSunday.getDate()) - Date.UTC(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate())) / 604800000) + 1
  const heatmapWeeks = Array.from({ length: weekCount }, (_, weekIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
    const cellDate = new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + weekIndex * 7 + dayIndex)
    const beforeRange = cellDate < sixMonthStart
    const future = cellDate > today
    return { date: cellDate, count: beforeRange || future ? 0 : workoutCounts.get(localDayKey(cellDate)) ?? 0, beforeRange, future }
  }))
  const activeDays = heatmapWeeks.flat().filter((day) => !day.beforeRange && !day.future && day.count > 0).length
  const sessionMap = new Map<string, Workout[]>()
  workouts.forEach((workout) => {
    const sessionId = workout.sessionId ?? new Date(workout.timestamp).toISOString().slice(0, 13)
    sessionMap.set(sessionId, [...(sessionMap.get(sessionId) ?? []), workout])
  })
  const sessions = Array.from(sessionMap, ([id, records]) => ({
    id,
    records: records.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  })).sort((a, b) => b.records[b.records.length - 1].timestamp.localeCompare(a.records[a.records.length - 1].timestamp))
  const pbGraphs = MUSCLES.map((muscle) => ({
    muscle,
    records: pbs.filter((pb) => canonicalMuscleId(pb.muscleId) === muscle.id).slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  })).filter((graph) => graph.records.length > 0)
  const lineColors = ['#ff9500', '#4db6ac', '#8e7dff', '#ff6685', '#e6c84f', '#61a4ff']

  return <>
    <section className="page-heading"><h2>Stats</h2><span className="muted">On-device only</span></section>
    <div className="segmented stats-tabs" role="tablist" aria-label="Stats sections">
      <button role="tab" aria-selected={statsTab === 'overview'} className={statsTab === 'overview' ? 'selected' : ''} onClick={() => setStatsTab('overview')}>Overview</button>
      <button role="tab" aria-selected={statsTab === 'sessions'} className={statsTab === 'sessions' ? 'selected' : ''} onClick={() => setStatsTab('sessions')}>Sessions</button>
    </div>
    {statsTab === 'overview' ? <>
    <div className="range-tabs">{[[30, '30d'], [90, '3m'], [365, '1y'], [99999, 'All']].map(([n, label]) => <button className={days === n ? 'selected' : ''} key={n} onClick={() => setDays(Number(n))}>{label}</button>)}</div>
    <div className="metrics"><Metric value={String(new Set(recent.map((w) => new Date(w.timestamp).toDateString())).size)} label="training days" /><Metric value={String(recent.length)} label="muscle logs" /><Metric value={String(pbs.length)} label="PBs" /></div>
    <section className="chart-card heatmap-card">
      <div className="section-title"><h3>Training activity</h3><span className="muted">{activeDays} active days · past 6 months</span></div>
      <div className="heatmap-scroll">
        <div className="heatmap-body">
          <div className="heatmap-weekdays" aria-hidden="true"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
          <div className="heatmap-main">
            <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${heatmapWeeks.length}, minmax(0, 1fr))` }} aria-hidden="true">{heatmapWeeks.map((week, index) => {
              const month = week[3].date.getMonth()
              const previousMonth = index > 0 ? heatmapWeeks[index - 1][3].date.getMonth() : -1
              return month !== previousMonth ? <span key={index} style={{ gridColumnStart: index + 1 }}>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(week[3].date)}</span> : null
            })}</div>
            <div className="heatmap-weeks" style={{ gridTemplateColumns: `repeat(${heatmapWeeks.length}, minmax(0, 1fr))` }} aria-label="Workout activity for the past six months">{heatmapWeeks.map((week, index) => <div className="heatmap-week" key={index}>{week.map((day) => {
              const level = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count <= 3 ? 2 : day.count <= 5 ? 3 : 4
              const label = day.beforeRange || day.future ? 'Outside the six-month view' : `${new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(day.date)}: ${day.count} ${day.count === 1 ? 'workout' : 'workouts'}`
              return <span key={localDayKey(day.date)} className={`heatmap-cell heat-${level}${day.future || day.beforeRange ? ' heat-future' : ''}`} title={label} role="img" aria-label={label} />
            })}</div>)}</div>
          </div>
        </div>
      </div>
      <div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heatmap-cell heat-${level}`} />)}<span>More</span><small>Squares count workout logs</small></div>
    </section>
    <section className="chart-card"><h3>Training frequency</h3>{data.length ? <ResponsiveContainer width="100%" height={Math.max(190, data.length * 38)}><BarChart data={data} layout="vertical" margin={{ left: 8, right: 20 }}><CartesianGrid horizontal={false} stroke="#2c2c2c" /><XAxis type="number" allowDecimals={false} stroke="#a6a6a6" /><YAxis type="category" dataKey="name" width={78} stroke="#d9d9d9" fontSize={12} /><Tooltip contentStyle={{ background: '#171717', border: '1px solid #333' }} /><Bar dataKey="count" fill="#ff7a00" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <Empty text="Log a muscle to see your training frequency." />}</section>
    <section className="pb-graphs">
      {pbGraphs.length ? pbGraphs.map(({ muscle, records }) => {
        const exercises = [...new Set(records.map((record) => record.exercise))]
        const chartData = records.map((record) => ({ date: date(record.timestamp), [record.exercise]: record.weightKg }))
        return <section className="chart-card" key={muscle.id}>
          <h3>{muscle.name} PBs (kg)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#2c2c2c" />
              <XAxis dataKey="date" stroke="#a6a6a6" fontSize={12} />
              <YAxis stroke="#a6a6a6" fontSize={12} />
              <Tooltip contentStyle={{ background: '#171717', border: '1px solid #333' }} />
              {exercises.map((name, index) => <Line key={name} type="monotone" dataKey={name} name={name} connectNulls dot stroke={lineColors[index % lineColors.length]} strokeWidth={3} />)}
              {exercises.length > 1 && <Legend />}
            </LineChart>
          </ResponsiveContainer>
        </section>
      }) : <section className="chart-card"><Empty text="Add a personal best to see progress over time." /></section>}
    </section>
    </> : <section className="session-history">
      <div className="section-title"><h3>Workout session history</h3><span className="muted">{sessions.length} sessions</span></div>
      {sessions.length ? sessions.map(({ id, records }) => {
        const muscleNames = [...new Set(records.map((record) => muscleById(record.muscleId)?.name ?? record.muscleId))]
        const sessionDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(records[0].timestamp))
        return <details className="session-entry" key={id}>
          <summary><strong>{sessionDate} · {time(records[0].timestamp)}</strong><span>{records.length} {records.length === 1 ? 'log' : 'logs'} · {muscleNames.join(', ')}</span></summary>
          <div className="session-records">{records.map((record, index) => <div className="session-record" key={record.id ?? `${id}-${index}`}><strong>{muscleById(record.muscleId)?.name ?? record.muscleId}</strong><span>{time(record.timestamp)}</span></div>)}</div>
        </details>
      }) : <section className="chart-card"><Empty text="No workout sessions logged yet." /></section>}
    </section>}
  </>
}

function Settings({ recovery, setRecovery, workouts, pbs, notes, refresh, notify }: { recovery: number; setRecovery: (n: number) => Promise<void>; workouts: Workout[]; pbs: PersonalBest[]; notes: Note[]; refresh: () => Promise<void>; notify: (t: Toast) => void }) {
  const [value, setValue] = useState(String(recovery))
  const [editWorkout, setEditWorkout] = useState<Workout | null>(null)
  const [editPb, setEditPb] = useState<PersonalBest | null>(null)
  const [editNote, setEditNote] = useState<Note | null>(null)
  useEffect(() => setValue(String(recovery)), [recovery])

  const download = async () => {
    const data = await exportData()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `muscle-map-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify({ message: 'Backup downloaded' })
  }

  const upload = async (file?: File) => {
    if (!file || !confirm('Restore this backup? Existing local data will be replaced.')) return
    try {
      await importData(JSON.parse(await file.text()))
      await refresh()
      notify({ message: 'Backup restored' })
    } catch {
      notify({ message: 'That backup file could not be restored' })
    }
  }

  const clear = async () => {
    if (!confirm('Clear all workouts, personal bests, notes, and settings from this device? This cannot be undone.')) return
    await clearAllData()
    await refresh()
    notify({ message: 'All data cleared' })
  }

  return <>
    <section className="page-heading"><h2>Settings</h2></section>
    <section className="settings-card">
      <h3>Recovery</h3><p>How long a trained muscle stays highlighted.</p>
      <div className="setting-row"><label>Hours<input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} /></label><button className="small-primary" onClick={() => void setRecovery(Number(value))}>Save</button></div>
    </section>
    <section className="settings-card">
      <h3>Edit saved data</h3><p>Select a record to change its saved details.</p>
      <details className="record-group"><summary>Workout logs ({workouts.length})</summary>
        {workouts.length ? <div className="record-list">{workouts.map((workout, index) => <button className="record-row" key={workout.id ?? index} onClick={() => setEditWorkout(workout)}><strong>{muscleById(workout.muscleId)?.name ?? workout.muscleId}</strong><span>{date(workout.timestamp)} · {time(workout.timestamp)}</span></button>)}</div> : <p className="record-empty">No workout logs yet.</p>}
      </details>
      <details className="record-group"><summary>Personal bests ({pbs.length})</summary>
        {pbs.length ? <div className="record-list">{pbs.map((pb, index) => <button className="record-row" key={pb.id ?? index} onClick={() => setEditPb(pb)}><strong>{pb.exercise} · {pb.weightKg} kg</strong><span>{muscleById(pb.muscleId)?.name ?? pb.muscleId} · {date(pb.timestamp)}</span></button>)}</div> : <p className="record-empty">No personal bests yet.</p>}
      </details>
      <details className="record-group"><summary>Notes ({notes.length})</summary>
        {notes.length ? <div className="record-list">{notes.map((note, index) => <button className="record-row" key={note.id ?? index} onClick={() => setEditNote(note)}><strong>{note.title || 'Untitled note'}</strong><span>Updated {date(note.updatedAt)}</span></button>)}</div> : <p className="record-empty">No notes yet.</p>}
      </details>
    </section>
    <section className="settings-card"><h3>Data management</h3><p>Your data stays in this browser on this device. Back it up before clearing browser data.</p><button className="secondary-button" onClick={() => void download()}>Export JSON backup</button><label className="file-button">Import JSON backup<input type="file" accept="application/json" onChange={(e) => void upload(e.target.files?.[0])} /></label><button className="danger-button" onClick={() => void clear()}>Clear all data</button></section>
    <section className="settings-card subtle"><h3>About Muscle Map</h3><p>Works offline after the first visit. There is no account and no server copy of your training data.</p></section>
    {editWorkout && <EditWorkoutModal workout={editWorkout} onClose={() => setEditWorkout(null)} refresh={refresh} notify={notify} />}
    {editPb && <EditPbModal pb={editPb} onClose={() => setEditPb(null)} refresh={refresh} notify={notify} />}
    {editNote && <NoteModal note={editNote} onClose={() => setEditNote(null)} refresh={refresh} notify={notify} />}
  </>
}

function EditWorkoutModal({ workout, onClose, refresh, notify }: { workout: Workout; onClose: () => void; refresh: () => Promise<void>; notify: (t: Toast) => void }) {
  const [muscleId, setMuscleId] = useState(canonicalMuscleId(workout.muscleId))
  const [timestamp, setTimestamp] = useState(localDateTime(workout.timestamp))
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (workout.id === undefined || !timestamp) return
    const savedTime = new Date(timestamp).toISOString()
    await db.workouts.update(workout.id, { muscleId, timestamp: savedTime, sessionId: savedTime.slice(0, 13) })
    await refresh()
    onClose()
    notify({ message: 'Workout log updated' })
  }
  return <Modal onClose={onClose}><h2>Edit workout log</h2><form className="form-stack" onSubmit={save}><label>Muscle<select value={muscleId} onChange={(e) => setMuscleId(e.target.value)}>{MUSCLES.map((muscle) => <option key={muscle.id} value={muscle.id}>{muscle.name}</option>)}</select></label><label>Date and time<input type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} /></label><button className="primary-button">Save changes</button></form></Modal>
}

function EditPbModal({ pb, onClose, refresh, notify }: { pb: PersonalBest; onClose: () => void; refresh: () => Promise<void>; notify: (t: Toast) => void }) {
  const [muscleId, setMuscleId] = useState(canonicalMuscleId(pb.muscleId))
  const [exercise, setExercise] = useState(pb.exercise)
  const [weight, setWeight] = useState(String(pb.weightKg))
  const [notes, setNotes] = useState(pb.notes ?? '')
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pb.id === undefined || !exercise || !weight) return
    await db.personalBests.update(pb.id, { muscleId, exercise, weightKg: Number(weight), notes })
    await refresh()
    onClose()
    notify({ message: 'Personal best updated' })
  }
  return <Modal onClose={onClose}><h2>Edit personal best</h2><form className="form-stack" onSubmit={save}><label>Muscle<select value={muscleId} onChange={(e) => setMuscleId(e.target.value)}>{MUSCLES.map((muscle) => <option key={muscle.id} value={muscle.id}>{muscle.name}</option>)}</select></label><label>Exercise<input value={exercise} onChange={(e) => setExercise(e.target.value)} /></label><label>Weight (kg)<input type="number" min="0" step="any" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><label>Note <span>(optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button className="primary-button">Save changes</button></form></Modal>
}
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><button className="close-button" aria-label="Close" onClick={onClose}>×</button>{children}</section></div> }
