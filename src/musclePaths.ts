import artistSvgMarkup from './assets/muscle_paths.html?raw'
import type { BodyView, Muscle } from './muscles'

const sourceRoots = artistSvgMarkup.match(/<svg\b[\s\S]*?<\/svg>/gi) ?? []

function readPathGroups(rootMarkup: string) {
  const document = new DOMParser().parseFromString(rootMarkup, 'image/svg+xml')
  if (document.querySelector('parsererror')) throw new Error('Could not read the artist muscle SVG paths.')

  const groups: Record<string, string[]> = {}
  document.querySelectorAll('svg > g[id]').forEach((group) => {
    const id = group.getAttribute('id')
    if (!id) return
    groups[id] = Array.from(group.children)
      .filter((element) => element.localName === 'path')
      .map((path) => path.getAttribute('d') ?? '')
      .filter(Boolean)
  })
  return groups
}

// muscle_paths.html has one SVG root for each view, in front-then-back order.
const sourceGroups: Record<BodyView, Record<string, string[]>> = {
  front: readPathGroups(sourceRoots[0] ?? ''),
  back: readPathGroups(sourceRoots[1] ?? ''),
}

export function pathsForMuscle(muscle: Muscle, view: BodyView) {
  return (muscle.pathGroups[view] ?? []).flatMap((groupId) => sourceGroups[view][groupId] ?? [])
}
