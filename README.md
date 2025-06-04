# Task. Time. Track. & Invoice System

A modern, local-first task time tracking and invoice generation application built with React, Vite, and Tailwind CSS.

## Features

### ✅ Core Functionality
- **Project Management**: Create, edit, and delete projects with hourly rates
- **Task Hierarchy**: Organize tasks with subtasks in a tree structure
- **Task Completion**: Modern checkboxes with completion status and strike-through styling
- **Task Archiving**: Archive completed parent tasks to keep workspace organized
- **Real-Time Tracking**: Live timer display with seconds precision for active tasks
- **Time Tracking**: Start, pause, and stop timers with one-active-at-a-time enforcement
- **Metrics Dashboard**: View time and earnings for today, week, month, and year
- **Advanced Invoice Generation**: Generate PDF invoices with editable time entries and client details
- **Invoice Storage**: Store and preview previously generated invoices within each project
- **Data Persistence**: All data stored locally in browser's localStorage with complete state preservation
- **Export/Import**: Backup and restore data as JSON files with full feature support

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
   - Active tasks show real-time timer with seconds precision
   - Use pause (⏸️) to pause or stop (⏹️) to finish

4. **Manage Task Completion**
   - Check the checkbox next to tasks to mark them as completed
   - Completed tasks show strike-through styling
   - Completed tasks cannot be edited or timed
   - Use completion status to track project progress

5. **Archive Tasks**
   - Archive parent tasks to keep your workspace organized
   - Archived tasks appear in a collapsible "Archived Tasks" section
   - Unarchive tasks when needed to return them to active status

6. **Generate Advanced Invoices**
   - Navigate to the invoice section at the bottom of each project
   - Edit time entries before generating the invoice for accurate billing
   - Store generated invoices and preview them anytime
   - Modify client details and customize invoice appearance

### Features Overview

## New in Version 2.0 🎉

### Task Completion System
- **Modern Checkboxes**: Clean, intuitive checkboxes for all tasks and subtasks
- **Visual Feedback**: Completed tasks display with strike-through text styling
- **Smart Restrictions**: Completed tasks cannot be edited, renamed, or timed
- **Completion Persistence**: Task completion status is saved and exported

### Real-Time Timer Display
- **Seconds Precision**: All time displays now include seconds (HH:MM:SS format)
- **Live Updates**: Active timers update every second for accurate tracking
- **Enhanced Visibility**: Real-time counter appears next to active tasks
- **Consistent Formatting**: Unified time display across all components

### Task Archive System
- **Archive Functionality**: Archive parent tasks to declutter your workspace
- **Dedicated Section**: Archived tasks appear in collapsible "Archived Tasks" section
- **Easy Management**: Unarchive tasks when needed to return them to active status
- **Organized Workflow**: Keep completed projects organized without deletion

### Advanced Invoice Generation
- **Editable Time Entries**: Modify time for each task during invoice creation
- **Time Rounding**: Round hours as needed for cleaner billing (affects only invoice)
- **Invoice Storage**: Generated invoices are stored within each project
- **Invoice History**: Preview and manage previously generated invoices
- **Enhanced UI**: Improved invoice interface with better organization

### Complete State Preservation
- **Full Export/Import**: All new features included in backup files
- **Data Migration**: Automatic upgrade from older versions
- **Version Compatibility**: Seamless transition between data formats
- **State Integrity**: Task completion, archive status, and invoices preserved

#### Project Management
- **Create Projects**: Set title, hourly rate, and currency
- **Edit Projects**: Update details anytime
- **Delete Projects**: Remove projects (with confirmation)
- **Project Dashboard**: Central view for each project

#### Task Organization
- **Hierarchical Structure**: Create parent tasks and subtasks
- **Task Completion**: Modern checkboxes for marking tasks as completed
- **Strike-through Styling**: Visual indication of completed tasks with disabled editing
- **Task Archiving**: Archive parent tasks to keep active workspace clean
- **Archived Tasks Section**: Collapsible section at bottom of projects for archived tasks
- **Task Editing**: Rename and reorganize tasks (disabled when completed)
- **Task Deletion**: Remove tasks and their subtasks (with restrictions for completed tasks)
- **Visual Hierarchy**: Indented subtasks for clear structure

#### Time Tracking
- **One Active Timer**: Ensures focused time tracking
- **Real-Time Display**: Live timer counter with seconds precision for active tasks
- **Visual Feedback**: Dimmed inactive tasks during active timing
- **Seconds Precision**: All time displays include seconds for accurate tracking
- **Duration Display**: Real-time timer updates with hours:minutes:seconds format
- **Time History**: All time entries are preserved with completion and archive status
- **Smart Controls**: Completed tasks cannot be timed, archived tasks are separated

#### Metrics & Reporting
- **Time Periods**: Today, This Week, This Month, This Year
- **Duration Tracking**: Total time per period
- **Earnings Calculation**: Time × hourly rate
- **Project Breakdown**: Metrics per project

#### Invoice Generation
- **Advanced Time Editing**: Modify time entries before generating invoices for rounding
- **Client Information**: Collect and store client details
- **Project Selection**: Choose projects to include with editable hours
- **PDF Export**: Generate professional invoices with customizable time entries
- **Invoice Storage**: Store generated invoices within each project
- **Invoice History**: Preview and manage previously generated invoices
- **Collapsible Interface**: Organized invoice section at bottom of project dashboard
- **Time Modification**: Edit hours per task during invoice creation (affects only invoice output)

#### Data Management
- **Automatic Saving**: All changes saved instantly with complete state preservation
- **Export Data**: Download complete backup as JSON with new features included
- **Import Data**: Restore from JSON backup with automatic data migration
- **State Preservation**: Task completion, archive status, and invoice history maintained
- **Data Validation**: Import validation and error handling with version compatibility
- **Migration Support**: Automatic upgrade from older data formats to version 2.0

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

- **Projects**: Stored with tasks, time entries, and invoice history
- **Task State**: Completion status and archive state for all tasks
- **Invoice History**: Generated invoices stored within each project
- **Time Tracking**: Enhanced time entries with seconds precision
- **Settings**: User preferences and configurations
- **Backup**: Export/import functionality for complete data portability

**Data Structure Version 2.0**: The application now stores additional state information including:
- Task completion status (`completed: boolean`)
- Task archive status (`archived: boolean`) 
- Project invoice history (`invoices: array`)
- Enhanced time tracking with seconds precision

**Note**: Data is stored locally in your browser. Clearing browser data will remove all projects and time entries. Regular exports are recommended. The application automatically migrates data from previous versions.

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

5. **Timer display issues**
   - Check browser performance and available memory
   - Close other resource-intensive tabs
   - Refresh the application if timers appear frozen

6. **Data migration problems**
   - Export your data before importing new files
   - Check that imported JSON files are valid
   - Contact support if migration fails repeatedly

### Performance Tips

- **Large datasets**: Export and archive old projects periodically using the archive feature
- **Browser memory**: Restart browser if app becomes slow, especially with many active timers
- **Regular backups**: Export data weekly or monthly to preserve all new features
- **Task management**: Use the archive feature to organize completed tasks
- **Invoice storage**: Older invoices are stored locally; export them periodically if needed

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
