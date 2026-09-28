import Dexie, { type EntityTable } from 'dexie'
import { canonicalMuscleId } from './muscles'

export type Workout = { id?: number; muscleId: string; timestamp: string; sessionId?: string }
export type PersonalBest = { id?: number; muscleId: string; exercise: string; weightKg: number; reps?: number; timestamp: string; notes?: string }
export type Note = { id?: number; title: string; content: string; createdAt: string; updatedAt: string; workoutId?: number }
export type Setting = { key: string; value: string | number | boolean }
export type Backup = { version: 1; workouts: Workout[]; personalBests: PersonalBest[]; notes: Note[]; settings: Setting[] }

class MuscleMapDatabase extends Dexie {
  workouts!: EntityTable<Workout, 'id'>
  personalBests!: EntityTable<PersonalBest, 'id'>
  notes!: EntityTable<Note, 'id'>
  settings!: EntityTable<Setting, 'key'>
  constructor() {
    super('muscleMap')
    this.version(1).stores({
      workouts: '++id,muscleId,timestamp,sessionId',
      personalBests: '++id,muscleId,exercise,timestamp',
      notes: '++id,updatedAt,createdAt',
      settings: 'key',
    })
  }
}

export const db = new MuscleMapDatabase()

export async function clearAllData() {
  await db.transaction('rw', db.workouts, db.personalBests, db.notes, db.settings, async () => {
    await Promise.all([db.workouts.clear(), db.personalBests.clear(), db.notes.clear(), db.settings.clear()])
  })
}

export async function addWorkout(muscleId: string, timestamp = new Date().toISOString()) {
  return db.workouts.add({ muscleId, timestamp, sessionId: new Date(timestamp).toISOString().slice(0, 13) })
}

export async function addPersonalBest(input: Omit<PersonalBest, 'id' | 'timestamp'>) {
  const timestamp = new Date().toISOString()
  const sessionId = timestamp.slice(0, 13)
  await db.transaction('rw', db.personalBests, db.workouts, async () => {
    await db.personalBests.add({ ...input, timestamp })
    const workoutsInSession = await db.workouts.where('sessionId').equals(sessionId).toArray()
    const alreadyLogged = workoutsInSession.some((workout) => canonicalMuscleId(workout.muscleId) === canonicalMuscleId(input.muscleId))
    if (!alreadyLogged) await addWorkout(input.muscleId, timestamp)
  })
}

export async function exportData(): Promise<Backup> {
  const [workouts, personalBests, notes, settings] = await Promise.all([
    db.workouts.toArray(), db.personalBests.toArray(), db.notes.toArray(), db.settings.toArray(),
  ])
  return { version: 1, workouts, personalBests, notes, settings }
}

export async function importData(data: Backup) {
  if (!data || data.version !== 1 || !Array.isArray(data.workouts) || !Array.isArray(data.personalBests) || !Array.isArray(data.notes) || !Array.isArray(data.settings)) throw new Error('Invalid backup')
  await db.transaction('rw', db.workouts, db.personalBests, db.notes, db.settings, async () => {
    await Promise.all([db.workouts.clear(), db.personalBests.clear(), db.notes.clear(), db.settings.clear()])
    await db.workouts.bulkAdd(data.workouts.map(({ id: _id, ...rest }) => rest))
    await db.personalBests.bulkAdd(data.personalBests.map(({ id: _id, ...rest }) => rest))
    await db.notes.bulkAdd(data.notes.map(({ id: _id, ...rest }) => rest))
    await db.settings.bulkAdd(data.settings)
  })
}
