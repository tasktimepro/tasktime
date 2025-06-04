# Project Plan

- Here's a project plan I have setup for a comprehensive task time tracker & invoice system with advanced features. The application now includes task completion tracking, archiving functionality, real-time timer displays, advanced invoice generation with time modification capabilities, and complete state preservation. Please use Vite to create the app, and make sure to install all necessary npm packages that are required in the project. Please also make sure to have a nice modern UI using tailwind and if necessary from ready made components. This is a local-first project and does not require a dedicated landing page. Initially we'll just offer the service upfront, so that you can start creating and timing tasks immediately. Let's make a clean and nice looking intuitive UI/UX please. Keep in mind all the necessary functionality such as the creating of tasks & subtasks, task completion tracking, archiving system, real-time timers with seconds, advanced invoice modification, and so on. Make sure all this functionality works well.

## Project Overview
- **Project Name:** Task. Time. Track. & Invoice System
- **Version:** 2.0 (Enhanced Features)
- **Description:**  
  A local-only, comprehensive React app for managing projects with task hierarchies, completion tracking, archiving system, real-time timing with seconds precision, and advanced invoice generation with time modification capabilities. Users can export/import complete data including all new features as JSON for backup.
- **Target Audience:**  
  Freelancers and small teams who need a complete, privacy-focused task/time tracker with integrated invoicing and advanced project management features.
- **Timeline:**  
  - Enhanced MVP (task completion + archive + real-time timer): 2 weeks  
  - Advanced invoice generation with time modification: +1 week
  - Complete state preservation & data migration: +3 days  
  - UI polish & comprehensive testing: +2 days

## Technical Stack
- **Frontend:**  
  - React (via Vite)
  - Tailwind CSS (for rapid styling; no SASS required)  
  - JavaScript (ES6+)
- **Backend:**  
  - None (local-only; no server). All state is stored in `localStorage`.
- **Database:**  
  - `localStorage` JSON objects
