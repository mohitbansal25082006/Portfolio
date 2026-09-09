/**
 * lib/content-store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management Store
 * Part 2.10 — Added version history integration with single version creation
 * Part 3 — Updated with image metadata tracking and flexible URL validation
 * Part 3.1 — Extended to cover FULL portfolio
 * Part 3.2 — Added category management helpers, fixed techStack normalization
 * ---------------------------------------------------------------------------
 * Dual-backend storage for dynamic content that the admin can edit.
 * Now covers: projects, timeline, about, skills, hero, stats, techStack, filters
 *
 * Storage backends:
 *   • Production: Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN)
 *   • Local dev:  .data/portfolio-content.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { promises as fs } from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────

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

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_FILE = path.join(LOCAL_DIR, 'portfolio-content.json')
const REDIS_KEY = 'portfolio:content'

// ─── Backend detection ────────────────────────────────────────────────────

function hasRedis(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}

// ─── Local JSON fallback ──────────────────────────────────────────────────

async function readLocal(): Promise<ContentStore | null> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as ContentStore
    return normalizeContentStore(parsed)
  } catch {
    return null
  }
}

async function writeLocal(store: ContentStore) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(LOCAL_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Default content (imported from static lib/content.ts) ────────────────

async function getDefaultContent(): Promise<ContentStore> {
  const {
    projects,
    about,
    skillGroups,
    timeline,
    siteConfig,
    stats,
    techStack,
    projectFilters,
    navItems,
  } = await import('@/lib/content')

  return {
    projects: JSON.parse(JSON.stringify(projects)),
    about: JSON.parse(JSON.stringify(about)),
    skillGroups: JSON.parse(JSON.stringify(skillGroups)),
    timeline: JSON.parse(JSON.stringify(timeline)),
    hero: {
      name: siteConfig.name,
      firstName: siteConfig.firstName,
      lastName: siteConfig.lastName,
      initials: siteConfig.initials,
      title: siteConfig.title,
      oneLiner: siteConfig.oneLiner,
      location: siteConfig.location,
      availability: siteConfig.availability,
      established: siteConfig.established,
    },
    stats: JSON.parse(JSON.stringify(stats)),
    techStack: JSON.parse(JSON.stringify(techStack)),
    projectFilters: JSON.parse(JSON.stringify(projectFilters)),
    navItems: JSON.parse(JSON.stringify(navItems)),
    updatedAt: new Date(0).toISOString(),
  }
}

/**
 * Normalize a content store to ensure all fields exist.
 * Handles migration from older stored versions.
 * Also normalizes techStack to ensure it's always a valid array of strings.
 */
