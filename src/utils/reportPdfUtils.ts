import { generatePDF } from './pdfUtils';

type SummaryRow = {
    label: string;
    value: string;
};

type BreakdownRow = {
    label: string;
    value: string;
};

type MonthlyReportPdfInput = {
    businessLabel: string;
    categoryBreakdown: BreakdownRow[];
    filename: string;
    generatedAtLabel: string;
    periodLabel: string;
    projectBreakdown: BreakdownRow[];
    reviewRows?: SummaryRow[];
    summaryRows: SummaryRow[];
    topClientBreakdown: BreakdownRow[];
};

type StatementSummaryRow = {
    label: string;
    value: string;
};

type StatementInvoiceRow = {
    amount: string;
    date: string;
    dueDate: string;
    invoiceNumber: string;
    status: string;
};

type StatementPaymentRow = {
    amount: string;
    invoiceNumber: string;
    paidDate: string;
};

type ClientStatementPdfInput = {
    businessLabel: string;
    clientLabel: string;
    filename: string;
    generatedAtLabel: string;
    openingRows: StatementInvoiceRow[];
    outstandingRows: StatementInvoiceRow[];
    paymentRows: StatementPaymentRow[];
    periodLabel: string;
    statementDateLabel: string;
    summaryRows: StatementSummaryRow[];
};

type ProjectWorkSummaryRow = {
    billableDuration: string;
    entries: string;
    task: string;
    totalDuration: string;
};

type ProjectWorkSummaryPdfInput = {
    clientLabel: string;
    filename: string;
    generatedAtLabel: string;
    periodLabel: string;
    projectLabel: string;
    summaryRows: SummaryRow[];
    taskRows: ProjectWorkSummaryRow[];
};

type InvoiceReportRow = {
    business: string;
    client: string;
    currency: string;
    dueDate: string;
    invoiceDate: string;
    invoiceNumber: string;
    paidDate: string;
    project: string;
    status: string;
    subtotal: string;
    tax: string;
    total: string;
};

type InvoiceReportSummarySection = {
    rows: SummaryRow[];
    title: string;
};

type InvoiceReportPdfInput = {
    businessLabel: string;
    filename: string;
    generatedAtLabel: string;
    periodLabel: string;
    rows: InvoiceReportRow[];
    summarySections?: InvoiceReportSummarySection[];
};

type OutstandingInvoiceReportRow = {
    amount: string;
    client: string;
    daysOverdue: string;
    dueDate: string;
    invoiceDate: string;
    invoiceNumber: string;
    status: string;
};

type OutstandingReportPdfInput = {
    agingRows: SummaryRow[];
    businessLabel: string;
    filename: string;
    generatedAtLabel: string;
    invoiceRows: OutstandingInvoiceReportRow[];
    periodLabel: string;
    referenceDateLabel: string;
    summaryRows: SummaryRow[];
};

type ExpenseReportRow = {
    billingStatus: string;
    business: string;
    category: string;
    client: string;
    date: string;
    grossAmount: string;
    netAmount: string;
    paidDate: string;
    paymentStatus: string;
    project: string;
    supplier: string;
    taxAmount: string;
    title: string;
};

type ExpensesReportPdfInput = {
    businessLabel: string;
    filename: string;
    generatedAtLabel: string;
    periodLabel: string;
    rows: ExpenseReportRow[];
    summaryRows: SummaryRow[];
};

const escapeHtml = (value: string) => {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
};

const buildRowsHtml = (rows: SummaryRow[] | BreakdownRow[]) => {
    return rows.map((row) => {
        return `
            <tr>
                <td>${escapeHtml(row.label)}</td>
                <td>${escapeHtml(row.value)}</td>
            </tr>
        `;
    }).join('');
};

const buildStatementInvoiceRowsHtml = (rows: StatementInvoiceRow[]) => {
    return rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.invoiceNumber)}</td>
            <td>${escapeHtml(row.date)}</td>
            <td>${escapeHtml(row.dueDate)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.amount)}</td>
        </tr>
    `).join('');
};

const buildStatementPaymentRowsHtml = (rows: StatementPaymentRow[]) => {
    return rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.invoiceNumber)}</td>
            <td>${escapeHtml(row.paidDate)}</td>
            <td>${escapeHtml(row.amount)}</td>
        </tr>
    `).join('');
};

