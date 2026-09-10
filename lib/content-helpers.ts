/**
 * lib/content-helpers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.5 — Client-safe content helpers
 * ---------------------------------------------------------------------------
 * Pure, dependency-free helpers shared between server and client code.
 *
 * IMPORTANT: This file MUST NOT import Node-only modules (`fs`, `path`,
 * `@upstash/redis`, etc.) and MUST NOT import from `lib/content-store.ts`
 * or `lib/content-versioning.ts`. Both of those pull in `fs`, which breaks
 * any client component that imports them.
 *
 * Keep this file limited to plain TypeScript — no side effects, no globals.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────
// These are structural, not imported from content-store.ts, so this file
// has zero runtime dependencies on server-only modules.

export interface ProjectImage {
  url: string
  caption?: string
  fileName?: string
  uploadedAt?: string
}

export interface ProjectContent {
  number: string
  name: string
  mark: string
  year: string
  categories: string[]
  theme: string
  short: string
  problem: string
  features: string[]
  stack: string[]
  challenges: string
  metrics: string
  live: string
  github: string
  images: string[]
}

export interface AboutPillar {
  num: string
  label: string
  text: string
}

export interface AboutContent {
  college: string
  currentYear: string
  paragraphs: string[]
  interests: string[]
  pillars: AboutPillar[]
}

export interface SkillGroup {
  category: string
  items: string[]
}

export interface TimelineEntry {
  year: string
  title: string
  subtitle: string
}

export interface HeroContent {
  name: string
  firstName: string
  lastName: string
  initials: string
  title: string
  oneLiner: string
  location: string
  availability: string
  established: string
}

export interface StatItem {
  label: string
  value: number
  suffix: string
}

export interface NavItem {
  label: string
  href: string
}

export interface ContentStore {
  projects: ProjectContent[]
  about: AboutContent
  skillGroups: SkillGroup[]
  timeline: TimelineEntry[]
  hero: HeroContent
  stats: StatItem[]
  techStack: string[]
  projectFilters: string[]
  navItems: NavItem[]
  updatedAt: string
  imageMetadata?: Record<string, ProjectImage>
}

// ─── Tech Stack Helpers ──────────────────────────────────────────────────

/**
 * Normalize a tech stack array:
 *  - drop non-strings
 *  - trim each entry
 *  - drop empty entries
 *  - dedupe (case-sensitive on trimmed value)
 *
 * Safe to call on the client. The server also calls this before persisting.
 */
export function normalizeTechStack(techStack: unknown): string[] {
  if (!Array.isArray(techStack)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of techStack) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/**
 * Append a new tech item (dedupe, trim).
 * Returns the original array reference if nothing changed.
 */
export function addTechStackItem(techStack: string[], item: string): string[] {
  const trimmed = item.trim()
  if (!trimmed) return techStack
  if (techStack.some(t => t.trim() === trimmed)) return techStack
  return [...techStack, trimmed]
}

/**
 * Remove a tech item by index.
 * Returns the original array reference if the index is out of range.
 */
export function removeTechStackItem(techStack: string[], index: number): string[] {
  if (index < 0 || index >= techStack.length) return techStack
  return techStack.filter((_, i) => i !== index)
}

/**
 * Update a tech item at index.
 */
export function updateTechStackItem(
  techStack: string[],
  index: number,
  value: string,
): string[] {
  if (index < 0 || index >= techStack.length) return techStack
  const next = [...techStack]
  next[index] = value
  return next
}

/**
 * Move a tech item from one index to another.
 * Returns the original array reference if nothing would change.
 */
export function moveTechStackItem(
  techStack: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex < 0 ||
    fromIndex >= techStack.length ||
    toIndex < 0 ||
    toIndex >= techStack.length ||
    fromIndex === toIndex
  ) {
    return techStack
  }
  const next = [...techStack]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

/**
 * Get tech stack stats for display.
 */
export function getTechStackStats(content: { techStack?: unknown }): {
  total: number
  unique: number
  duplicates: number
  empty: number
} {
  const raw = Array.isArray(content?.techStack) ? (content.techStack as unknown[]) : []
  const total = raw.length
  const trimmed = raw
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
  const unique = new Set(trimmed).size
  const empty = raw.filter(t => !t || typeof t !== 'string' || t.trim().length === 0).length
  return {
    total,
    unique,
    duplicates: Math.max(0, total - unique - empty),
    empty,
  }
}

// ─── Category Management Helpers ─────────────────────────────────────────

/**
 * Get all unique categories used across all projects.
 * Returns a sorted array of category strings (lowercase).
 */
export function getAllCategories(content: { projects: ProjectContent[] }): string[] {
  const categories = new Set<string>()
  for (const project of content.projects) {
    for (const cat of project.categories) {
      if (cat && cat.trim().length > 0) {
        categories.add(cat.trim().toLowerCase())
      }
    }
  }
  return Array.from(categories).sort()
}

export function addCategoryToProject(
  project: ProjectContent,
  category: string,
): ProjectContent {
  const trimmed = category.trim().toLowerCase()
  if (!trimmed) return project
  if (project.categories.includes(trimmed)) return project
  return { ...project, categories: [...project.categories, trimmed] }
}

export function removeCategoryFromProject(
  project: ProjectContent,
  index: number,
): ProjectContent {
  if (index < 0 || index >= project.categories.length) return project
  const newCategories = project.categories.filter((_, i) => i !== index)
  return { ...project, categories: newCategories }
}

export function updateCategoryInProject(
  project: ProjectContent,
  index: number,
  value: string,
): ProjectContent {
  if (index < 0 || index >= project.categories.length) return project
  const newCategories = [...project.categories]
  newCategories[index] = value.trim().toLowerCase()
  return { ...project, categories: newCategories }
}

// ─── Image Helpers ────────────────────────────────────────────────────────

export function getAllImageUrls(content: { projects: ProjectContent[] }): string[] {
  const urls = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      if (image && image.trim().length > 0) {
        urls.add(image.trim())
      }
    }
  }
  return Array.from(urls)
}

