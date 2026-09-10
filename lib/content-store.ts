/**
 * lib/content-store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management Store
 * Part 2.10 — Added version history integration with single version creation
 * Part 3 — Updated with image metadata tracking and flexible URL validation
 * Part 3.1 — Extended to cover FULL portfolio
 * Part 3.2 — Added category management helpers, tech stack normalization
 * Part 3.5 — Full Tech Stack CRUD helpers + always-on normalization
 *           Pure helpers are now re-exported from lib/content-helpers.ts so
 *           client components can import them without pulling in `fs`.
 * ---------------------------------------------------------------------------
 * SERVER-ONLY FILE — must NOT be imported from client components.
 * Client-safe helpers live in lib/content-helpers.ts.
 *
 * Dual-backend storage for dynamic content that the admin can edit.
 * Covers: projects, timeline, about, skills, hero, stats, techStack, filters
 *
 * Storage backends:
 *   • Production: Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN)
 *   • Local dev:  .data/portfolio-content.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { promises as fs } from 'fs'
import path from 'path'

// Re-export the pure helpers so server-side callers keep a single import path.
// Client components MUST import from '@/lib/content-helpers' directly.
export {
  normalizeTechStack,
  addTechStackItem,
  removeTechStackItem,
  updateTechStackItem,
  moveTechStackItem,
  getTechStackStats,
  getAllCategories,
  addCategoryToProject,
  removeCategoryFromProject,
  updateCategoryInProject,
  getAllImageUrls,
  isValidImageUrl,
  sanitizeProjectImages,
  sanitizeAllProjectImages,
  addImageToProject,
  removeImageFromProject,
  moveImageInProject,
  getImageStats,
  getExternalImageUrls,
  getLocalImagePaths,
  getImagesForProject,
  projectHasImages,
} from '@/lib/content-helpers'

// Re-export the types too, so existing imports of these types from
// '@/lib/content-store' keep working. (Types are erased at build time and
// cause no runtime dependency on this server-only module.)
export type {
  ProjectImage,
  ProjectContent,
  AboutPillar,
  AboutContent,
  SkillGroup,
  TimelineEntry,
  HeroContent,
  StatItem,
  NavItem,
  ContentStore,
} from '@/lib/content-helpers'

// Internal imports used by the code below.
import {
  normalizeTechStack,
  type ContentStore,
  type ProjectContent,
  type AboutContent,
  type SkillGroup,
  type TimelineEntry,
  type HeroContent,
  type StatItem,
  type NavItem,
} from '@/lib/content-helpers'

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
    techStack: normalizeTechStack(JSON.parse(JSON.stringify(techStack))),
    projectFilters: JSON.parse(JSON.stringify(projectFilters)),
    navItems: JSON.parse(JSON.stringify(navItems)),
    updatedAt: new Date(0).toISOString(),
  }
}

/**
 * Normalize a content store to ensure all fields exist.
 * Handles migration from older stored versions.
 */
function normalizeContentStore(store: ContentStore): ContentStore {
  const defaults = {
    hero: {
      name: 'Mohit Bansal',
      firstName: 'Mohit',
      lastName: 'Bansal',
      initials: 'MB',
      title: 'Full-Stack Developer · AI Engineer · Mobile Developer',
      oneLiner:
        'I build scalable full-stack applications, AI-powered products, and intelligent mobile experiences.',
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
    techStack: [
      'React', 'Next.js', 'TypeScript', 'JavaScript', 'React Native', 'Expo',
      'Node.js', 'Express', 'Python',
      'PostgreSQL', 'MongoDB', 'Prisma', 'Supabase',
      'Tailwind CSS', 'Shadcn UI', 'Framer Motion',
      'OpenAI', 'Claude', 'Gemini', 'LangChain', 'AI Agents', 'LLM Applications',
      'RAG', 'Prompt Engineering',
      'OAuth', 'REST APIs', 'Docker', 'Git', 'GitHub', 'Vercel',
    ],
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

  // techStack: respect an intentionally-emptied array.
  const techStackSource = Array.isArray(store.techStack)
    ? store.techStack
    : defaults.techStack
  const normalizedTechStack = normalizeTechStack(techStackSource)

  // projectFilters
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

  // projects categories
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
    stats:
      Array.isArray(store.stats) && store.stats.length > 0
        ? store.stats
        : defaults.stats,
    techStack: normalizedTechStack,
    projectFilters: normalizedFilters,
    navItems:
      Array.isArray(store.navItems) && store.navItems.length > 0
        ? store.navItems
        : defaults.navItems,
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
  return saveContent({ techStack: normalizeTechStack(techStack) })
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