import type { AgentCommandContext, AgentCommandHandler, AgentCommandResponse, AgentPermissionScope } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    createDriveBackupCommand,
    deleteAllAccountDataCommand,
    downloadDriveBackupJsonCommand,
    exportBackupJsonCommand,
    getSyncStatusCommand,
    listDriveBackupsCommand,
    previewBackupImportJsonCommand,
    restoreBackupJsonCommand,
    restoreDriveBackupCommand,
    updateSyncSettingsCommand,
} from './account';
import {
    archiveProjectCommand,
    archiveTaskCommand,
    cascadeDeleteProjectCommand,
    cascadeDeleteTaskCommand,
    completeTaskCommand,
    createProjectCommand,
    createTaskCommand,
    deleteProjectCommand,
    deleteTaskCommand,
    listProjectsCommand,
    listTasksCommand,
    previewDeleteProjectCommand,
    previewDeleteTaskCommand,
    unarchiveProjectCommand,
    unarchiveTaskCommand,
    updateProjectCommand,
    updateTaskCommand,
} from './tasks';
import {
    archiveClientCommand,
    cascadeDeleteClientCommand,
    createClientCommand,
    deleteClientCommand,
    listClientsCommand,
    previewDeleteClientCommand,
    unarchiveClientCommand,
    updateClientCommand,
} from './clients';
import {
    archiveBusinessBrandAssetCommand,
    archiveExpenseCategoryCommand,
    createBusinessInfoCommand,
    createBusinessBrandAssetCommand,
    createEmailTemplateCommand,
    createExpenseCategoryCommand,
    createInvoiceTemplateCommand,
    createPaymentMethodCommand,
    deleteBusinessBrandAssetCommand,
    deleteBusinessInfoCommand,
    deleteEmailTemplateCommand,
    deleteExpenseCategoryCommand,
    deleteInvoiceTemplateCommand,
    deletePaymentMethodCommand,
    getPreferencesCommand,
    listBusinessBrandAssetsCommand,
    listBusinessInfosCommand,
    listExpenseCategoriesCommand,
    listEmailTemplatesCommand,
    listInvoiceTemplatesCommand,
    listPaymentMethodsCommand,
    setDefaultBusinessInfoCommand,
    setDefaultEmailTemplateCommand,
    setDefaultInvoiceTemplateCommand,
    setDefaultPaymentMethodCommand,
    unarchiveBusinessBrandAssetCommand,
    unarchiveExpenseCategoryCommand,
    updateBusinessBrandAssetCommand,
    updateBusinessInfoCommand,
    updateEmailTemplateCommand,
    updateExpenseCategoryCommand,
    updateInvoiceTemplateCommand,
    updatePaymentMethodCommand,
    updatePreferencesCommand,
} from './settings';
import {
    addManualTimeEntryCommand,
    clearTimerCommand,
    deleteTimeEntryCommand,
    getActiveTimersCommand,
    pauseTimerCommand,
    resumeTimerCommand,
    startTimerCommand,
    stopTimerCommand,
    updateTimerCommand,
    updateTimeEntryCommand,
} from './timers';
import {
    attachPlannerItemCommand,
    getProjectNotesCommand,
    listDailyGoalsCommand,
    listPlannerAttachmentsCommand,
    removeDailyGoalCommand,
    removePlannerAttachmentCommand,
    setDailyGoalCommand,
    updatePlannerAttachmentCommand,
    updateProjectNotesCommand,
} from './planner';
import {
    createExpenseCommand,
    createExpenseRecurrenceCommand,
    deleteExpenseCommand,
    deleteExpenseRecurrenceCommand,
    listExpensesCommand,
    listExpenseRecurrencesCommand,
    markExpensePaidCommand,
    markExpenseUnpaidCommand,
    pauseExpenseRecurrenceCommand,
    resumeExpenseRecurrenceCommand,
    updateExpenseRecurrenceCommand,
} from './expenses';
import {
    createTaxReturnPeriodCommand,
    listTaxReturnPeriodsCommand,
    markExpensesTaxClaimedCommand,
    markExpensesTaxUnclaimedCommand,
    markTaxReturnPeriodFiledCommand,
    markTaxReturnPeriodPaidCommand,
    updateTaxReturnPeriodCommand,
} from './tax';
import {
    createInvoiceDraftFromUnbilledWorkCommand,
    exportInvoicePdfCommand,
    exportProjectQuotePdfCommand,
    finalizeInvoiceCommand,
    listInvoicesCommand,
    markInvoicePaidCommand,
    markInvoiceUnpaidCommand,
    previewProjectQuoteCommand,
    previewProjectQuoteEmailCommand,
    previewInvoiceFromUnbilledWorkCommand,
    previewInvoiceEmailCommand,
    sendProjectQuoteEmailCommand,
    sendInvoiceEmailCommand,
    undoLatestInvoiceCommand,
    updateInvoiceDraftCommand,
} from './invoices';
import {
    focusRunningTimerCommand,
    openAccountViewCommand,
    openClientViewCommand,
    openDashboardViewCommand,
    openExpensesViewCommand,
    openInvoiceViewCommand,
    openPlannerViewCommand,
    openProjectViewCommand,
    openReportsViewCommand,
} from './navigation';
import {
    findUnbilledTimeCommand,
    getClientOverviewCommand,
    getDashboardSummaryCommand,
    getProjectOverviewCommand,
    listRecentEntriesCommand,
} from './queries';
import { exportAccountantPackCommand, exportReportCsvCommand, exportReportPdfCommand, getReportSummaryCommand } from './reports';