function normalizeContentStore(store: ContentStore): ContentStore {
  const defaults = {
    hero: {
      name: 'Mohit Bansal',
      firstName: 'Mohit',
      lastName: 'Bansal',
      initials: 'MB',
      title: 'Full-Stack Developer · AI Engineer · Mobile Developer',
      oneLiner: 'I build scalable full-stack applications, AI-powered products, and intelligent mobile experiences.',
      location: 'Jaipur, India',
      availability: 'Open to Internships & Collaborations',
      established: '2023',
    },
    stats: [
      { label: 'Projects Built', value: 15, suffix: '+' },
      { label: 'DSA Problems', value: 400, suffix: '+' },
      { label: 'AI Tools Explored', value: 50, suffix: '+' },
      { label: 'GitHub Contributions', value: 1000, suffix: '+' },
      { label: 'Technologies', value: 10, suffix: '+' },
      { label: 'Year Coding', value: 1, suffix: '' },
    ],
    techStack: ['React', 'Next.js', 'TypeScript', 'Node.js'],
    projectFilters: ['All', 'AI', 'Web', 'Mobile', 'Open Source'],
    navItems: [
      { label: 'Work', href: '#work' },
      { label: 'About', href: '#about' },
      { label: 'Skills', href: '#skills' },
      { label: 'GitHub', href: '#github' },
      { label: 'Timeline', href: '#timeline' },
      { label: 'Resume', href: '#resume' },
      { label: 'Contact', href: '#contact' },
    ],
  }

  // Normalize techStack: ensure it's an array of non-empty strings
  let normalizedTechStack = store.techStack
  if (!Array.isArray(normalizedTechStack)) {
    normalizedTechStack = defaults.techStack
  } else {
    // Filter out empty/invalid entries and trim
    normalizedTechStack = normalizedTechStack
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map(t => t.trim())
    // If empty after filtering, use defaults
    if (normalizedTechStack.length === 0) {
      normalizedTechStack = defaults.techStack
    }
  }

  // Normalize projectFilters
  let normalizedFilters = store.projectFilters
  if (!Array.isArray(normalizedFilters)) {
    normalizedFilters = defaults.projectFilters
  } else {
    normalizedFilters = normalizedFilters
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .map(f => f.trim())
    if (normalizedFilters.length === 0) {
      normalizedFilters = defaults.projectFilters
    }
  }

  // Normalize projects categories
  const normalizedProjects = Array.isArray(store.projects)
    ? store.projects.map(project => ({
        ...project,
        categories: Array.isArray(project.categories)
          ? project.categories
              .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
              .map(c => c.trim().toLowerCase())
          : ['web'],
        features: Array.isArray(project.features) ? project.features : [],
        stack: Array.isArray(project.stack) ? project.stack : [],
        images: Array.isArray(project.images) ? project.images : [],
      }))
    : []

  return {
    ...store,
    projects: normalizedProjects,
    about: {
      ...store.about,
      paragraphs: Array.isArray(store.about?.paragraphs) ? store.about.paragraphs : [],
      interests: Array.isArray(store.about?.interests) ? store.about.interests : [],
      pillars: Array.isArray(store.about?.pillars) ? store.about.pillars : [],
    },
    hero: store.hero || defaults.hero,
    stats: Array.isArray(store.stats) && store.stats.length > 0 ? store.stats : defaults.stats,
    techStack: normalizedTechStack,
    projectFilters: normalizedFilters,
    navItems: Array.isArray(store.navItems) && store.navItems.length > 0 ? store.navItems : defaults.navItems,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getContent(): Promise<ContentStore> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<ContentStore>(REDIS_KEY)
    if (data) return normalizeContentStore(data)
    return getDefaultContent()
  }
  const local = await readLocal()
  return local ? normalizeContentStore(local) : getDefaultContent()
}

export async function saveContentWithoutVersion(
  patch: Partial<Omit<ContentStore, 'updatedAt'>>,
): Promise<ContentStore> {
  const current = await getContent()
  const next: ContentStore = normalizeContentStore({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  })

  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, next)
  } else {
    await writeLocal(next)
  }

  return next
}

export async function saveContent(
  patch: Partial<Omit<ContentStore, 'updatedAt'>>,
): Promise<ContentStore> {
  const next = await saveContentWithoutVersion(patch)

  try {
    const { createContentVersion } = await import('@/lib/content-versioning')
    await createContentVersion('Content updated')
  } catch (err) {
    console.error('Failed to create version snapshot:', err)
  }

  return next
}

export function getContentStorageStatus() {
  return { redisConfigured: hasRedis() }
}

// ─── Convenience helpers for partial updates ──────────────────────────────

export async function updateProjects(projects: ProjectContent[]): Promise<ContentStore> {
  return saveContent({ projects })
}

export async function updateAbout(about: AboutContent): Promise<ContentStore> {
  return saveContent({ about })
}

export async function updateSkillGroups(skillGroups: SkillGroup[]): Promise<ContentStore> {
  return saveContent({ skillGroups })
}

export async function updateTimeline(timeline: TimelineEntry[]): Promise<ContentStore> {
  return saveContent({ timeline })
}

