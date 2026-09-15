import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: [
                'src/utils/**',
                'src/recovery/localWorkspaceRecovery.ts',
                'src/hooks/**',
                'src/components/dashboard/dashboardMetrics.ts',
                'src/components/dashboard/hooks/**',
                'src/components/dashboard/DashboardHoursChart.jsx',
                'src/components/dashboard/DashboardMoneyValue.tsx',
                'src/components/dashboard/DashboardSummaryCards.jsx',
                'src/components/dashboard/MetricsCards.jsx',
                'src/components/dashboard/Upcoming.jsx',
                'src/components/expenses/expenseOverviewMetrics.ts',
                'src/components/expenses/ExpenseMetrics.jsx',
                'src/components/expenses/ExpenseAmount.jsx',
                'src/components/expenses/ExpenseInsights.jsx',
                'src/components/expenses/ExpenseSpendingChart.jsx',
            ],
            exclude: [
                'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
                'src/hooks/yjs/**',
            ],
            thresholds: {
                statements: 75,
                branches: 75,
                functions: 75,
                lines: 75,
                perFile: true
            }
        },
    },
})