const buildOutstandingInvoiceRowsHtml = (rows: OutstandingInvoiceReportRow[]) => {
    return rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.invoiceNumber)}</td>
            <td>${escapeHtml(row.client)}</td>
            <td>${escapeHtml(row.invoiceDate)}</td>
            <td>${escapeHtml(row.dueDate)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.daysOverdue)}</td>
            <td>${escapeHtml(row.amount)}</td>
        </tr>
    `).join('');
};

const buildExpenseRowsHtml = (rows: ExpenseReportRow[]) => {
    return rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.date)}</td>
            <td>${escapeHtml(row.paidDate)}</td>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.supplier)}</td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.business)}</td>
            <td>${escapeHtml(row.client)}</td>
            <td>${escapeHtml(row.project)}</td>
            <td>${escapeHtml(row.paymentStatus)}</td>
            <td>${escapeHtml(row.billingStatus)}</td>
            <td>${escapeHtml(row.netAmount)}</td>
            <td>${escapeHtml(row.taxAmount)}</td>
            <td>${escapeHtml(row.grossAmount)}</td>
        </tr>
    `).join('');
};

export const buildMonthlyReportHtml = ({
    businessLabel,
    categoryBreakdown,
    generatedAtLabel,
    periodLabel,
    projectBreakdown,
    reviewRows = [],
    summaryRows,
    topClientBreakdown,
}: Omit<MonthlyReportPdfInput, 'filename'>) => {
    return `
        <div style="font-family: Arial, sans-serif; color: #111827; padding: 24px;">
            <header style="margin-bottom: 24px;">
                <h1 style="font-size: 24px; margin: 0 0 8px;">TaskTime Pro Monthly Report</h1>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Period: ${escapeHtml(periodLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Business: ${escapeHtml(businessLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Generated: ${escapeHtml(generatedAtLabel)}</p>
            </header>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(summaryRows)}
                    </tbody>
                </table>
            </section>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Top Clients</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(topClientBreakdown)}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 style="font-size: 16px; margin: 0 0 12px;">Top Projects</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(projectBreakdown)}
                    </tbody>
                </table>
            </section>

            <section style="margin-top: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Expense Categories</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${categoryBreakdown.length > 0 ? buildRowsHtml(categoryBreakdown) : '<tr><td colspan="2">No expense category totals in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <section style="margin-top: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Needs Review</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${reviewRows.length > 0 ? buildRowsHtml(reviewRows) : '<tr><td colspan="2">No review issues in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <style>
                table td {
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px 0;
                    font-size: 14px;
                }

                table td:last-child {
                    text-align: right;
                    font-weight: 600;
                }
            </style>
        </div>
    `;
};

export const exportMonthlyReportPdf = async ({
    filename,
    ...reportData
}: MonthlyReportPdfInput) => {
    const html = buildMonthlyReportHtml(reportData);
    await generatePDF(html, filename);
};

export const buildClientStatementHtml = ({
    businessLabel,
    clientLabel,
    generatedAtLabel,
    openingRows,
    outstandingRows,
    paymentRows,
    periodLabel,
    statementDateLabel,
    summaryRows,
}: Omit<ClientStatementPdfInput, 'filename'>) => {
    return `
        <div style="font-family: Arial, sans-serif; color: #111827; padding: 24px;">
            <header style="margin-bottom: 24px;">
                <h1 style="font-size: 24px; margin: 0 0 8px;">TaskTime Pro Client Statement</h1>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Client: ${escapeHtml(clientLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Business: ${escapeHtml(businessLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Period: ${escapeHtml(periodLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Statement Date: ${escapeHtml(statementDateLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Generated: ${escapeHtml(generatedAtLabel)}</p>
            </header>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(summaryRows)}
                    </tbody>
                </table>
            </section>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Opening Balance</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Due</th>
                            <th>Status</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${openingRows.length > 0 ? buildStatementInvoiceRowsHtml(openingRows) : '<tr><td colspan="5">No opening balance items</td></tr>'}
                    </tbody>
                </table>
            </section>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Payments in Period</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Paid Date</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentRows.length > 0 ? buildStatementPaymentRowsHtml(paymentRows) : '<tr><td colspan="3">No payments recorded in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 style="font-size: 16px; margin: 0 0 12px;">Outstanding at Statement Date</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Due</th>
                            <th>Status</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${outstandingRows.length > 0 ? buildStatementInvoiceRowsHtml(outstandingRows) : '<tr><td colspan="5">No outstanding invoices at the statement date</td></tr>'}
                    </tbody>
                </table>
            </section>

            <style>
                table th,
                table td {
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px 0;
                    font-size: 14px;
                    text-align: left;
                }

                table th:last-child,
                table td:last-child {
                    text-align: right;
                }
            </style>
        </div>
    `;
};