export async function updateHero(hero: HeroContent): Promise<ContentStore> {
  return saveContent({ hero })
}

export async function updateStats(stats: StatItem[]): Promise<ContentStore> {
  return saveContent({ stats })
}

export async function updateTechStack(techStack: string[]): Promise<ContentStore> {
  const normalized = techStack
    .filter(t => typeof t === 'string' && t.trim().length > 0)
    .map(t => t.trim())
  return saveContent({ techStack: normalized })
}

export async function updateProjectFilters(projectFilters: string[]): Promise<ContentStore> {
  const normalized = projectFilters
    .filter(f => typeof f === 'string' && f.trim().length > 0)
    .map(f => f.trim())
  return saveContent({ projectFilters: normalized })
}

export async function updateNavItems(navItems: NavItem[]): Promise<ContentStore> {
  return saveContent({ navItems })
}

// ─── Category Management Helpers (Part 3.2) ──────────────────────────────

/**
 * Get all unique categories used across all projects.
 * Returns a sorted array of category strings (lowercase).
 */
export function getAllCategories(content: ContentStore): string[] {
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

/**
 * Add a category to a project if not already present.
 * Returns the updated project.
 */
export function addCategoryToProject(
  project: ProjectContent,
  category: string,
): ProjectContent {
  const trimmed = category.trim().toLowerCase()
  if (!trimmed) return project
  if (project.categories.includes(trimmed)) return project
  return {
    ...project,
    categories: [...project.categories, trimmed],
  }
}

/**
 * Remove a category from a project by index.
 * Returns the updated project.
 */
export function removeCategoryFromProject(
  project: ProjectContent,
  index: number,
): ProjectContent {
  if (index < 0 || index >= project.categories.length) return project
  const newCategories = project.categories.filter((_, i) => i !== index)
  return { ...project, categories: newCategories }
}

/**
 * Update a category in a project at the given index.
 * Returns the updated project.
 */
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

// ─── Tech Stack Helpers (Part 3.2) ───────────────────────────────────────

/**
 * Validate and normalize a tech stack array.
 * Ensures all items are non-empty strings, trimmed, and deduplicated.
 */
export function normalizeTechStack(techStack: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  
  for (const tech of techStack) {
    if (typeof tech !== 'string') continue
    const trimmed = tech.trim()
    if (trimmed.length === 0) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  
  return normalized
}

/**
 * Get tech stack stats for display.
 */
export function getTechStackStats(content: ContentStore): {
  total: number
  unique: number
  duplicates: number
  empty: number
} {
  const total = content.techStack.length
  const unique = new Set(content.techStack.map(t => t.trim())).size
  const empty = content.techStack.filter(t => !t || t.trim().length === 0).length
  return {
    total,
    unique,
    duplicates: total - unique - empty,
    empty,
  }
}

// ─── Image helper functions ───────────────────────────────────────────────

export function getAllImageUrls(content: ContentStore): string[] {
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

export function sanitizeAllProjectImages(content: ContentStore): ContentStore {
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

export function getImageStats(content: ContentStore): {
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

  return { totalProjects, projectsWithImages, projectsWithoutImages, totalImages, averageImagesPerProject }
}

export function getExternalImageUrls(content: ContentStore): string[] {
  const urls = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      const trimmed = image.trim()
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        urls.add(trimmed)
      }
    }
  }
  return Array.from(urls)
}

export function getLocalImagePaths(content: ContentStore): string[] {
  const paths = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      const trimmed = image.trim()
      if (trimmed.startsWith('/')) paths.add(trimmed)
    }
  }
  return Array.from(paths)
}

export function getImagesForProject(content: ContentStore, projectNumber: string): string[] {
  const project = content.projects.find(p => p.number === projectNumber)
  return project ? project.images : []
}

export function projectHasImages(content: ContentStore, projectNumber: string): boolean {
  return getImagesForProject(content, projectNumber).length > 0
}