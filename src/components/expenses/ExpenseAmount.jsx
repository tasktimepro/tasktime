import { formatCurrency } from '@/utils/currencyUtils';

/** Never combine amounts that could not be converted to a shared currency. */
export default function ExpenseAmount({ money, currency }) {
    const amounts = Object.entries(money.amounts).filter(([, amount]) => amount !== 0).sort(([a], [b]) => a.localeCompare(b));
    return <span className="sensitive-data inline-flex flex-col tabular-nums">{amounts.length
        ? amounts.map(([code, amount]) => <span key={code}>{formatCurrency(amount, code)}</span>)
        : formatCurrency(0, currency)}</span>;
}