export const exportClientStatementPdf = async ({
    filename,
    ...reportData
}: ClientStatementPdfInput) => {
    const html = buildClientStatementHtml(reportData);
    await generatePDF(html, filename);
};

export const buildProjectWorkSummaryHtml = ({
    clientLabel,
    generatedAtLabel,
    periodLabel,
    projectLabel,
    summaryRows,
    taskRows,
}: Omit<ProjectWorkSummaryPdfInput, 'filename'>) => {
    return `
        <div style="font-family: Arial, sans-serif; color: #111827; padding: 24px;">
            <header style="margin-bottom: 24px;">
                <h1 style="font-size: 24px; margin: 0 0 8px;">TaskTime Pro Project Work Summary</h1>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Project: ${escapeHtml(projectLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Client: ${escapeHtml(clientLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Period: ${escapeHtml(periodLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Generated: ${escapeHtml(generatedAtLabel)}</p>
            </header>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(summaryRows)}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 style="font-size: 16px; margin: 0 0 12px;">Tasks</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Entries</th>
                            <th>Total Time</th>
                            <th>Billable Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taskRows.length > 0 ? taskRows.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.task)}</td>
                                <td>${escapeHtml(row.entries)}</td>
                                <td>${escapeHtml(row.totalDuration)}</td>
                                <td>${escapeHtml(row.billableDuration)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4">No worked tasks in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <style>
                table th,
                table td {
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px 0;
                    font-size: 14px;
                    text-align: left;
                }

                table th:last-child,
                table td:last-child {
                    text-align: right;
                }
            </style>
        </div>
    `;
};

export const exportProjectWorkSummaryPdf = async ({
    filename,
    ...reportData
}: ProjectWorkSummaryPdfInput) => {
    const html = buildProjectWorkSummaryHtml(reportData);
    await generatePDF(html, filename);
};

