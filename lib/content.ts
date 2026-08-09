// ============================================================================
//  PORTFOLIO CONTENT — single source of truth
//  Edit everything here. Part 2 = replace placeholders with real data.
// ============================================================================

export const siteConfig = {
  name: 'Mohit Bansal',
  firstName: 'Mohit',
  lastName: 'Bansal',
  initials: 'MB',
  title: 'Full-Stack Developer · AI Engineer · Mobile Developer',
  oneLiner:
    'I build scalable full-stack applications, AI-powered products, and intelligent mobile experiences using modern web technologies and Generative AI.',
  location: 'Jaipur, India',
  availability: 'Open to Internships & Collaborations',
  resumeUrl: '/resume.pdf',
  email: 'mohitbansal25082006@gmail.com',
  established: '2023',
  social: {
    github: 'https://github.com/mohitbansal25082006',
    linkedin: 'https://www.linkedin.com/in/mohit-bansal-383440315',
    email: 'mailto:mohitbansal25082006@gmail.com',
    leetcode: 'https://leetcode.com/u/mohitbansal25082006/',
  },
}

export const navItems = [
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'GitHub', href: '#github' },
  { label: 'Timeline', href: '#timeline' },
  { label: 'Resume', href: '#resume' },
  { label: 'Contact', href: '#contact' },
]

export const about = {
  college: 'JECRC College, Jaipur',
  currentYear: '3rd Year · B.Tech CSE',

  paragraphs: [
    "I'm Mohit Bansal, a full-stack and AI developer passionate about creating intelligent software, seamless digital experiences, and products that make a real impact.",

    "My interests lie in software engineering, Generative AI, and modern application development. I enjoy building scalable web, mobile, and AI-powered products that solve real-world problems.",

    "My goal is to build innovative software that makes technology more useful and accessible."
  ],

  interests: [
  'AI Engineering',
  'Full-Stack Development',
  'Mobile Development',
  'Product Development',
],

  pillars: [
    {
      num: '01',
      label: 'Build',
      text: 'Create products that solve real problems with thoughtful design and reliable engineering.',
    },
    {
      num: '02',
      label: 'Innovate',
      text: 'Leverage AI and modern technologies to build intelligent, practical solutions.',
    },
    {
      num: '03',
      label: 'Grow',
      text: 'Keep learning, embrace challenges, and improve through every project I build.',
    },
  ],
}

export const stats = [
  { label: 'Projects Built', value: 15, suffix: '+' },
  { label: 'DSA Problems', value: 400, suffix: '+' },
  { label: 'AI Tools Explored', value: 50, suffix: '+' },
  { label: 'GitHub Contributions', value: 1000, suffix: '+' },
  { label: 'Technologies', value: 10, suffix: '+' },
  { label: 'Year Coding', value: 1, suffix: '' },
]

export const skillGroups = [
  {
    category: 'Languages',
    items: ['C++', 'JavaScript', 'TypeScript', 'Python', 'SQL'],
  },
  {
    category: 'Frontend',
    items: ['React', 'Next.js', 'HTML', 'CSS', 'Tailwind CSS', 'Shadcn UI', 'Framer Motion'],
  },
  {
    category: 'Backend',
    items: ['Node.js', 'Express', 'REST API', 'Authentication', 'OAuth'],
  },
  {
    category: 'Database',
    items: ['PostgreSQL', 'MongoDB', 'Prisma', 'Neon', 'Supabase'],
  },
  {
    category: 'AI / ML',
    items: [
      'LLM Applications', 'AI Agents', 'OpenAI', 'Claude', 'Gemini',
      'LangChain', 'RAG', 'Prompt Engineering', 'Vector DBs', 'Pinecone', 'ChromaDB',
    ],
  },
  {
    category: 'Mobile',
    items: ['React Native', 'Expo'],
  },
  {
    category: 'Tools',
    items: ['Git', 'GitHub', 'Docker', 'Postman', 'Vercel', 'Render', 'VS Code'],
  },
]

export const projectFilters = ['All', 'AI', 'Web', 'Mobile', 'Open Source']

