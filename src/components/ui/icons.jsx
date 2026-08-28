/**
 * Icon abstraction layer
 * Centralizes all icon imports for easy library swapping
 * Currently using: lucide-react
 */
import { useId } from "react";

/**
 * Official Google Drive product mark, current since May 2026.
 */
export function GoogleDriveBrandIcon({ className, ...props }) {
    const idPrefix = useId().replace(/:/g, "");
    const maskId = `${idPrefix}-google-drive-mask`;
    const yellowGradientId = `${idPrefix}-google-drive-yellow`;
    const blueGradientId = `${idPrefix}-google-drive-blue`;
    const greenGradientId = `${idPrefix}-google-drive-green`;

    return (
        <svg
            viewBox="0 0 800 741.3696"
            fill="none"
            className={className}
            data-provider-icon="google-drive"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <mask id={maskId} width="168" height="154" x="12" y="18" maskUnits="userSpaceOnUse">
                <path fill="#fff" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001Z" />
            </mask>
            <g mask={`url(#${maskId})`} transform="matrix(4.8140532,0,0,4.8140532,-62.146701,-86.652356)">
                <path fill={`url(#${yellowGradientId})`} d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578Z" />
                <path fill={`url(#${blueGradientId})`} d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001Z" />
                <path fill={`url(#${greenGradientId})`} d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048Z" />
            </g>
            <defs>
                <linearGradient id={yellowGradientId} x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
                    <stop offset=".09" stopColor="#ffe921" />
                    <stop offset="1" stopColor="#fec700" />
                </linearGradient>
                <linearGradient id={blueGradientId} x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
                    <stop offset=".15" stopColor="#a9a8ff" />
                    <stop offset=".33" stopColor="#6d97ff" />
                    <stop offset=".48" stopColor="#3186ff" />
                </linearGradient>
                <linearGradient id={greenGradientId} x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
                    <stop offset=".55" stopColor="#0ebc5f" />
                    <stop offset=".85" stopColor="#78c9ff" />
                </linearGradient>
            </defs>
        </svg>
    );
}

/**
 * Official Dropbox glyph from the provider's approved 2017 logo artwork.
 */
export function DropboxBrandIcon({ className, ...props }) {
    return (
        <svg
            viewBox="0 0 232 197"
            fill="none"
            className={className}
            data-provider-icon="dropbox"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <path
                fill="#0061FF"
                d="M116 37 58 74l58 37-58 37-58-37.2 58-37L0 37 58 0l58 37Zm-.3 85.9 58 37-58 37-58-37 58-37Zm.3-12.1 58-37L116 37l57.7-37 58 37-58 37 58 37-58 37-57.7-37.2Z"
            />
        </svg>
    );
}

export {
    AlertCircle as ExclamationCircleIcon,
    AlertTriangle as ExclamationTriangleIcon,
    Archive as ArchiveBoxIcon,
    ArchiveRestore as ArchiveRestoreIcon,
    ArrowLeft as ArrowLeftIcon,
    ArrowUpDown as SortIcon,
    BarChart3 as ChartBarIcon,
    Banknote as BanknotesIcon,
    Bot as BotIcon,
    Building2 as BuildingOfficeIcon,
    CalendarDays as CalendarDaysIcon,
    Check as CheckIcon,
    CheckSquare as CheckSquareIcon,
    Cloud as CloudIcon,
    CloudBackup as CloudBackupIcon,
    CloudCheck as CloudCheckIcon,
    CloudDownload as CloudDownloadIcon,
    CloudOff as CloudOffIcon,
    CloudUpload as CloudUploadIcon,
    CloudSync as CloudSyncIcon,
    CloudCog as CloudCogIcon,
    ChevronDown as ChevronDownIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    ChevronUp as ChevronUpIcon,
    ClipboardCheck as ClipboardDocumentCheckIcon,
    Clock as ClockIcon,
    CornerDownRight as CornerDownRightIcon,
    Copy as DocumentDuplicateIcon,
    CreditCard as CreditCardIcon,
    DollarSign as CurrencyDollarIcon,
    Eye as EyeIcon,
    EyeOff as EyeOffIcon,
    FileCheck as DocumentCheckIcon,
    FileBraces as FileBracesIcon,
    FileText as DocumentTextIcon,
    Flag as FlagIcon,
    Folder as FolderIcon,
    FunnelX as FunnelXIcon,
    Target as GoalIcon,
    GripVertical as GripVerticalIcon,
    Info as InformationCircleIcon,
    HandCoins as HandCoinsIcon,
    Image as ImageIcon,
    Kanban as KanbanIcon,
    LayoutDashboard as LayoutDashboardIcon,
    LayoutList as LayoutListIcon,
    ListFilter as ListFilterIcon,
    Moon as MoonIcon,
    MoreHorizontal as MoreHorizontalIcon,
    Search as MagnifyingGlassIcon,
    Search as SearchIcon,
    Send as PaperAirplaneIcon,
    SlidersHorizontal as FilterIcon,
    Pause as PauseIcon,
    Pencil as PencilIcon,
    Pin as PinIcon,
    PanelLeftClose as PanelLeftCloseIcon,
    Play as PlayIcon,
    Plus as PlusIcon,
    Plug as PlugIcon,
    Unplug as UnplugIcon,
    Percent as PercentIcon,
    ReceiptText as ReceiptTextIcon,
    LogOut as SignOutIcon,
    Rocket as RocketLaunchIcon,
    RefreshCw as ArrowPathIcon,
    ListTodo as ListTodoIcon,
    Settings as CogIcon,
    Square as StopIcon,
    Sun as SunIcon,
    Sheet as SheetIcon,
    Timer as TimerIcon,
    Trash2 as TrashIcon,
    Tags as TagsIcon,
    Upload as ArrowUpTrayIcon,
    User as UserIcon,
    Users as UserGroupIcon,
    CircleUserRound as UserCircleIcon,
    WifiOff as WifiOffIcon,
    X as XMarkIcon,
    Download as ArrowDownTrayIcon,
} from "lucide-react";
