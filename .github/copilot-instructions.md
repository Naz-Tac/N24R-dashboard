# AI Agent Instructions for N24R-dashboard

## Project Overview
This is a Next.js 15 admin dashboard template built with React 19, TypeScript, and Tailwind CSS v4. The project follows a component-based architecture with specific patterns for layouts, components, and themes.

## Key Architecture Patterns

### Layout Structure
- Main app layout is defined in `/src/app/layout.tsx`
- Uses two main context providers:
  - `ThemeProvider`: Manages dark/light theme (`/src/context/ThemeContext.tsx`)
  - `SidebarProvider`: Controls sidebar state (`/src/context/SidebarContext.tsx`)

### Component Organization
- UI components are organized by feature in `/src/components/`:
  - `common/`: Shared components like `ChartTab`, `ComponentCard`
  - `ui/`: Basic UI elements (alerts, avatars, badges, etc.)
  - Feature-specific components in dedicated folders (charts, ecommerce, form)

### Routing Structure
- Uses Next.js App Router with route groups:
  - `(admin)/`: Main dashboard and admin pages
  - `(full-width-pages)/`: Auth and error pages
- Each route group has its own layout.tsx

## Development Workflow

### Setup Commands
```bash
npm install  # Use --legacy-peer-deps if needed
npm run dev  # Start development server
npm run build # Build for production
npm run lint  # Run ESLint
```

### Key Dependencies
- Full Calendar (`@fullcalendar/*`) for calendar components
- JVectorMap for maps (`@react-jvectormap/core`, `@react-jvectormap/world`)
- ApexCharts for data visualization
- React DnD for drag-and-drop functionality

## Conventions and Patterns

### Component Creation
- UI components should be TypeScript functional components
- Use Tailwind utility classes for styling
- Place in appropriate feature folder under `/src/components/`
- Example pattern from `ThemeToggleButton.tsx`:
```tsx
import { useTheme } from '@/context/ThemeContext';

export const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();
  // Component implementation
};
```

### State Management
- Use React Context for global state (theme, sidebar)
- Component-level state with React hooks
- No external state management library

### Styling
- Use Tailwind classes directly in components
- Dark mode classes prefixed with `dark:`
- Utilize `tailwind-merge` for conditional classes

## Common Tasks

### Adding New Pages
1. Create new folder in appropriate route group under `/src/app/`
2. Add `page.tsx` for route implementation
3. Update layout if needed via `layout.tsx`

### Creating New Components
1. Add component in `/src/components/` under relevant feature folder
2. Use TypeScript for type safety
3. Follow existing patterns for hooks and context usage

### Implementing Data Visualization
- Use ApexCharts components from `/src/components/charts/`
- Follow patterns in existing chart components for configuration

## Integration Points
- Full Calendar for calendar views
- JVectorMap for map visualizations
- Flatpickr for date picking
- React Dropzone for file uploads