export const projects = [
  {
    number: '01',
    name: 'DeepDive AI',
    mark: 'D',
    year: '2026',
    category: 'ai',

    theme: 'project-deepdive',

    short:
      'A full-scale autonomous research platform — a multi-agent AI system that searches, analyzes, fact-checks, and transforms any query into structured reports, podcasts, voice debates, slide decks, and academic papers, wrapped in real-time collaborative workspaces and a production credit/payments system.',

    problem:
      'Deep research is slow and fragmented — search, cross-referencing, fact-checking, writing, and turning findings into shareable formats (documents, slides, audio) are all separate manual steps. DeepDive AI collapses this entire workflow into one pipeline: a coordinated multi-agent system plans the research, searches and scores sources for trust, analyzes and verifies findings, then generates the report — and from that single report can autonomously produce a podcast, a moderated AI debate, a slide deck, or a publication-ready academic paper, all groundable in the same verified source data.',

    features: [
      'Autonomous Multi-Agent Research Pipeline (Planner → Searcher → Analyst → Fact-Checker → Reporter)',
      'Deep Web Search with Source Trust Scoring (120+ curated domains, credibility & bias tiers)',
      'Streaming AI Research Reports with Knowledge Graphs & Infographics',
      'RAG-Powered Research Assistant (7 modes) + Personal Cross-Report AI Knowledge Base',
      'AI Academic Paper Generator with full in-app editor, citation manager, and DOCX/PDF export',
      'AI Podcast Studio — multi-voice scripts, real TTS audio, video podcast mode, series & chapters',
      'AI Voice Debate Engine — 6 parallel perspective agents + moderator synthesis, cinematic audio player',
      'AI Slide Generator with a full canvas editor (drag positioning, AI rewrite tools, 22 templates)',
      'Real-Time Team Workspaces — roles/permissions, comments, presence, activity feed, shared content',
      'Full Realtime Team Chat (Stream Chat) with reactions, polls, GIFs, threads, and a RAG-powered AI bot',
      'Social Layer — follow system, public profiles, research feed, explore/discover',
      'Public Web Report Pages (SSR, SEO, embedded AI chat) on a dedicated Next.js app',
      'Admin Dashboard (Next.js) — user management, credit ledger, abuse detection, audit log',
      'Unlimited Offline Mode — full offline viewers, caching, and export for every content type',
      'Razorpay Credit & Payments System with secure token-based checkout',
      'App-Wide Theme Engine — 6 themes × light/dark/system, synced across all three apps',
      'Google & GitHub OAuth, unified push notification system, referral & analytics dashboards',
    ],

    stack: [
      'React Native',
      'Expo',
      'TypeScript',
      'Expo Router',
      'Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)',
      'pgvector',
      'OpenAI (GPT-4.1, Whisper, TTS)',
      'Tavily Search API',
      'Pexels API',
      'Stream Chat',
      'Next.js',
      'Razorpay',
      'GIPHY API',
      'Firebase Cloud Messaging',
      'react-native-reanimated',
      'pptxgenjs',
      'docx',
    ],

    challenges:
      'Coordinating a large multi-agent AI pipeline that had to support token-by-token streaming, RAG retrieval, and real-time collaboration simultaneously, without the different systems stepping on each other. Keeping generated content (reports, podcasts, debates, slides) reliably exportable and fully usable offline meant building a custom asset-caching and re-hydration layer. Real-time features (chat, presence, shared content, activity feeds) needed to stay in sync across a mobile app, an admin dashboard, and a public web app that all read from the same Supabase backend — while a credit-metered payment system had to fail fast and never silently lose a transaction.',

    metrics:
      '58+ development parts · 500+ files · 58+ database migrations · 200,000+ lines of code · 3 integrated applications (mobile app, admin dashboard, public web)',

    live: 'https://deepdive.website/',
    github: 'https://github.com/mohitbansal25082006/deepdive-app',

    images: [
      '/deepdive/deepdive1.jpeg',
      '/deepdive/deepdive2.jpeg',
      '/deepdive/deepdive3.jpeg',
      '/deepdive/deepdive4.jpeg',
      '/deepdive/deepdive5.jpeg',
      '/deepdive/deepdive6.jpeg',
      '/deepdive/deepdive7.jpeg',
      '/deepdive/deepdive8.jpeg',
      '/deepdive/deepdive9.jpeg',
      '/deepdive/deepdive10.jpeg',
      '/deepdive/deepdive11.jpeg',
      '/deepdive/deepdive12.jpeg',
      '/deepdive/deepdive13.jpeg',
      '/deepdive/deepdive14.jpeg',
      '/deepdive/deepdive15.jpeg',
      '/deepdive/deepdive16.jpeg',
      '/deepdive/deepdive17.jpeg',
      '/deepdive/deepdive18.jpeg',
      '/deepdive/deepdive19.png',
      '/deepdive/deepdive20.png',
      '/deepdive/deepdive21.png',
    ],
  },
  {
    number: '02', name: 'MannSahay', mark: 'M', year: '2025', category: 'ai',
    theme: 'project-MannSahay',
    short:
      'AI-powered digital mental health companion for Indian students — an empathetic multilingual chatbot, counselor booking, and an anonymous peer-support forum, built for Smart India Hackathon 2025.',

    problem:
      '60%+ of Indian university students report moderate-to-severe anxiety, depression, or burnout, yet fewer than 15% seek help — blocked by stigma, a 1:500 counselor-to-student ratio, and mental-health apps that are English-only and culturally Western. MannSahay closes that gap with a culturally aware, 10-language platform that pairs an empathetic AI chatbot with real counselor access and anonymous peer support, so institutions can offer proactive, data-informed care instead of reactive, stigma-limited access.',

    features: [
      'AI Mental Health Chatbot with Crisis Detection',
      '5 Indian Languages, Culturally Aware',
      'Mood Tracking & Recommendations',
      'Smart Counselor Booking & Scheduling',
      'Anonymous Peer Support Forum',
      'Multilingual Resource Library',
      'Admin Analytics Dashboard',
      'Progress Tracking & Insights',
      'Privacy-First, Zero-PII Architecture',
      'GitHub & Google OAuth',
    ],

    stack: [
      'Next.js 14',
      'React 18',
      'TypeScript',
      'Tailwind CSS',
      'shadcn/ui',
      'Neon PostgreSQL',
      'Prisma ORM',
      'NextAuth.js',
      'OpenAI GPT-4o',
      'Anthropic Claude 3 Sonnet',
      'Cloudflare R2',
      'Vercel Blob',
      'Nodemailer / Resend',
      'Google Calendar API',
    ],

    challenges:
      'Balancing AI autonomy with safety in a mental-health context — the chatbot needed real-time crisis detection and a human-in-the-loop escalation path without becoming a bottleneck or a liability. Supporting 5 Indian languages meant more than translation: responses had to stay culturally and emotionally appropriate, not just linguistically correct. The forum needed anonymous posting robust enough that even the platform couldn\'t link identity to content, while still allowing AI moderation to catch harmful posts before they spread — all on a zero-PII data model built to satisfy GDPR and India\'s DPDP Act.',

    metrics:
      'Built for Smart India Hackathon 2025 (Problem Statement SIH25092, Govt. of Jammu & Kashmir) · 5 core modules · 10 languages supported · 6-member team',

    live: 'https://mannsahay.vercel.app/',
    github: 'https://github.com/mohitbansal25082006/MannSahay',
    images: [
        '/mannsahay/mannsahay1.png',
        '/mannsahay/mannsahay2.png',
        '/mannsahay/mannsahay3.png',
        '/mannsahay/mannsahay4.png',
        '/mannsahay/mannsahay5.png',
        '/mannsahay/mannsahay6.png',
        '/mannsahay/mannsahay7.png',
        '/mannsahay/mannsahay8.png',
        '/mannsahay/mannsahay9.png',
        '/mannsahay/mannsahay10.png',
        '/mannsahay/mannsahay11.png',
    ],
  },
  {
    number: '03', name: 'NeuraFusion', mark: 'N', year: '2025', category: 'ai',
    theme: 'project-neurafusion',

    short:
      'A multimodal AI assistant that understands text, images, and audio in one interface — with 5 switchable personalities and zero-cost infrastructure using free-tier Hugging Face models.',

    problem:
      'Most AI assistants handle only one modality at a time and lock advanced features behind paid APIs, forcing users to juggle separate tools for chat, image understanding, and voice. NeuraFusion fuses text, vision, and audio reasoning into a single Gradio interface, runs entirely on free open-source models by default, and lets users switch the AI\'s personality to match the task — with an optional GPT-4o upgrade path for those who want it.',

    features: [
      'Multimodal Fusion (Text + Image + Audio)',
      '5 Switchable AI Personalities',
      'Visual Q&A with Attention Heatmaps',
      'Voice Input & Text-to-Speech',
      'Conversation Memory via LangChain',
      'Usage Analytics Dashboard',
      '4-Format Conversation Export',
      'Free-Tier Models with Optional GPT-4o',
    ],

    stack: [
      'Python',
      'Gradio',
      'Hugging Face Transformers',
      'Flan-T5',
      'BLIP-2',
      'Whisper',
      'LangChain',
      'gTTS',
      'Matplotlib',
      'OpenAI GPT-4o (optional)',
    ],

    challenges:
      'Getting five different open-source models — a text model, a vision-language model, a speech recognizer, and a fusion layer — to reason together coherently on modest free-tier hardware, without the latency or memory footprint of a single giant multimodal model. Attention heatmaps and color-distribution analysis had to run in near real time to stay useful in an interactive demo rather than becoming a batch process.',

    metrics:
      'Runs entirely on free-tier infrastructure ($0 cost) · 5 personality modes · 4 processing modalities · deployed live on Hugging Face Spaces',

    live: 'https://huggingface.co/spaces/mohitbansal25082006/NeuraFusion',
    github: 'https://github.com/mohitbansal25082006/NeuraFusion',
    images: [
        '/neurafusion/neurafusion1.png',
        '/neurafusion/neurafusion2.png',
        '/neurafusion/neurafusion3.png',
        '/neurafusion/neurafusion4.png',
        '/neurafusion/neurafusion5.png',
        '/neurafusion/neurafusion6.png',
    ],
  },
  {
    number: '04', name: 'TeamScript', mark: 'T', year: '2025', category: 'web',
    theme: 'project-teamscript',

    short:
      'A production-grade Google Docs clone — real-time collaborative rich-text editing with comments, mentions, org workspaces, and multi-format export, built on Next.js 15 and Liveblocks.',

    problem:
      'Teams need a document editor that feels as fluid and shared as Google Docs — live cursors, instant sync, threaded comments — without being locked into Google\'s ecosystem. TeamScript rebuilds that experience from scratch: a TipTap-powered rich text editor with full real-time collaboration, organization-level workspaces, and export to PDF, HTML, TXT, and JSON.',

    features: [
      'Real-Time Collaborative Editing (Liveblocks)',
      'Live Cursor Tracking',
      'Rich Text Editor (TipTap)',
      'Comments & @Mentions',
      'Notifications System',
      'Document Templates',
      'Tables, Lists & Checklists',
      'Image Uploads & Link Embedding',
      'Undo/Redo History',
      'Export to PDF, HTML, TXT, JSON',
      'Organization Workspaces & Invites',
      'Clerk Authentication',
    ],

    stack: [
      'Next.js 15',
      'React 19',
      'Convex',
      'Clerk',
      'Liveblocks',
      'TipTap',
      'Tailwind CSS',
      'Shadcn UI',
      'Vercel',
    ],

    challenges:
      'Keeping a rich-text document — tables, images, formatting, checklists — in sync across multiple simultaneous editors without corrupting structure or losing cursor context, while layering comments and mentions on top of content that could shift under a user mid-edit. Running on React 19 RC ahead of ecosystem support meant working around dependency incompatibilities across the whole stack.',

    metrics:
      'Full-stack real-time editor with 19+ shipped features across editing, collaboration, and organization management',

    live: 'https://teamscript-nine.vercel.app/',
    github: 'https://github.com/mohitbansal25082006/teamscript',
    images: [
      '/teamscript/teamscript1.png',
      '/teamscript/teamscript2.png',
      '/teamscript/teamscript3.png', 
    ],
  },
  {
    number: '05', name: 'AI Image Editor', mark: 'I', year: '2023', category: 'web',
    theme: 'project-imageeditor',
    short: 'Browser-based image editor with generative fill and style transfer.',
    problem: 'Pro photo tools are heavy and expensive.',
    features: ['Generative Fill', 'Style Transfer', 'Layer System', 'Export Presets'],
    stack: ['React', 'Canvas API', 'Gemini', 'Tailwind'],
    challenges: 'Real-time canvas compositing without jank.',
    metrics: '8k+ images edited',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1505739679850-7a3a3024d44b?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=2070&auto=format&fit=crop',
    ],
  },
  {
    number: '06', name: 'Stream Chat App', mark: 'S', year: '2023', category: 'web',
    theme: 'project-streamchat',
    short: 'Low-latency chat platform with channels, threads, and presence.',
    problem: 'Communities need a fast, familiar chat experience.',
    features: ['Real-time Messaging', 'Threads', 'Presence', 'File Sharing', 'Notifications'],
    stack: ['Next.js', 'Socket.io', 'MongoDB', 'Redis'],
    challenges: 'Scaling WebSocket connections under load.',
    metrics: '5k messages / day',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2070&auto=format&fit=crop',
    ],
  },
  {
    number: '07', name: 'Medical Chatbot', mark: 'M', year: '2023', category: 'ai',
    theme: 'project-medical',
    short: 'Symptom-aware assistant that triages common medical queries responsibly.',
    problem: 'Reliable first-line medical info is hard to access.',
    features: ['Symptom Triage', 'RAG over Medical Corpus', 'Disclaimers', 'Voice Input'],
    stack: ['Python', 'LangChain', 'ChromaDB', 'FastAPI'],
    challenges: 'Balancing helpfulness with safety guardrails.',
    metrics: '2k+ consultations',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=2070&auto=format&fit=crop',
    ],
  },
  {
    number: '08', name: 'Semantic Book Recommender', mark: 'B', year: '2023', category: 'ai',
    theme: 'project-bookrec',
    short: 'Find your next read by meaning, not just keyword matches.',
    problem: 'Keyword search misses the vibe of a book.',
    features: ['Semantic Search', 'Embedding Index', 'Taste Profile', 'Reading List'],
    stack: ['Next.js', 'OpenAI', 'Pinecone', 'PostgreSQL'],
    challenges: 'Tuning retrieval for serendipity vs accuracy.',
    metrics: '15k recommendations',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=2070&auto=format&fit=crop',
    ],
  },
]

