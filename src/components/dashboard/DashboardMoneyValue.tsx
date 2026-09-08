import { formatCurrency } from '@/utils/currencyUtils';
import type { DashboardMoney } from './dashboardMetrics';

/** Keep original-currency fallbacks readable, including in privacy mode. */
export function DashboardMoneyValue({ money, currency }: { money: DashboardMoney; currency: string }) {
    const values = Object.entries(money.amounts).filter(([, value]) => value !== 0)
        .sort(([left], [right]) => left.localeCompare(right));
    return <span className="sensitive-data inline-flex flex-col gap-1">{values.length
        ? values.map(([code, value]) => <span key={code}>{formatCurrency(value, code)}</span>)
        : formatCurrency(0, currency)}</span>;
}