export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return url.trim().length > 0
}

export function sanitizeProjectImages(project: ProjectContent): ProjectContent {
  const validImages = project.images
    .map(img => img.trim())
    .filter(img => img.length > 0)
  return { ...project, images: validImages }
}

export function sanitizeAllProjectImages<T extends { projects: ProjectContent[] }>(
  content: T,
): T {
  const sanitizedProjects = content.projects.map(sanitizeProjectImages)
  return { ...content, projects: sanitizedProjects }
}

export function addImageToProject(
  project: ProjectContent,
  imageUrl: string,
): ProjectContent {
  const trimmedUrl = imageUrl.trim()
  if (!trimmedUrl) return project
  if (project.images.includes(trimmedUrl)) return project
  return { ...project, images: [...project.images, trimmedUrl] }
}

export function removeImageFromProject(
  project: ProjectContent,
  index: number,
): ProjectContent {
  if (index < 0 || index >= project.images.length) return project
  const newImages = project.images.filter((_, i) => i !== index)
  return { ...project, images: newImages }
}

export function moveImageInProject(
  project: ProjectContent,
  fromIndex: number,
  toIndex: number,
): ProjectContent {
  if (
    fromIndex < 0 || fromIndex >= project.images.length ||
    toIndex < 0 || toIndex >= project.images.length ||
    fromIndex === toIndex
  ) return project

  const newImages = [...project.images]
  const [moved] = newImages.splice(fromIndex, 1)
  newImages.splice(toIndex, 0, moved)
  return { ...project, images: newImages }
}

export function getImageStats(content: { projects: ProjectContent[] }): {
  totalProjects: number
  projectsWithImages: number
  projectsWithoutImages: number
  totalImages: number
  averageImagesPerProject: number
} {
  const totalProjects = content.projects.length
  const projectsWithImages = content.projects.filter(p => p.images.length > 0).length
  const projectsWithoutImages = totalProjects - projectsWithImages
  const totalImages = content.projects.reduce((sum, p) => sum + p.images.length, 0)
  const averageImagesPerProject = totalProjects > 0 ? totalImages / totalProjects : 0

  return {
    totalProjects,
    projectsWithImages,
    projectsWithoutImages,
    totalImages,
    averageImagesPerProject,
  }
}

export function getExternalImageUrls(content: { projects: ProjectContent[] }): string[] {
  const urls = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      const trimmed = image.trim()
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')
      ) {
        urls.add(trimmed)
      }
    }
  }
  return Array.from(urls)
}

export function getLocalImagePaths(content: { projects: ProjectContent[] }): string[] {
  const paths = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      const trimmed = image.trim()
      if (trimmed.startsWith('/')) paths.add(trimmed)
    }
  }
  return Array.from(paths)
}

export function getImagesForProject(
  content: { projects: ProjectContent[] },
  projectNumber: string,
): string[] {
  const project = content.projects.find(p => p.number === projectNumber)
  return project ? project.images : []
}

export function projectHasImages(
  content: { projects: ProjectContent[] },
  projectNumber: string,
): boolean {
  return getImagesForProject(content, projectNumber).length > 0
}