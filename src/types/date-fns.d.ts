declare module 'date-fns' {
    export type WeekOptions = { weekStartsOn?: number }

    export function startOfDay(date: Date): Date
    export function endOfDay(date: Date): Date
    export function startOfWeek(date: Date, options?: WeekOptions): Date
    export function endOfWeek(date: Date, options?: WeekOptions): Date
    export function startOfMonth(date: Date): Date
    export function endOfMonth(date: Date): Date
    export function startOfYear(date: Date): Date
    export function endOfYear(date: Date): Date
    export function subMonths(date: Date, amount: number): Date
}