export type AgentCommandName =
    | 'list_projects'
    | 'create_project'
    | 'update_project'
    | 'archive_project'
    | 'unarchive_project'
    | 'preview_delete_project'
    | 'cascade_delete_project'
    | 'delete_project'
    | 'list_clients'
    | 'create_client'
    | 'update_client'
    | 'archive_client'
    | 'unarchive_client'
    | 'preview_delete_client'
    | 'cascade_delete_client'
    | 'delete_client'
    | 'list_business_infos'
    | 'create_business_info'
    | 'update_business_info'
    | 'set_default_business_info'
    | 'delete_business_info'
    | 'list_business_brand_assets'
    | 'create_business_brand_asset'
    | 'update_business_brand_asset'
    | 'archive_business_brand_asset'
    | 'unarchive_business_brand_asset'
    | 'delete_business_brand_asset'
    | 'list_payment_methods'
    | 'create_payment_method'
    | 'update_payment_method'
    | 'set_default_payment_method'
    | 'delete_payment_method'
    | 'list_invoice_templates'
    | 'create_invoice_template'
    | 'update_invoice_template'
    | 'set_default_invoice_template'
    | 'delete_invoice_template'
    | 'list_email_templates'
    | 'create_email_template'
    | 'update_email_template'
    | 'set_default_email_template'
    | 'delete_email_template'
    | 'list_expense_categories'
    | 'create_expense_category'
    | 'update_expense_category'
    | 'archive_expense_category'
    | 'unarchive_expense_category'
    | 'delete_expense_category'
    | 'get_preferences'
    | 'update_preferences'
    | 'list_tasks'
    | 'create_task'
    | 'update_task'
    | 'complete_task'
    | 'archive_task'
    | 'unarchive_task'
    | 'preview_delete_task'
    | 'cascade_delete_task'
    | 'delete_task'
    | 'get_active_timers'
    | 'start_timer'
    | 'pause_timer'
    | 'resume_timer'
    | 'stop_timer'
    | 'clear_timer'
    | 'update_timer'
    | 'add_manual_time_entry'
    | 'update_time_entry'
    | 'delete_time_entry'
    | 'list_planner_attachments'
    | 'attach_planner_item'
    | 'update_planner_attachment'
    | 'remove_planner_attachment'
    | 'list_daily_goals'
    | 'set_daily_goal'
    | 'remove_daily_goal'
    | 'get_project_notes'
    | 'update_project_notes'
    | 'list_expenses'
    | 'create_expense'
    | 'delete_expense'
    | 'list_expense_recurrences'
    | 'create_expense_recurrence'
    | 'update_expense_recurrence'
    | 'pause_expense_recurrence'
    | 'resume_expense_recurrence'
    | 'delete_expense_recurrence'
    | 'mark_expense_paid'
    | 'mark_expense_unpaid'
    | 'list_tax_return_periods'
    | 'create_tax_return_period'
    | 'update_tax_return_period'
    | 'mark_tax_return_period_filed'
    | 'mark_tax_return_period_paid'
    | 'mark_expenses_tax_claimed'
    | 'mark_expenses_tax_unclaimed'
    | 'list_invoices'
    | 'preview_invoice_from_unbilled_work'
    | 'create_invoice_draft'
    | 'update_invoice_draft'
    | 'finalize_invoice'
    | 'mark_invoice_paid'
    | 'mark_invoice_unpaid'
    | 'undo_latest_invoice'
    | 'export_invoice_pdf'
    | 'preview_project_quote'
    | 'export_project_quote_pdf'
    | 'preview_project_quote_email'
    | 'send_project_quote_email'
    | 'preview_invoice_email'
    | 'send_invoice_email'
    | 'get_dashboard_summary'
    | 'get_project_overview'
    | 'get_client_overview'
    | 'get_report_summary'
    | 'export_report_csv'
    | 'export_report_pdf'
    | 'export_accountant_pack'
    | 'export_backup_json'
    | 'list_drive_backups'
    | 'create_drive_backup'
    | 'download_drive_backup_json'
    | 'preview_backup_import_json'
    | 'restore_backup_json'
    | 'restore_drive_backup'
    | 'get_sync_status'
    | 'update_sync_settings'
    | 'delete_all_account_data'
    | 'find_unbilled_time'
    | 'list_recent_entries'
    | 'open_dashboard_view'
    | 'open_planner_view'
    | 'open_account_view'
    | 'open_project_view'
    | 'open_client_view'
    | 'open_invoice_view'
    | 'open_expenses_view'
    | 'open_reports_view'
    | 'focus_running_timer';

export interface AgentCommandDefinition<Input = unknown, Output = unknown> {
    name: AgentCommandName;
    description: string;
    scopes: AgentPermissionScope[];
    requiresApproval?: boolean;
    handler: AgentCommandHandler<Input, Output>;
}

type Registry = Record<AgentCommandName, AgentCommandDefinition<any, any>>;

