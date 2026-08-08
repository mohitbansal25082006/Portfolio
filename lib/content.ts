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
    year: '2026',
    category: 'ai',

    theme: 'project-deepdive',

    short:
      'Autonomous deep-research AI that searches, analyzes, verifies, and transforms complex queries into structured reports, podcasts, presentations, and debates.',

    problem:
      'Research is time-consuming and fragmented across search, analysis, fact-checking, writing, and content creation. DeepDive AI automates the entire research workflow through a multi-agent AI system.',

    features: [
      'Autonomous Multi-Agent Research',
      'Deep Web Search & Source Trust Scoring',
      'AI Research Reports',
      'RAG-Powered Research Assistant',
      'Personal AI Knowledge Base',
      'AI Academic Papers',
      'AI Podcasts & Voice Debates',
      'AI Presentation Generation',
      'Knowledge Graphs & Infographics',
      'Real-Time Team Workspaces',
      'Realtime Team Chat',
      'Offline Research & Export',
      'Social Research Feed',
      'Razorpay Credit System',
      'Google & GitHub OAuth',
    ],

    stack: [
      'React Native',
      'Expo',
      'TypeScript',
      'Supabase',
      'PostgreSQL',
      'pgvector',
      'OpenAI',
      'Tavily',
      'Stream Chat',
      'Next.js',
      'Razorpay',
    ],

    challenges:
      'Designing and coordinating a large multi-agent AI pipeline while supporting streaming responses, RAG, real-time collaboration, offline caching, cross-device media, and reliable AI-generated exports.',

    metrics:
      '58+ development parts · 500+ files · 58+ database migrations',

    live: 'deepdive.website',
    github: 'https://github.com/mohitbansal25082006/deepdive-app',
    caseStudy: '#',

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
    number: '02', name: 'MannSahay', mark: 'M', year: '2024', category: 'ai',
    theme: 'project-deepdive',
    short: 'Conversational research companion that turns long documents into dialogue.',
    problem: 'Long-form documents are slow to navigate and easy to abandon.',
    features: ['RAG Pipeline', 'Vector Search', 'Citations', 'Chat History', 'Source Upload'],
    stack: ['LangChain', 'OpenAI', 'Pinecone', 'Next.js', 'Node.js'],
    challenges: 'Keeping retrieval accurate across large document sets.',
    metrics: '10k+ docs processed',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2065&auto=format&fit=crop',
    ],
  },
  {
    number: '03', name: 'NeuraFusion', mark: 'N', year: '2024', category: 'ai',
    theme: 'project-neurafusion',
    short: 'Multi-modal AI playground blending text, image, and audio generation.',
    problem: 'Creators juggle too many disconnected AI tools.',
    features: ['Text-to-Image', 'Voice Synthesis', 'Prompt Library', 'Real-time Preview'],
    stack: ['React', 'Gemini', 'WebSockets', 'Supabase'],
    challenges: 'Orchestrating concurrent model streams.',
    metrics: '1.2k generations / week',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2074&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?q=80&w=2072&auto=format&fit=crop',
    ],
  },
  {
    number: '04', name: 'TeamScript', mark: 'T', year: '2023', category: 'web',
    theme: 'project-teamscript',
    short: 'Real-time collaborative code editor with AI pair-programming baked in.',
    problem: 'Remote teams need shared, context-aware coding.',
    features: ['Live Cursors', 'Shared Editing', 'AI Suggestions', 'Version History'],
    stack: ['Next.js', 'WebSockets', 'Yjs', 'OpenAI', 'PostgreSQL'],
    challenges: 'CRDT conflict resolution under high concurrency.',
    metrics: '20+ teams onboarded',
    live: '#', github: '#', caseStudy: '#',
    images: [
      'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2070&auto=format&fit=crop',
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