- **Other Tools / Libraries:**  
  - [html2pdf.js](https://github.com/eKoopmans/html2pdf) (PDF generation)  
  - [uuid](https://www.npmjs.com/package/uuid) (unique IDs for tasks/projects)  
  - date-fns (lightweight date utilities for metrics)  
  - Heroicons (SVG icons for timers, buttons)

## Features & Functionality
- **Project Management**
  - Create/edit/delete projects
  - Each project has a title, hourly rate, and metadata (e.g., currency)
- **Task Tree**
  - Parent task with a single level of sub-tasks
  - Add/edit/delete tasks and subtasks
  - Modern checkboxes for task completion status
  - Strike-through styling for completed tasks
  - Archive functionality for parent tasks
  - Collapsible archived tasks section
  - Hovering over a task shows a "Start Timer" button/icon
- **Advanced Time Tracking**
  - Start / Pause / Stop controls per task
  - Real-time timer display with seconds precision (HH:MM:SS)
  - When a task's timer is running, all other tasks are shown at reduced opacity
  - Parent task time = sum of its sub-task times
  - Completed tasks cannot be timed
  - Store each time entry with: `{ taskId, startTimestamp, endTimestamp }`
- [ ] **Dashboard Metrics**  
  - For each project, display total time and earnings (time × rate) for:  
    - Today  
    - This week  
    - This month  
    - Last month  
    - This year
- **Advanced Invoice Generator**
  - Select a project → auto-fetch all time entries since last invoice date
  - Edit time entries for each task before generating invoice (for rounding)
  - Calculate total billable hours and amount with modified times
  - Store generated invoices within each project
  - Preview previously generated invoices
  - Collapsible invoice section at bottom of project dashboard
  - Populate invoice template (project info, client info fields, line items per task or aggregate)
  - Generate/download as PDF (html2pdf.js)
  - Emit a JSON record of "last billed timestamp" per project
- **Enhanced JSON Export / Import**
  - Export all projects, tasks, time entries, completion status, archive status, and invoices as `backup.json`
  - Import from `backup.json` to restore or migrate data with automatic version migration
  - Data version 2.0 support with backward compatibility
- **Modern UI / UX**
  - Clean, modern layout with Tailwind utility classes
  - Modern checkboxes with proper styling
  - Collapsible sections for better organization
  - Real-time updates and visual feedback
  - Use neutral colors, subtle hover effects, clear typography
  - No sign-up or back-end login; entirely client-side

## File Structure
```
tasktime/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ExportImport.jsx
│   │   ├── InvoiceGenerator.jsx
│   │   ├── MetricsDisplay.jsx
│   │   ├── ProjectDashboard.jsx
│   │   ├── ProjectList.jsx
│   │   ├── TaskItem.jsx
│   │   ├── TaskTree.jsx
│   │   ├── TimerControls.jsx
│   ├── hooks/
│   │   └── useLocalStorage.js
│   ├── utils/
│   │   ├── dateUtils.js
│   │   ├── idUtils.js
│   │   ├── pdfUtils.js
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── main.jsx
│   └── assets/
│       ├── react.svg
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── README.md
└── _implan.md
```

## Resources & Assets
- **Design/Mockups:**  
  - Sketches for dashboard, task tree, timer state (low-fidelity wireframes)  
  - Saved in `docs/mockups/`
- **Copy/Content:**  
  - Button labels: “Start”, “Pause”, “Stop”, “Export JSON”, “Generate Invoice”  
  - Placeholder text for client info in invoice template
- **Images/Media:**  
  - Heroicons SVG files for “timer”, “invoice”, “export”  
- **APIs/Data Sources:**  
  - None (all local). html2pdf.js CDN or npm package for PDF.

## Development Phases

### Phase 1: Planning & Setup
1. **Initialize Repo**  
   - `npx create-react-app task-time-track --template cra-template-pwa` (or Vite)  
   - Install dependencies:  
     ```bash
     npm install tailwindcss uuid html2pdf.js date-fns
     ```
2. **Tailwind Configuration**  
   - `npx tailwindcss init` → configure `tailwind.config.js` and import into `index.css`.
3. **LocalStorage Hook**  
   - Create `useLocalStorage(key, defaultValue)` to handle state persistence.

### Phase 2: Core Features (Weekend MVP)
1. **ProjectList & Project Creation**  
   - Component for listing projects, adding new project (title, rate).  
   - Persist to localStorage.
2. **TaskTree & TaskItem Components**  
   - Render project’s tasks as nested list (one level).  
   - Each task shows title, total time (if subtasks exist).  
   - On hover, display a “Start Timer” icon/button.
3. **TimerControls Hook & Component**  
   - `useTimer(taskId)` to track start/pause/stop logic.  
   - Save each time entry as `{ id, taskId, start, end }` in localStorage.  
   - While a timer is active, render other tasks at `opacity-50`.
4. **MetricsDisplay Component**  
   - Use date-fns to filter time entries by date ranges.  
   - Calculate total hours and earnings for each period (today, week, etc.).
5. **InvoiceGenerator Component**  
   - When user clicks “Generate Invoice” for a project:  
     - Read project’s `lastBilledAt` (timestamp) or default to project creation date.  
     - Gather all time entries where `start > lastBilledAt`.  
     - Sum durations by task or as a single line item.  
     - Populate an HTML template with: project info, client fields (input fields), line items, totals.  
     - Call `html2pdf()` to generate PDF.  
     - Update `lastBilledAt = now` in localStorage.
6. **ExportImport Component**  
   - “Export JSON”: stringify all data (`projects`, `tasks`, `timeEntries`, `lastBilledAt`) into a Blob, trigger download.  
   - “Import JSON”: File input → `FileReader` → parse → overwrite localStorage state.

### Phase 3: Polish & Testing
1. **UI Refinement**  
   - Ensure minimal, mobile-responsive layout.  
   - Add subtle hover/focus states with Tailwind classes.  
   - Use Tailwind Typography plugin (if needed) for invoice template styling.
2. **Edge Cases & Validation**  
   - Prevent overlapping timers (only one active at a time).  
   - Confirmation modals before deleting projects/tasks.  
   - Warn user if importing JSON will overwrite existing data.
3. **Testing**  
   - Manual test of:  
     - Creating tasks/subtasks, starting/stopping timers  
     - Viewing aggregated project metrics (today/week/month/year)  
     - Generating invoice PDF and verifying amounts  
     - Exporting & importing JSON backup  
   - Cross-browser sanity check (Chrome, Firefox, Safari).
4. **Documentation**  
   - Fill out `README.md` with setup steps, usage instructions, and “how to backup/restore.”

## Notes
- **Personal Preferences:**  
  - When providing code include line comments when it is not obvious what is happening.
  - Include an empty line under every semicolon (;) when outputting code examples (not two empty lines just one).
  - In JS code include empty lines under every opening curly brace ({).
  - When writing or editing functions, classes, methods, etc. always include documentation comment above.
  - Always use 4 space indentation for code.
- **Coding Style:**  
  - Please include as much clear JSdoc style documentation as possible, including line comments where necessary
- **Timer Logic:**  
  - Only one task timer may run at any time. Starting a new timer auto-pauses any active timer.  
  - When active, store a `currentTimer: { taskId, start }` in state; on pause/stop, push entry into `timeEntries`.  
- **Data Model (localStorage):**  
  ```jsonc
  {
    "projects": [
      {
        "id": "uuid-v4",
        "title": "Project A",
        "hourlyRate": 50,
        "currency": "USD",
        "lastBilledAt": 1622505600000
      }
    ],
    "tasks": [
      {
        "id": "uuid-v4",
        "projectId": "uuid-v4",
        "parentTaskId": null,       // or parent’s id if subtask
        "title": "Design Homepage"
      }
    ],
    "timeEntries": [
      {
        "id": "uuid-v4",
        "taskId": "uuid-v4",
        "start": 1622584800000,
        "end": 1622588400000
      }
    ]
  }

## Styling Approach

- Use Tailwind’s utility classes for spacing, typography, and layout.
- Keep color palette neutral (gray/blue accents) to avoid distraction.
- Subtle hover/focus states to enhance interactivity.
- Responsive layout for mobile usability.