export const AGENT_COMMAND_REGISTRY: Registry = {
    list_projects: {
        name: 'list_projects',
        description: 'List active projects visible to the current TaskTime Pro app session.',
        scopes: ['read'],
        handler: (context) => listProjectsCommand(context),
    },
    create_project: {
        name: 'create_project',
        description: 'Create a non-archived TaskTime Pro project, optionally linked to an existing preferred client.',
        scopes: ['write'],
        handler: createProjectCommand,
    },
    update_project: {
        name: 'update_project',
        description: 'Update non-destructive project fields such as title, rates, client link, notes, color, deadline, budget, and task view preferences.',
        scopes: ['write'],
        handler: updateProjectCommand,
    },
    archive_project: {
        name: 'archive_project',
        description: 'Archive an existing project without deleting tasks, entries, invoices, or synced data.',
        scopes: ['write'],
        handler: archiveProjectCommand,
    },
    unarchive_project: {
        name: 'unarchive_project',
        description: 'Restore an archived project without changing related tasks, entries, invoices, or synced data.',
        scopes: ['write'],
        handler: unarchiveProjectCommand,
    },
    preview_delete_project: {
        name: 'preview_delete_project',
        description: 'Preview the UI-style cascade impact of deleting a project without mutating data.',
        scopes: ['read'],
        handler: previewDeleteProjectCommand,
    },
    cascade_delete_project: {
        name: 'cascade_delete_project',
        description: 'Delete a project and related non-billed tasks, entries, timers, expenses, recurring templates, and planner attachments after preview matching, confirmation, and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: cascadeDeleteProjectCommand,
    },
    delete_project: {
        name: 'delete_project',
        description: 'Delete one unreferenced project after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteProjectCommand,
    },
    list_clients: {
        name: 'list_clients',
        description: 'List active clients visible to the current TaskTime Pro app session.',
        scopes: ['read'],
        handler: listClientsCommand,
    },
    create_client: {
        name: 'create_client',
        description: 'Create a non-archived TaskTime Pro client with contact, billing, tax, and notes fields.',
        scopes: ['write'],
        handler: createClientCommand,
    },
    update_client: {
        name: 'update_client',
        description: 'Update non-destructive client fields such as contact, billing, tax, notes, hourly rate, and color.',
        scopes: ['write'],
        handler: updateClientCommand,
    },
    archive_client: {
        name: 'archive_client',
        description: 'Archive an existing client without deleting projects, tasks, entries, invoices, expenses, or synced data.',
        scopes: ['write'],
        handler: archiveClientCommand,
    },
    unarchive_client: {
        name: 'unarchive_client',
        description: 'Restore an archived client without changing related projects, tasks, entries, invoices, expenses, or synced data.',
        scopes: ['write'],
        handler: unarchiveClientCommand,
    },
    preview_delete_client: {
        name: 'preview_delete_client',
        description: 'Preview the UI-style cascade impact of deleting a client without mutating data.',
        scopes: ['read'],
        handler: previewDeleteClientCommand,
    },
    cascade_delete_client: {
        name: 'cascade_delete_client',
        description: 'Delete a client and either convert linked projects to personal or delete related non-billed project data after preview matching, confirmation, and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: cascadeDeleteClientCommand,
    },
    delete_client: {
        name: 'delete_client',
        description: 'Delete one unreferenced client after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteClientCommand,
    },
    list_business_infos: {
        name: 'list_business_infos',
        description: 'List business profiles used for invoices, expenses, and tax/reporting context.',
        scopes: ['read'],
        handler: (context) => listBusinessInfosCommand(context),
    },
    create_business_info: {
        name: 'create_business_info',
        description: 'Create a business profile for invoice sender and tax details. The first profile becomes default unless specified otherwise.',
        scopes: ['write'],
        handler: createBusinessInfoCommand,
    },
    update_business_info: {
        name: 'update_business_info',
        description: 'Update a business profile without deleting invoices, expenses, or brand assets.',
        scopes: ['write'],
        handler: updateBusinessInfoCommand,
    },
    set_default_business_info: {
        name: 'set_default_business_info',
        description: 'Set the default business profile and clear default status from the others.',
        scopes: ['write'],
        handler: setDefaultBusinessInfoCommand,
    },
    delete_business_info: {
        name: 'delete_business_info',
        description: 'Delete one unreferenced business profile after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteBusinessInfoCommand,
    },
    list_business_brand_assets: {
        name: 'list_business_brand_assets',
        description: 'List business logo brand assets, optionally scoped to a business profile and including archived assets or data URLs.',
        scopes: ['read'],
        handler: listBusinessBrandAssetsCommand,
    },
    create_business_brand_asset: {
        name: 'create_business_brand_asset',
        description: 'Create a validated business logo brand asset for an existing business profile, reusing an existing matching content hash when present.',
        scopes: ['write'],
        handler: createBusinessBrandAssetCommand,
    },
    update_business_brand_asset: {
        name: 'update_business_brand_asset',
        description: 'Update a business logo brand asset without deleting invoices or business profile references.',
        scopes: ['write'],
        handler: updateBusinessBrandAssetCommand,
    },
    archive_business_brand_asset: {
        name: 'archive_business_brand_asset',
        description: 'Archive a business logo brand asset without deleting invoices or business profile references.',
        scopes: ['write'],
        handler: archiveBusinessBrandAssetCommand,
    },
    unarchive_business_brand_asset: {
        name: 'unarchive_business_brand_asset',
        description: 'Restore an archived business logo brand asset without changing invoices or business profile references.',
        scopes: ['write'],
        handler: unarchiveBusinessBrandAssetCommand,
    },
    delete_business_brand_asset: {
        name: 'delete_business_brand_asset',
        description: 'Delete one unreferenced business logo brand asset after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteBusinessBrandAssetCommand,
    },
    list_payment_methods: {
        name: 'list_payment_methods',
        description: 'List payment methods used on invoices and expenses.',
        scopes: ['read'],
        handler: (context) => listPaymentMethodsCommand(context),
    },
    create_payment_method: {
        name: 'create_payment_method',
        description: 'Create a payment method. The first method becomes default unless specified otherwise.',
        scopes: ['write'],
        handler: createPaymentMethodCommand,
    },
    update_payment_method: {
        name: 'update_payment_method',
        description: 'Update a payment method without deleting invoices or expenses that reference older snapshots.',
        scopes: ['write'],
        handler: updatePaymentMethodCommand,
    },
    set_default_payment_method: {
        name: 'set_default_payment_method',
        description: 'Set the default payment method and clear default status from the others.',
        scopes: ['write'],
        handler: setDefaultPaymentMethodCommand,
    },
    delete_payment_method: {
        name: 'delete_payment_method',
        description: 'Delete one unreferenced payment method after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deletePaymentMethodCommand,
    },
    list_invoice_templates: {
        name: 'list_invoice_templates',
        description: 'List invoice templates, including sequence and branding defaults.',
        scopes: ['read'],
        handler: (context) => listInvoiceTemplatesCommand(context),
    },
    create_invoice_template: {
        name: 'create_invoice_template',
        description: 'Create an invoice template with sequence, tax, notes, and branding defaults.',
        scopes: ['write'],
        handler: createInvoiceTemplateCommand,
    },
    update_invoice_template: {
        name: 'update_invoice_template',
        description: 'Update an invoice template. Sequence changes are allowed but should be deliberate.',
        scopes: ['write'],
        handler: updateInvoiceTemplateCommand,
    },
    set_default_invoice_template: {
        name: 'set_default_invoice_template',
        description: 'Set the default invoice template and clear default status from the others.',
        scopes: ['write'],
        handler: setDefaultInvoiceTemplateCommand,
    },
    delete_invoice_template: {
        name: 'delete_invoice_template',
        description: 'Delete one unreferenced invoice template after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteInvoiceTemplateCommand,
    },
    list_email_templates: {
        name: 'list_email_templates',
        description: 'List invoice/quote email templates, optionally filtered by template type.',
        scopes: ['read'],
        handler: listEmailTemplatesCommand,
    },
    create_email_template: {
        name: 'create_email_template',
        description: 'Create an invoice or quote email template with subject, body, reminder body, and attachment filename defaults.',
        scopes: ['write'],
        handler: createEmailTemplateCommand,
    },
    update_email_template: {
        name: 'update_email_template',
        description: 'Update an invoice or quote email template.',
        scopes: ['write'],
        handler: updateEmailTemplateCommand,
    },
    set_default_email_template: {
        name: 'set_default_email_template',
        description: 'Set the default email template for its type and clear default status from other templates of the same type.',
        scopes: ['write'],
        handler: setDefaultEmailTemplateCommand,
    },
    delete_email_template: {
        name: 'delete_email_template',
        description: 'Delete one invoice or quote email template after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteEmailTemplateCommand,
    },
    list_expense_categories: {
        name: 'list_expense_categories',
        description: 'List expense categories used by expense and recurring expense workflows.',
        scopes: ['read'],
        handler: listExpenseCategoriesCommand,
    },
    create_expense_category: {
        name: 'create_expense_category',
        description: 'Create a non-archived expense category through the validated settings collection.',
        scopes: ['write'],
        handler: createExpenseCategoryCommand,
    },
    update_expense_category: {
        name: 'update_expense_category',
        description: 'Update expense category metadata such as name, group, default flag, and archive state.',
        scopes: ['write'],
        handler: updateExpenseCategoryCommand,
    },
    archive_expense_category: {
        name: 'archive_expense_category',
        description: 'Archive an expense category without deleting expenses or recurring templates that reference it.',
        scopes: ['write'],
        handler: archiveExpenseCategoryCommand,
    },
    unarchive_expense_category: {
        name: 'unarchive_expense_category',
        description: 'Restore an archived expense category without changing related expenses or recurring templates.',
        scopes: ['write'],
        handler: unarchiveExpenseCategoryCommand,
    },
    delete_expense_category: {
        name: 'delete_expense_category',
        description: 'Delete one unreferenced expense category after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteExpenseCategoryCommand,
    },
    get_preferences: {
        name: 'get_preferences',
        description: 'Return validated TaskTime Pro user preferences. Sync/backup control state is readable, but mutation is handled by explicit sync-control commands later.',
        scopes: ['read'],
        handler: (context) => getPreferencesCommand(context),
    },
    update_preferences: {
        name: 'update_preferences',
        description: 'Update non-sync user preferences such as currency, theme, date/time format, default view, week start, task visibility, default billable behavior, sorting, weekly goals, and notification time.',
        scopes: ['write'],
        handler: updatePreferencesCommand,
    },
    list_tasks: {
        name: 'list_tasks',
        description: 'List tasks, optionally scoped to a project.',
        scopes: ['read'],
        handler: listTasksCommand,
    },
    create_task: {
        name: 'create_task',
        description: 'Create a task or subtask through the TaskTime Pro command layer.',
        scopes: ['write'],
        handler: createTaskCommand,
    },
    update_task: {
        name: 'update_task',
        description: 'Update a task through the TaskTime Pro command layer.',
        scopes: ['write'],
        handler: updateTaskCommand,
    },
    complete_task: {
        name: 'complete_task',
        description: 'Mark a non-recurring task or specific recurring occurrence complete.',
        scopes: ['write'],
        handler: completeTaskCommand,
    },
    archive_task: {
        name: 'archive_task',
        description: 'Archive a task using existing TaskTime Pro archive behavior.',
        scopes: ['write'],
        handler: archiveTaskCommand,
    },
    unarchive_task: {
        name: 'unarchive_task',
        description: 'Restore an archived task using existing TaskTime Pro unarchive behavior.',
        scopes: ['write'],
        handler: unarchiveTaskCommand,
    },
    preview_delete_task: {
        name: 'preview_delete_task',
        description: 'Preview the UI-style cascade impact of deleting an active or archived task without mutating data.',
        scopes: ['read'],
        handler: previewDeleteTaskCommand,
    },
    cascade_delete_task: {
        name: 'cascade_delete_task',
        description: 'Delete a task, descendant tasks, related active time entries, matching timers, and planner attachments after preview matching, confirmation, and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: cascadeDeleteTaskCommand,
    },
    delete_task: {
        name: 'delete_task',
        description: 'Delete one unreferenced active or archived task after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteTaskCommand,
    },
    get_active_timers: {
        name: 'get_active_timers',
        description: 'List active TaskTime Pro timers with resolved timer keys.',
        scopes: ['read'],
        handler: (context) => getActiveTimersCommand(context),
    },
    start_timer: {
        name: 'start_timer',
        description: 'Start a timer for a task without replacing an existing timer.',
        scopes: ['write'],
        handler: startTimerCommand,
    },
    pause_timer: {
        name: 'pause_timer',
        description: 'Pause a timer by timer key or task context.',
        scopes: ['write'],
        handler: pauseTimerCommand,
    },
    resume_timer: {
        name: 'resume_timer',
        description: 'Resume a paused timer by timer key or task context.',
        scopes: ['write'],
        handler: resumeTimerCommand,
    },
    stop_timer: {
        name: 'stop_timer',
        description: 'Stop a timer and create the corresponding time entry.',
        scopes: ['write'],
        handler: stopTimerCommand,
    },
    clear_timer: {
        name: 'clear_timer',
        description: 'Discard an active timer without creating a time entry after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: clearTimerCommand,
    },
    update_timer: {
        name: 'update_timer',
        description: 'Update an active timer note and/or start time using the same timer state the UI uses.',
        scopes: ['write'],
        handler: updateTimerCommand,
    },
    add_manual_time_entry: {
        name: 'add_manual_time_entry',
        description: 'Create a manual time entry after validating billing cutoffs and overlap rules.',
        scopes: ['write'],
        handler: addManualTimeEntryCommand,
    },
    update_time_entry: {
        name: 'update_time_entry',
        description: 'Edit an active unbilled time entry after validating task, billing cutoff, and overlap rules.',
        scopes: ['write'],
        handler: updateTimeEntryCommand,
    },
    delete_time_entry: {
        name: 'delete_time_entry',
        description: 'Delete one active unbilled time entry after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteTimeEntryCommand,
    },
    list_planner_attachments: {
        name: 'list_planner_attachments',
        description: 'List planner attachments, optionally filtered by type, reference, mode, date, or weekday.',
        scopes: ['read'],
        handler: listPlannerAttachmentsCommand,
    },
    attach_planner_item: {
        name: 'attach_planner_item',
        description: 'Attach a client, project, or task to the planner for a date, weekday, static pin, this week, or every week.',
        scopes: ['write'],
        handler: attachPlannerItemCommand,
    },
    update_planner_attachment: {
        name: 'update_planner_attachment',
        description: 'Update planner attachment options such as estimated hours.',
        scopes: ['write'],
        handler: updatePlannerAttachmentCommand,
    },
    remove_planner_attachment: {
        name: 'remove_planner_attachment',
        description: 'Remove one planner attachment without deleting the referenced client, project, or task.',
        scopes: ['write'],
        handler: removePlannerAttachmentCommand,
    },
    list_daily_goals: {
        name: 'list_daily_goals',
        description: 'List weekday daily planner goals.',
        scopes: ['read'],
        handler: listDailyGoalsCommand,
    },
    set_daily_goal: {
        name: 'set_daily_goal',
        description: 'Set or clear a weekday daily goal using planner UI-compatible hour and earnings validation.',
        scopes: ['write'],
        handler: setDailyGoalCommand,
    },
    remove_daily_goal: {
        name: 'remove_daily_goal',
        description: 'Remove a weekday daily goal.',
        scopes: ['write'],
        handler: removeDailyGoalCommand,
    },
    get_project_notes: {
        name: 'get_project_notes',
        description: 'Read project notes in the same persisted TipTap JSON format used by the UI, plus plain text.',
        scopes: ['read'],
        handler: getProjectNotesCommand,
    },
    update_project_notes: {
        name: 'update_project_notes',
        description: 'Update project notes with plain text or TipTap JSON through the same persisted notes payload format used by the UI.',
        scopes: ['write'],
        handler: updateProjectNotesCommand,
    },
    list_expenses: {
        name: 'list_expenses',
        description: 'List active expenses, optionally scoped by client or project.',
        scopes: ['read'],
        handler: listExpensesCommand,
    },
    create_expense: {
        name: 'create_expense',
        description: 'Create an expense through the TaskTime Pro command layer.',
        scopes: ['write'],
        handler: createExpenseCommand,
    },
    delete_expense: {
        name: 'delete_expense',
        description: 'Delete one active unbilled and unclaimed expense after explicit command confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteExpenseCommand,
    },
    list_expense_recurrences: {
        name: 'list_expense_recurrences',
        description: 'List recurring expense templates, optionally scoped by client/project or active status.',
        scopes: ['read'],
        handler: listExpenseRecurrencesCommand,
    },
    create_expense_recurrence: {
        name: 'create_expense_recurrence',
        description: 'Create a recurring expense template and optionally generate the initial expense instance when due, matching the UI flow.',
        scopes: ['write'],
        handler: createExpenseRecurrenceCommand,
    },
    update_expense_recurrence: {
        name: 'update_expense_recurrence',
        description: 'Update a recurring expense template for future generated expenses without mutating already-created expenses.',
        scopes: ['write'],
        handler: updateExpenseRecurrenceCommand,
    },
    pause_expense_recurrence: {
        name: 'pause_expense_recurrence',
        description: 'Pause a recurring expense template without deleting generated expenses.',
        scopes: ['write'],
        handler: pauseExpenseRecurrenceCommand,
    },
    resume_expense_recurrence: {
        name: 'resume_expense_recurrence',
        description: 'Resume a paused recurring expense template without changing already-generated expenses.',
        scopes: ['write'],
        handler: resumeExpenseRecurrenceCommand,
    },
    delete_expense_recurrence: {
        name: 'delete_expense_recurrence',
        description: 'Delete one recurring expense template after explicit command confirmation and TaskTime Pro approval without deleting generated expenses.',
        scopes: ['write'],
        requiresApproval: true,
        handler: deleteExpenseRecurrenceCommand,
    },
    mark_expense_paid: {
        name: 'mark_expense_paid',
        description: 'Mark an expense paid using existing payment snapshot behavior.',
        scopes: ['write'],
        handler: markExpensePaidCommand,
    },
    mark_expense_unpaid: {
        name: 'mark_expense_unpaid',
        description: 'Mark an expense unpaid.',
        scopes: ['write'],
        handler: markExpenseUnpaidCommand,
    },
    list_tax_return_periods: {
        name: 'list_tax_return_periods',
        description: 'List tax return periods used by Reports tax-claim workflows.',
        scopes: ['read'],
        handler: (context) => listTaxReturnPeriodsCommand(context),
    },
    create_tax_return_period: {
        name: 'create_tax_return_period',
        description: 'Create a tax return period for VAT, income-tax, sales-tax, or other reporting workflows.',
        scopes: ['write'],
        handler: createTaxReturnPeriodCommand,
    },
    update_tax_return_period: {
        name: 'update_tax_return_period',
        description: 'Update non-status tax return period metadata such as title, dates, business profile, and notes.',
        scopes: ['write'],
        handler: updateTaxReturnPeriodCommand,
    },
    mark_tax_return_period_filed: {
        name: 'mark_tax_return_period_filed',
        description: 'Mark a tax return period filed after explicit confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: markTaxReturnPeriodFiledCommand,
    },
    mark_tax_return_period_paid: {
        name: 'mark_tax_return_period_paid',
        description: 'Mark a tax return period paid after explicit confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: markTaxReturnPeriodPaidCommand,
    },
    mark_expenses_tax_claimed: {
        name: 'mark_expenses_tax_claimed',
        description: 'Mark selected expenses as tax claimed against an existing tax return period after confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: markExpensesTaxClaimedCommand,
    },
    mark_expenses_tax_unclaimed: {
        name: 'mark_expenses_tax_unclaimed',
        description: 'Clear tax claim status and period links from selected expenses after confirmation and TaskTime Pro approval.',
        scopes: ['write'],
        requiresApproval: true,
        handler: markExpensesTaxUnclaimedCommand,
    },
    list_invoices: {
        name: 'list_invoices',
        description: 'List invoices with bounded summary fields, optionally scoped by client, project, or status.',
        scopes: ['read'],
        handler: listInvoicesCommand,
    },
    preview_invoice_from_unbilled_work: {
        name: 'preview_invoice_from_unbilled_work',
        description: 'Calculate a read-only invoice preview from unbilled project work without creating billing side effects.',
        scopes: ['read'],
        handler: previewInvoiceFromUnbilledWorkCommand,
    },
    create_invoice_draft: {
        name: 'create_invoice_draft',
        description: 'Create a draft invoice from unbilled project work without marking entries or expenses billed.',
        scopes: ['read', 'write'],
        handler: createInvoiceDraftFromUnbilledWorkCommand,
    },
    update_invoice_draft: {
        name: 'update_invoice_draft',
        description: 'Edit allowed metadata, line items, totals, and UI composition fields on an existing draft invoice without billing side effects.',
        scopes: ['read', 'write'],
        handler: updateInvoiceDraftCommand,
    },
    finalize_invoice: {
        name: 'finalize_invoice',
        description: 'Finalize a draft invoice and apply billing side effects after explicit confirmation.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: finalizeInvoiceCommand,
    },
    mark_invoice_paid: {
        name: 'mark_invoice_paid',
        description: 'Mark an invoice paid after explicit confirmation, preserving payment currency snapshot behavior.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: markInvoicePaidCommand,
    },
    mark_invoice_unpaid: {
        name: 'mark_invoice_unpaid',
        description: 'Mark an invoice unpaid after explicit confirmation, preserving the UI status fallback behavior.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: markInvoiceUnpaidCommand,
    },
    undo_latest_invoice: {
        name: 'undo_latest_invoice',
        description: 'Undo the latest unpaid invoice after explicit confirmation, restoring billed entries, expenses, quoted amounts, task cutoffs, project links, and invoice sequence state.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: undoLatestInvoiceCommand,
    },
    export_invoice_pdf: {
        name: 'export_invoice_pdf',
        description: 'Generate and download an invoice PDF in the paired browser app session without returning PDF bytes through the bridge.',
        scopes: ['read', 'export'],
        handler: exportInvoicePdfCommand,
    },
    preview_project_quote: {
        name: 'preview_project_quote',
        description: 'Build a non-persistent quote document from project estimates without creating invoices or billing side effects.',
        scopes: ['read'],
        handler: previewProjectQuoteCommand,
    },
    export_project_quote_pdf: {
        name: 'export_project_quote_pdf',
        description: 'Generate and download a non-persistent project quote PDF in the paired browser app session.',
        scopes: ['read', 'export'],
        handler: exportProjectQuotePdfCommand,
    },
    preview_project_quote_email: {
        name: 'preview_project_quote_email',
        description: 'Resolve quote email recipient, template fields, body, and attachment title for a non-persistent project quote without sending email.',
        scopes: ['read'],
        handler: previewProjectQuoteEmailCommand,
    },
    send_project_quote_email: {
        name: 'send_project_quote_email',
        description: 'Generate a non-persistent project quote PDF in the paired browser app session and send it by email after explicit confirmation.',
        scopes: ['read', 'email'],
        requiresApproval: true,
        handler: sendProjectQuoteEmailCommand,
    },
    preview_invoice_email: {
        name: 'preview_invoice_email',
        description: 'Resolve invoice email recipient, template fields, body, and attachment title without sending email or mutating invoice state.',
        scopes: ['read'],
        handler: previewInvoiceEmailCommand,
    },
    send_invoice_email: {
        name: 'send_invoice_email',
        description: 'Generate the invoice PDF in the paired browser app session, send the invoice email through the existing cloud email service, and update sent metadata when applicable.',
        scopes: ['read', 'write', 'email'],
        requiresApproval: true,
        handler: sendInvoiceEmailCommand,
    },
    get_dashboard_summary: {
        name: 'get_dashboard_summary',
        description: 'Return a bounded summary of current TaskTime Pro work, timers, unbilled time, expenses, and draft invoices.',
        scopes: ['read'],
        handler: (context) => getDashboardSummaryCommand(context),
    },
    get_project_overview: {
        name: 'get_project_overview',
        description: 'Return a bounded project summary with task, timer, unbilled time, expense, and invoice counts.',
        scopes: ['read'],
        handler: getProjectOverviewCommand,
    },
    get_client_overview: {
        name: 'get_client_overview',
        description: 'Return a bounded client summary with project, expense, and invoice totals.',
        scopes: ['read'],
        handler: getClientOverviewCommand,
    },
    get_report_summary: {
        name: 'get_report_summary',
        description: 'Return read-only Reports-page summaries for filtered invoices, expenses, hours, tax, outstanding, statement, work-summary, and to-invoice sections.',
        scopes: ['read'],
        handler: getReportSummaryCommand,
    },
    export_report_csv: {
        name: 'export_report_csv',
        description: 'Generate and download a CSV export for a Reports-page section in the paired browser app session without returning file contents through the bridge.',
        scopes: ['read', 'export'],
        handler: exportReportCsvCommand,
    },
    export_report_pdf: {
        name: 'export_report_pdf',
        description: 'Generate and download a PDF export for Reports-page sections that have existing UI PDF exporters, without returning file contents through the bridge.',
        scopes: ['read', 'export'],
        handler: exportReportPdfCommand,
    },
    export_accountant_pack: {
        name: 'export_accountant_pack',
        description: 'Generate and download the Reports accountant pack ZIP in the paired browser app session without returning file contents through the bridge.',
        scopes: ['read', 'export'],
        handler: exportAccountantPackCommand,
    },
    export_backup_json: {
        name: 'export_backup_json',
        description: 'Export all TaskTime Pro backup data as a browser-downloaded JSON file without returning backup contents through the bridge.',
        scopes: ['read', 'export'],
        handler: exportBackupJsonCommand,
    },
    list_drive_backups: {
        name: 'list_drive_backups',
        description: 'List TaskTime Pro JSON backup snapshots currently available in Google Drive without returning backup contents.',
        scopes: ['read', 'export'],
        handler: (context) => listDriveBackupsCommand(context),
    },
    create_drive_backup: {
        name: 'create_drive_backup',
        description: 'Create a TaskTime Pro JSON backup snapshot in Google Drive using the existing backup manager.',
        scopes: ['read', 'export'],
        handler: (context) => createDriveBackupCommand(context),
    },
    download_drive_backup_json: {
        name: 'download_drive_backup_json',
        description: 'Download a selected Google Drive backup as a browser JSON file without returning backup contents through the bridge.',
        scopes: ['read', 'export'],
        handler: downloadDriveBackupJsonCommand,
    },
    preview_backup_import_json: {
        name: 'preview_backup_import_json',
        description: 'Validate a TaskTime Pro backup JSON payload and return import metadata without mutating current data.',
        scopes: ['read'],
        handler: previewBackupImportJsonCommand,
    },
    restore_backup_json: {
        name: 'restore_backup_json',
        description: 'Replace current local TaskTime Pro data with a validated backup JSON payload after explicit confirmation and TaskTime Pro approval.',
        scopes: ['read', 'write', 'export'],
        requiresApproval: true,
        handler: restoreBackupJsonCommand,
    },
    restore_drive_backup: {
        name: 'restore_drive_backup',
        description: 'Replace current local TaskTime Pro data from a selected Google Drive backup after explicit confirmation and TaskTime Pro approval.',
        scopes: ['read', 'write', 'export'],
        requiresApproval: true,
        handler: restoreDriveBackupCommand,
    },
    get_sync_status: {
        name: 'get_sync_status',
        description: 'Read current Google Drive sync status, auto-sync mode, pending changes, and backup preference metadata.',
        scopes: ['read'],
        handler: (context) => getSyncStatusCommand(context),
    },
    update_sync_settings: {
        name: 'update_sync_settings',
        description: 'Update explicit Google Drive sync and backup preferences, optionally triggering Sync Now after saving.',
        scopes: ['read', 'write', 'export'],
        handler: updateSyncSettingsCommand,
    },
    delete_all_account_data: {
        name: 'delete_all_account_data',
        description: 'Delete all local TaskTime Pro data and, when Drive is connected, wipe Drive sync data and backups after explicit confirmation and TaskTime Pro approval.',
        scopes: ['read', 'write', 'export'],
        requiresApproval: true,
        handler: deleteAllAccountDataCommand,
    },
    find_unbilled_time: {
        name: 'find_unbilled_time',
        description: 'Find recent unbilled time entries, optionally scoped by project or task.',
        scopes: ['read'],
        handler: findUnbilledTimeCommand,
    },
    list_recent_entries: {
        name: 'list_recent_entries',
        description: 'List recent time entries with bounded results and summarized fields.',
        scopes: ['read'],
        handler: listRecentEntriesCommand,
    },
    open_dashboard_view: {
        name: 'open_dashboard_view',
        description: 'Open the dashboard route in the paired TaskTime Pro app session.',
        scopes: ['navigation'],
        handler: (context) => openDashboardViewCommand(context),
    },
    open_planner_view: {
        name: 'open_planner_view',
        description: 'Open the planner route, optionally for a specific year/week, in the paired TaskTime Pro app session.',
        scopes: ['navigation'],
        handler: openPlannerViewCommand,
    },
    open_account_view: {
        name: 'open_account_view',
        description: 'Open the account route, optionally focused on a specific Account section such as Agent Access.',
        scopes: ['navigation'],
        handler: openAccountViewCommand,
    },
    open_project_view: {
        name: 'open_project_view',
        description: 'Open a validated project route in the paired TaskTime Pro app session.',
        scopes: ['navigation'],
        handler: openProjectViewCommand,
    },
    open_client_view: {
        name: 'open_client_view',
        description: 'Open a validated client route in the paired TaskTime Pro app session.',
        scopes: ['navigation'],
        handler: openClientViewCommand,
    },
    open_invoice_view: {
        name: 'open_invoice_view',
        description: 'Open the invoices route after validating an optional invoice ID.',
        scopes: ['navigation'],
        handler: openInvoiceViewCommand,
    },
    open_expenses_view: {
        name: 'open_expenses_view',
        description: 'Open the expenses route, optionally scoped by client or project.',
        scopes: ['navigation'],
        handler: openExpensesViewCommand,
    },
    open_reports_view: {
        name: 'open_reports_view',
        description: 'Open the reports route in the paired TaskTime Pro app session.',
        scopes: ['navigation'],
        handler: (context) => openReportsViewCommand(context),
    },
    focus_running_timer: {
        name: 'focus_running_timer',
        description: 'Focus the app on a validated running timer.',
        scopes: ['navigation'],
        handler: focusRunningTimerCommand,
    },
};

