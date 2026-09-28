export type BodyView = 'front' | 'back'

export type Muscle = {
  id: string
  name: string
  pathGroups: Partial<Record<BodyView, string[]>>
}

// Each source group contains the artist's paths for both sides. Add a source
// group here to link it to the same workout/recovery record.
export const MUSCLES: Muscle[] = [
  { id: 'calves', name: 'Calves', pathGroups: { front: ['calves'], back: ['calves'] } },
  { id: 'quads', name: 'Quads', pathGroups: { front: ['quads'] } },
  { id: 'abdominals', name: 'Abs', pathGroups: { front: ['abdominals'] } },
  { id: 'obliques', name: 'Obliques', pathGroups: { front: ['obliques'] } },
  { id: 'hands', name: 'Hands', pathGroups: { front: ['hands'], back: ['hands'] } },
  { id: 'forearms', name: 'Forearms', pathGroups: { front: ['forearms'], back: ['forearms'] } },
  { id: 'biceps', name: 'Biceps', pathGroups: { front: ['biceps'] } },
  { id: 'shoulders', name: 'Shoulders', pathGroups: { front: ['front-shoulders'], back: ['rear-shoulders'] } },
  { id: 'chest', name: 'Chest', pathGroups: { front: ['chest'] } },
  { id: 'traps', name: 'Traps', pathGroups: { front: ['traps'], back: ['traps', 'traps-middle'] } },
  { id: 'hamstrings', name: 'Hamstrings', pathGroups: { back: ['hamstrings'] } },
  { id: 'glutes', name: 'Glutes', pathGroups: { back: ['glutes'] } },
  { id: 'triceps', name: 'Triceps', pathGroups: { back: ['triceps'] } },
  { id: 'lats', name: 'Lats', pathGroups: { back: ['lats'] } },
  { id: 'lowerback', name: 'Lower back', pathGroups: { back: ['lowerback'] } },
]

const legacyIds: Record<string, string> = {
  'chest-left': 'chest', 'chest-right': 'chest',
  'shoulder-left': 'shoulders', 'shoulder-right': 'shoulders',
  'biceps-left': 'biceps', 'biceps-right': 'biceps',
  'forearms-left': 'forearms', 'forearms-right': 'forearms',
  'abs-left': 'abdominals', 'abs-right': 'abdominals',
  'quads-left': 'quads', 'quads-right': 'quads',
  'calves-left': 'calves', 'calves-right': 'calves',
  'calves-back-left': 'calves', 'calves-back-right': 'calves',
  'lats-left': 'lats', 'lats-right': 'lats',
  'triceps-left': 'triceps', 'triceps-right': 'triceps',
  'glutes-left': 'glutes', 'glutes-right': 'glutes',
  'hamstrings-left': 'hamstrings', 'hamstrings-right': 'hamstrings',
}

export const canonicalMuscleId = (id: string) => legacyIds[id] ?? id
export const muscleById = (id: string) => MUSCLES.find((muscle) => muscle.id === canonicalMuscleId(id))