export const techStack = [
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'React Native',
  'Expo',

  'Node.js',
  'Express',
  'Python',

  'PostgreSQL',
  'MongoDB',
  'Prisma',
  'Supabase',

  'Tailwind CSS',
  'Shadcn UI',
  'Framer Motion',

  'OpenAI',
  'Claude',
  'Gemini',
  'LangChain',
  'AI Agents',
  'LLM Applications',
  'RAG',
  'Prompt Engineering',

  'OAuth',
  'REST APIs',
  'Docker',
  'Git',
  'GitHub',
  'Vercel',
]

export const timeline = [
  {
    year: '2024',
    title: 'Started B.Tech',
    subtitle: 'B.Tech in Computer Science at JECRC University, Jaipur',
  },
  {
    year: '2024',
    title: 'Mastered C++ & DSA',
    subtitle: 'Built a strong foundation in problem-solving and software development',
  },
  {
    year: '2025',
    title: 'Started Web Development',
    subtitle: 'Learned modern frontend and backend development with React, Next.js, and Node.js',
  },
  {
    year: '2025',
    title: 'Built TeamScript',
    subtitle: 'Production-grade Google Docs clone with real-time collaboration and AI features',
  },
  {
    year: '2025',
    title: 'Explored Generative AI',
    subtitle: 'Built LLM applications using OpenAI, LangChain, RAG, and AI Agents',
  },
  {
    year: '2025',
    title: 'Built MannSahay',
    subtitle: 'AI-powered mental health companion for Indian students with multilingual support, counselor booking, and peer communities',
  },
  {
    year: '2026',
    title: 'Built NeuraFusion',
    subtitle: 'Multimodal AI assistant supporting text, image, and audio with intelligent conversations and visual understanding',
  },
  {
    year: '2026',
    title: 'Built DeepDive AI',
    subtitle: 'Mobile AI research assistant that autonomously researches, analyzes, verifies, and generates structured reports',
  },
  {
    year: 'Future',
    title: 'Software Engineer',
    subtitle: 'Building AI-powered products that improve the lives of millions',
  },
]