export function listAgentCommandDefinitions(context: AgentCommandContext): Array<Omit<AgentCommandDefinition, 'handler'>> {
    return Object.values(AGENT_COMMAND_REGISTRY)
        .filter((definition) => definition.scopes.every((scope) => !context.permissions || context.permissions.has(scope)))
        .map((definition) => ({
            name: definition.name,
            description: definition.description,
            scopes: definition.scopes,
            requiresApproval: definition.requiresApproval,
        }));
}

export function agentCommandRequiresApproval(command: string): boolean {
    return AGENT_COMMAND_REGISTRY[command as AgentCommandName]?.requiresApproval === true;
}

export function getAgentCommandMetadata(command: string): Omit<AgentCommandDefinition, 'handler'> | null {
    const definition = AGENT_COMMAND_REGISTRY[command as AgentCommandName];

    if (!definition) {
        return null;
    }

    return {
        name: definition.name,
        description: definition.description,
        scopes: definition.scopes,
        requiresApproval: definition.requiresApproval,
    };
}

function normalizeError(command: string, error: unknown): AgentCommandResponse {
    if (error instanceof AgentCommandError) {
        return {
            ok: false,
            command,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        };
    }

    return {
        ok: false,
        command,
        error: {
            code: 'INVALID_INPUT',
            message: error instanceof Error ? error.message : 'Command failed.',
        },
    };
}

export async function executeAgentCommand(
    context: AgentCommandContext,
    command: string,
    input: unknown = {}
): Promise<AgentCommandResponse> {
    const definition = AGENT_COMMAND_REGISTRY[command as AgentCommandName];

    if (!definition) {
        return {
            ok: false,
            command,
            error: {
                code: 'INVALID_INPUT',
                message: `Unsupported agent command: ${command}`,
            },
        };
    }

    const missingScope = definition.scopes.find((scope) => context.permissions && !context.permissions.has(scope));

    if (missingScope) {
        return {
            ok: false,
            command,
            error: {
                code: 'PERMISSION_DENIED',
                message: `Missing ${missingScope} permission.`,
                details: { scope: missingScope },
            },
        };
    }

    try {
        const data = await definition.handler(context, input);
        return {
            ok: true,
            command,
            data,
        };
    } catch (error) {
        return normalizeError(command, error);
    }
}
