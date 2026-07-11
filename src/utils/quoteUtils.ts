import type { BusinessInfo, Client, InvoiceTemplate, PaymentMethod, Project, Task } from '@/stores/yjs/types';
import { slugify } from './idUtils';
import { getProjectCurrency } from './currencyUtils';
import { toStorageDate } from './dateUtils';
import { getTaskEstimateAmount } from './projectPlanningUtils';

type QuoteDocumentParams = {
    project: Project;
    tasks: Task[];
    clients?: Client[];
    businessInfos?: BusinessInfo[];
    paymentMethods?: PaymentMethod[];
    invoiceTemplates?: InvoiceTemplate[];
    client?: Client | null;
    businessInfo?: BusinessInfo | null;
    paymentMethod?: PaymentMethod | null;
    template?: InvoiceTemplate | null;
    note?: string;
    quoteTasks?: Array<{
        id?: string;
        title: string;
        hours?: number;
        hourlyRate?: number;
        flatRate?: number;
        quantity?: number;
        useFlatRate?: boolean;
        parentTaskId?: string | null;
    }>;
    additionalTasks?: Array<{
        id?: string;
        title: string;
        hours?: number;
        hourlyRate?: number;
        flatRate?: number;
        quantity?: number;
        useFlatRate?: boolean;
        parentTaskId?: string | null;
    }>;
    quoteDate?: string;
    quoteTimestamp?: string;
    preferredCurrency?: string;
};

export const getQuoteNumberTimestamp = (value = new Date()): string => {
    const date = value instanceof Date ? value : new Date(value);

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`.slice(-8);
};

const resolveDefaultBusinessInfo = (businessInfos: BusinessInfo[] = []): BusinessInfo | null => {
    return businessInfos.find((businessInfo) => businessInfo.isDefault) || businessInfos[0] || null;
};

const resolveDefaultPaymentMethod = (paymentMethods: PaymentMethod[] = []): PaymentMethod | null => {
    return paymentMethods.find((paymentMethod) => paymentMethod.isDefault) || paymentMethods[0] || null;
};

const resolveDefaultTemplate = (invoiceTemplates: InvoiceTemplate[] = []): InvoiceTemplate | null => {
    return invoiceTemplates.find((template) => template.isDefault) || invoiceTemplates[0] || null;
};

export const buildProjectQuoteLineItems = ({
    project,
    tasks,
    clients = [],
}: Pick<QuoteDocumentParams, 'project' | 'tasks' | 'clients'>) => {
    const client = project.preferredClientId
        ? clients.find((candidate) => candidate.id === project.preferredClientId) || null
        : null;

    const quoteTasks = tasks
        .filter((task) => (
            task.projectId === project.id
            && task.archived !== true
            && task.billable === true
        ))
        .map((task) => {
            const amount = getTaskEstimateAmount(task, project, client);

            if (amount <= 0) {
                return null;
            }

            if (project.flatRate) {
                return {
                    id: task.id,
                    title: task.title,
                    flatRate: amount,
                    quantity: 1,
                    useFlatRate: true,
                    parentTaskId: task.parentTaskId || null,
                };
            }

            return {
                id: task.id,
                title: task.title,
                originalHours: task.estimatedHours || 0,
                hours: task.estimatedHours || 0,
                hourlyRate: amount / (task.estimatedHours || 1),
                useFlatRate: false,
                parentTaskId: task.parentTaskId || null,
            };
        })
        .filter(Boolean);

    const additionalTasks = quoteTasks.length === 0 && typeof project.budgetAmount === 'number' && project.budgetAmount > 0
        ? [{
            title: 'Project budget / target',
            flatRate: project.budgetAmount,
            quantity: 1,
            useFlatRate: true,
        }]
        : [];

    return {
        client,
        quoteTasks,
        additionalTasks,
    };
};

export const getQuoteDownloadFilename = (projectTitle: string, quoteDate = toStorageDate(new Date())): string => {
    const projectSlug = slugify(projectTitle || 'quote');
    return `${projectSlug || 'quote'}-quote-${quoteDate}.pdf`;
};

export const buildQuoteDocumentData = ({
    project,
    tasks,
    clients = [],
    businessInfos = [],
    paymentMethods = [],
    invoiceTemplates = [],
    client: providedClient = null,
    businessInfo: providedBusinessInfo = null,
    paymentMethod: providedPaymentMethod = null,
    template: providedTemplate = null,
    note,
    quoteTasks: providedQuoteTasks,
    additionalTasks: providedAdditionalTasks,
    quoteDate = toStorageDate(new Date()),
    quoteTimestamp = getQuoteNumberTimestamp(),
    preferredCurrency,
}: QuoteDocumentParams) => {
    const derivedLineItems = buildProjectQuoteLineItems({ project, tasks, clients });
    const client = providedClient || derivedLineItems.client;

    if (!client) {
        throw new Error('Quotes require a client on the project.');
    }

    const businessInfo = providedBusinessInfo || resolveDefaultBusinessInfo(businessInfos);

    if (!businessInfo) {
        throw new Error('Quotes require a business profile.');
    }

    const paymentMethod = providedPaymentMethod || resolveDefaultPaymentMethod(paymentMethods);
    const template = providedTemplate || resolveDefaultTemplate(invoiceTemplates);
    const currency = getProjectCurrency(project, clients, preferredCurrency);
    const quoteTasks = providedQuoteTasks ?? derivedLineItems.quoteTasks;
    const additionalTasks = providedAdditionalTasks ?? derivedLineItems.additionalTasks;

    if (quoteTasks.length === 0 && additionalTasks.length === 0) {
        throw new Error('Quotes require at least one task estimate or a project budget / target.');
    }

    const totalHours = quoteTasks.reduce((total, task) => {
        if (task.useFlatRate || typeof task.hours !== 'number' || !Number.isFinite(task.hours)) {
            return total;
        }

        return total + task.hours;
    }, 0);
    const total = [...quoteTasks, ...additionalTasks].reduce((sum, task) => {
        if (task.useFlatRate) {
            return sum + ((task.flatRate || 0) * (task.quantity || 1));
        }

        return sum + ((task.hours || 0) * (task.hourlyRate || 0));
    }, 0);

    return {
        documentMode: 'quote' as const,
        clientId: client.id,
        project: {
            title: project.title,
            hourlyRate: project.hourlyRate,
        },
        client: {
            name: client.clientName || client.title || '',
            contactPerson: client.contactPerson || '',
            email: client.email || '',
            address: client.address || '',
            city: client.city || '',
            state: client.state || '',
            zip: client.zip || '',
            country: client.country || '',
        },
        tasks: quoteTasks,
        additionalTasks,
        totalHours: totalHours > 0 ? totalHours : undefined,
        total,
        subtotal: total,
        invoiceNumber: quoteTimestamp,
        date: quoteDate,
        dueDate: null,
        paymentMethod,
        businessInfo: {
            ...businessInfo,
            businessName: businessInfo.businessName || businessInfo.name || businessInfo.title || '',
        },
        currency,
        template,
        templateId: template?.id || null,
        note: note ?? template?.defaultNotes ?? '',
    };
};
