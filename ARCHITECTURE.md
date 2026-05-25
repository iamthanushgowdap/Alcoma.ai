# Alcoma.ai - Architecture Overview

## 1. High-Level Architecture
Alcoma.ai is built as a modern, client-heavy React application utilizing the **Next.js 15 App Router**. The application is designed to be a fully static/local-first prototype, meaning it requires no active backend database for its core UI presentation.

All state management and data persistence are handled entirely on the client-side using **Zustand** coupled with **LocalStorage**, ensuring that when the user refreshes the page or restarts the server, their data and settings are maintained locally.

---

## 2. Technology Stack
* **Framework:** Next.js 15 (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v4
* **Animations:** Framer Motion (page transitions, micro-interactions, boot sequence)
* **Components & Icons:** ShadCN UI (conceptual foundation), Lucide React (icons)
* **Data Visualization:** Recharts (responsive charts for Analytics, HAB, Water Quality)
* **State Management:** Zustand (with LocalStorage persistence middleware)
* **Design System:** Custom Glassmorphism (CSS Variables in `globals.css`)

---

## 3. Directory Structure

```text
marine/
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js 15 App Router pages
│   │   ├── about/          # About/Team page
│   │   ├── analytics/      # Aggregated statistics and charts
│   │   ├── dashboard/      # Main command center overview
│   │   ├── detection/      # YOLOv8 Plastic Detection module simulation
│   │   ├── hab/            # Harmful Algal Bloom simulation
│   │   ├── settings/       # User preferences and system settings
│   │   ├── water-quality/  # Water quality ML classification metrics
│   │   ├── globals.css     # Global styles, Tailwind v4 imports, Glassmorphism tokens
│   │   ├── layout.tsx      # Root layout, persistent UI (Sidebar, Navbar, Particles)
│   │   └── page.tsx        # Landing/Hero page with BootSequence
│   ├── components/         # Reusable UI components
│   │   ├── BootSequence.tsx# Terminal-style cinematic intro animation
│   │   ├── GlassCard.tsx   # Reusable glassmorphism wrapper component
│   │   ├── Navbar.tsx      # Top navigation with user profile and breadcrumbs
│   │   ├── ParticlesBg.tsx # Animated background particles for depth
│   │   └── Sidebar.tsx     # Left-side persistent navigation menu
│   └── store/              # Zustand global state management
│       ├── usePredictionStore.ts # Simulates ML prediction history and logs
│       └── useSettingsStore.ts   # UI preferences (theme, animations, data simulation)
├── package.json            # Dependencies and scripts
└── tailwind.config.ts      # Tailwind configuration (if v3/legacy, otherwise v4 uses CSS)
```

---

## 4. Key Architectural Modules

### 4.1. Design System (Glassmorphism & Theming)
The aesthetic is driven by a custom CSS variable system defined in `src/app/globals.css`. It uses semi-transparent backgrounds, backdrop-blur filters, and subtle borders to achieve an "Apple VisionOS / Palantir" feel. 
* **Primary Colors:** Deep oceanic blues (`#0B1021`, `#111827`) mixed with vibrant neon accents (`#3B82F6`, `#10B981`) for alerts and metrics.
* **Component Wrapper:** `GlassCard.tsx` is the foundational layout building block used across all pages to ensure consistent styling.

### 4.2. State Management (Local-First)
We implemented two primary Zustand stores in `src/store/`:
1. **`useSettingsStore`**: Manages global UI settings like enabling/disabling the boot sequence, toggling animations, and adjusting simulation speeds. This is persisted to `localStorage` so user preferences survive reloads.
2. **`usePredictionStore`**: Acts as a mock database. It holds logs for "Plastic Detections", "Water Quality Tests", and "Algal Bloom Alerts". This allows the dashboard to feel alive and functional without needing an external PostgreSQL/MongoDB setup yet.

### 4.3. Layout & Routing
The App Router's `layout.tsx` is utilized to wrap the entire authenticated experience. 
* The `Sidebar`, `Navbar`, and `ParticlesBg` components sit at the root layout level, meaning they do not re-render when navigating between pages.
* Page content is injected into the `<main>` tag, wrapped in Framer Motion `<motion.div>` tags for smooth fade-in/slide-up page transitions.

### 4.4. The 3 Core AI Modules
1. **Plastic Detection (`/detection`)**: Simulates a YOLOv8 interface. Uses a drag-and-drop zone for imagery, and displays bounding box confidence scores (simulated) on uploaded media.
2. **Water Quality (`/water-quality`)**: Simulates ML classification of water safety. Features animated gauge charts and radar charts to display chemical compositions (pH, Turbidity, Salinity).
3. **HAB Monitoring (`/hab`)**: Simulates predictive spread of Algal Blooms using area charts and geographic coordinate mockups.

---

## 5. Future Scalability (Path to Production)
When transitioning from this frontend prototype to a full production app:
1. **Database:** Swap Zustand `usePredictionStore` with API calls to a PostgreSQL database (e.g., Supabase or Vercel Postgres).
2. **Auth:** Integrate NextAuth.js or Clerk to protect the `/dashboard` route.
3. **Real AI Integration:** Replace the simulated upload logic in `/detection` with a server action that proxies images to a Python FastAPI backend running the actual YOLOv8 inference.