// ============================================================================
//  GitHub — LIVE DATA CONFIG
//  The GitHub section (components/github-section.tsx) fetches real-time
//  profile, contribution, language, pinned-repo, and activity data straight
//  from the GitHub GraphQL + REST APIs via app/api/github/route.ts and
//  lib/github.ts. Nothing below is mock data — this is just the username
//  used to query the API. See GITHUB_INTEGRATION_GUIDE.md for full setup.
// ============================================================================
export const githubConfig = {
  username: 'mohitbansal25082006',
}

export const themes = [
  { id: 'midnight', name: 'Midnight', swatch: 'oklch(0.86 0.22 115)' },
  { id: 'cyberpunk', name: 'Cyberpunk', swatch: 'oklch(0.78 0.3 320)' },
  { id: 'glass', name: 'Glass', swatch: 'oklch(0.82 0.1 240)' },
  { id: 'minimal', name: 'Minimal', swatch: 'oklch(0.97 0.005 100)' },
  { id: 'neon', name: 'Neon', swatch: 'oklch(0.85 0.32 180)' },
  { id: 'ocean', name: 'Ocean', swatch: 'oklch(0.75 0.18 220)' },
]

export const contactInfo = {
  email: 'mohitbansal25082006@gmail.com',
  location: 'Jaipur, India',
  availability: 'Open to internships & freelance',
}