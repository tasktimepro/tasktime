# Task Time Tracker & Invoice System

A modern, local-first task time tracking and invoice generation application built with React, Vite, and Tailwind CSS.

## Features

### ✅ Core Functionality
- **Project Management**: Create, edit, and delete projects with hourly rates
- **Task Hierarchy**: Organize tasks with subtasks in a tree structure
- **Time Tracking**: Start, pause, and stop timers with one-active-at-a-time enforcement
- **Metrics Dashboard**: View time and earnings for today, week, month, and year
- **Invoice Generation**: Generate PDF invoices with client details
- **Data Persistence**: All data stored locally in browser's localStorage
- **Export/Import**: Backup and restore data as JSON files

### 🎨 User Interface
- **Modern Design**: Clean, intuitive interface with Tailwind CSS
- **Responsive Layout**: Works on desktop and mobile devices
- **Visual Feedback**: Dimmed tasks when other timers are active
- **Modal Dialogs**: Streamlined forms for project and invoice creation
- **Icon Integration**: Heroicons for consistent visual elements

### 🔧 Technical Features
- **Local-First**: No backend required, works offline
- **React Hooks**: Modern React patterns with custom hooks
- **State Management**: Efficient local state with localStorage persistence
- **Date Handling**: Comprehensive date utilities with date-fns
- **PDF Generation**: Client-side PDF creation with html2pdf.js
- **UUID Generation**: Unique identifiers for all entities

## Installation

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn package manager

### Setup Steps

1. **Clone or download the project files**
   ```bash
   # If using git
   git clone <repository-url>
   cd tasktime
   
   # Or extract downloaded files to a folder named 'tasktime'
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open the application**
   - Navigate to `http://localhost:5173/` in your browser
   - The application will automatically reload when you make changes

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## Usage Guide

### Getting Started

1. **Create Your First Project**
   - Click "New Project" on the main screen
   - Enter project title, hourly rate, and currency
   - Save to create the project

2. **Add Tasks**
   - Select a project to open the dashboard
   - Click "Add Task" to create a new task
   - Enter task name and optionally set it as a subtask of another task

3. **Track Time**
   - Click the play button (▶️) to start timing a task
   - Only one timer can run at a time
   - Other tasks will be dimmed while a timer is active
   - Use pause (⏸️) to pause or stop (⏹️) to finish

### Features Overview

#### Project Management
- **Create Projects**: Set title, hourly rate, and currency
- **Edit Projects**: Update details anytime
- **Delete Projects**: Remove projects (with confirmation)
- **Project Dashboard**: Central view for each project

#### Task Organization
- **Hierarchical Structure**: Create parent tasks and subtasks
- **Task Editing**: Rename and reorganize tasks
- **Task Deletion**: Remove tasks and their subtasks
- **Visual Hierarchy**: Indented subtasks for clear structure

#### Time Tracking
- **One Active Timer**: Ensures focused time tracking
- **Visual Feedback**: Dimmed inactive tasks
- **Duration Display**: Real-time timer updates
- **Time History**: All time entries are preserved

#### Metrics & Reporting
- **Time Periods**: Today, This Week, This Month, This Year
- **Duration Tracking**: Total time per period
- **Earnings Calculation**: Time × hourly rate
- **Project Breakdown**: Metrics per project

#### Invoice Generation
- **Client Information**: Collect client details
- **Project Selection**: Choose projects to include
- **PDF Export**: Generate professional invoices
- **Customizable**: Add notes and adjust details

#### Data Management
- **Automatic Saving**: All changes saved instantly
- **Export Data**: Download complete backup as JSON
- **Import Data**: Restore from JSON backup
- **Data Validation**: Import validation and error handling

## Project Structure

```
tasktime/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── ProjectList.jsx        # Project management
│   │   ├── ProjectDashboard.jsx   # Main project view
│   │   ├── TaskTree.jsx           # Task hierarchy
│   │   ├── TaskItem.jsx           # Individual task
│   │   ├── TimerControls.jsx      # Timer functionality
│   │   ├── MetricsDisplay.jsx     # Time/earnings metrics
│   │   ├── InvoiceGenerator.jsx   # PDF invoice creation
│   │   └── ExportImport.jsx       # Data backup/restore
│   ├── hooks/              # Custom React hooks
│   │   └── useLocalStorage.js     # localStorage hook
│   ├── utils/              # Utility functions
│   │   ├── idUtils.js             # UUID generation
│   │   ├── dateUtils.js           # Date/time utilities
│   │   └── pdfUtils.js            # PDF generation
│   ├── App.jsx             # Main application component
│   ├── main.jsx            # Application entry point
│   └── index.css           # Global styles (Tailwind)
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── vite.config.js          # Vite configuration
└── README.md               # This file
```

## Dependencies

### Core Dependencies
- **react** (^18.3.1): UI library
- **react-dom** (^18.3.1): React DOM rendering
- **@heroicons/react** (^2.2.0): Icon library
- **date-fns** (^4.1.0): Date manipulation utilities
- **html2pdf.js** (^0.10.2): PDF generation
- **uuid** (^11.0.3): Unique identifier generation

### Development Dependencies
- **vite** (^6.0.5): Build tool and dev server
- **@vitejs/plugin-react** (^4.3.4): React support for Vite
- **tailwindcss** (^3.4.17): CSS framework
- **postcss** (^8.5.2): CSS processing
- **autoprefixer** (^10.4.20): CSS autoprefixing

## Browser Compatibility

- Chrome/Chromium 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## Data Storage

The application uses browser's `localStorage` to persist all data:

- **Projects**: Stored with tasks and time entries
- **Settings**: User preferences and configurations
- **Backup**: Export/import functionality for data portability

**Note**: Data is stored locally in your browser. Clearing browser data will remove all projects and time entries. Regular exports are recommended.

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Ensure Node.js is installed (version 16+)
   - Run `npm install` to install dependencies
   - Check for port conflicts (default: 5173)

2. **Data not persisting**
   - Check if localStorage is enabled in browser
   - Ensure not in private/incognito mode
   - Try clearing browser cache and restarting

3. **PDF generation fails**
   - Ensure browser supports modern JavaScript features
   - Check console for specific errors
   - Try different browser if issues persist

4. **Styling issues**
   - Ensure Tailwind CSS is properly built
   - Run `npm run build` to regenerate styles
   - Clear browser cache

### Performance Tips

- **Large datasets**: Export and archive old projects periodically
- **Browser memory**: Restart browser if app becomes slow
- **Regular backups**: Export data weekly or monthly

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For questions, issues, or feature requests:
1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed description
4. Include browser version and steps to reproduce

---

**Built with ❤️ using React, Vite, and Tailwind CSS**