export const buildInvoicesReportHtml = ({
    businessLabel,
    generatedAtLabel,
    periodLabel,
    rows,
    summarySections = [],
}: Omit<InvoiceReportPdfInput, 'filename'>) => {
    const rowsHtml = rows.length > 0 ? rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.invoiceNumber)}</td>
            <td>${escapeHtml(row.client)}</td>
            <td>${escapeHtml(row.project)}</td>
            <td>${escapeHtml(row.invoiceDate)}</td>
            <td>${escapeHtml(row.dueDate)}</td>
            <td>${escapeHtml(row.paidDate)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.currency)}</td>
            <td>${escapeHtml(row.subtotal)}</td>
            <td>${escapeHtml(row.tax)}</td>
            <td>${escapeHtml(row.total)}</td>
        </tr>
    `).join('') : '<tr><td colspan="11">No invoices in this period</td></tr>';

    const summarySectionsHtml = summarySections.length > 0 ? `
        <section style="margin-bottom: 24px;">
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
                ${summarySections.map((section) => `
                    <div>
                        <h2 style="font-size: 16px; margin: 0 0 8px;">${escapeHtml(section.title)}</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                ${buildRowsHtml(section.rows)}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        </section>
    ` : '';

    return `
        <div style="font-family: Arial, sans-serif; color: #111827; padding: 24px;">
            <header style="margin-bottom: 24px;">
                <h1 style="font-size: 24px; margin: 0 0 8px;">TaskTime Pro Issued Invoices Report</h1>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Period: ${escapeHtml(periodLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Business: ${escapeHtml(businessLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Generated: ${escapeHtml(generatedAtLabel)}</p>
            </header>

            ${summarySectionsHtml}

            <section>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Client</th>
                            <th>Project</th>
                            <th>Issued</th>
                            <th>Due</th>
                            <th>Paid</th>
                            <th>Status</th>
                            <th>Currency</th>
                            <th>Subtotal</th>
                            <th>Tax</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </section>

            <style>
                table th,
                table td {
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px 4px;
                    font-size: 12px;
                    text-align: left;
                }

                table th:last-child,
                table td:last-child,
                table td:nth-last-child(2),
                table td:nth-last-child(3) {
                    text-align: right;
                }
            </style>
        </div>
    `;
};

export const exportInvoicesReportPdf = async ({
    filename,
    ...reportData
}: InvoiceReportPdfInput) => {
    const html = buildInvoicesReportHtml(reportData);
    await generatePDF(html, filename);
};

export const buildOutstandingReportHtml = ({
    agingRows,
    businessLabel,
    generatedAtLabel,
    invoiceRows,
    periodLabel,
    referenceDateLabel,
    summaryRows,
}: Omit<OutstandingReportPdfInput, 'filename'>) => {
    return `
        <div style="font-family: Arial, sans-serif; color: #111827; padding: 24px;">
            <header style="margin-bottom: 24px;">
                <h1 style="font-size: 24px; margin: 0 0 8px;">TaskTime Pro Outstanding Invoices Report</h1>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Period: ${escapeHtml(periodLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Business: ${escapeHtml(businessLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Reference Date: ${escapeHtml(referenceDateLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Generated: ${escapeHtml(generatedAtLabel)}</p>
            </header>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(summaryRows)}
                    </tbody>
                </table>
            </section>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Aging Buckets</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${agingRows.length > 0 ? buildRowsHtml(agingRows) : '<tr><td colspan="2">No aging rows in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 style="font-size: 16px; margin: 0 0 12px;">Outstanding Invoices</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Client</th>
                            <th>Issued</th>
                            <th>Due</th>
                            <th>Status</th>
                            <th>Days Overdue</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceRows.length > 0 ? buildOutstandingInvoiceRowsHtml(invoiceRows) : '<tr><td colspan="7">No outstanding invoices in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <style>
                table th,
                table td {
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px 4px;
                    font-size: 12px;
                    text-align: left;
                }

                table td:last-child,
                table th:last-child {
                    text-align: right;
                }
            </style>
        </div>
    `;
};

export const exportOutstandingReportPdf = async ({
    filename,
    ...reportData
}: OutstandingReportPdfInput) => {
    const html = buildOutstandingReportHtml(reportData);
    await generatePDF(html, filename);
};

export const buildExpensesReportHtml = ({
    businessLabel,
    generatedAtLabel,
    periodLabel,
    rows,
    summaryRows,
}: Omit<ExpensesReportPdfInput, 'filename'>) => {
    return `
        <div style="font-family: Arial, sans-serif; color: #111827; padding: 24px;">
            <header style="margin-bottom: 24px;">
                <h1 style="font-size: 24px; margin: 0 0 8px;">TaskTime Pro Expenses Report</h1>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Period: ${escapeHtml(periodLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Business: ${escapeHtml(businessLabel)}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">Generated: ${escapeHtml(generatedAtLabel)}</p>
            </header>

            <section style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; margin: 0 0 12px;">Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${buildRowsHtml(summaryRows)}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 style="font-size: 16px; margin: 0 0 12px;">Expenses</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Paid</th>
                            <th>Title</th>
                            <th>Supplier</th>
                            <th>Category</th>
                            <th>Business</th>
                            <th>Client</th>
                            <th>Project</th>
                            <th>Payment</th>
                            <th>Billing</th>
                            <th>Ex VAT</th>
                            <th>VAT</th>
                            <th>Inc VAT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length > 0 ? buildExpenseRowsHtml(rows) : '<tr><td colspan="13">No expenses in this period</td></tr>'}
                    </tbody>
                </table>
            </section>

            <style>
                table th,
                table td {
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px 4px;
                    font-size: 12px;
                    text-align: left;
                }

                table td:nth-last-child(1),
                table td:nth-last-child(2),
                table td:nth-last-child(3),
                table th:nth-last-child(1),
                table th:nth-last-child(2),
                table th:nth-last-child(3) {
                    text-align: right;
                }
            </style>
        </div>
    `;
};

export const exportExpensesReportPdf = async ({
    filename,
    ...reportData
}: ExpensesReportPdfInput) => {
    const html = buildExpensesReportHtml(reportData);
    await generatePDF(html, filename);
};
