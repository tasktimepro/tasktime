/**
 * ColorPicker - A simple color swatch picker for selecting preset colors
 * 
 * Designed to work well in both light and dark modes.
 */

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Preset colors that work well in both light and dark modes
 * Each color is chosen to be visible and aesthetic in both themes
 */
export const PRESET_COLORS = [
    { value: '#ef4444', name: 'Red' },       // Tailwind red-500
    { value: '#f97316', name: 'Orange' },    // Tailwind orange-500
    { value: '#f59e0b', name: 'Amber' },     // Tailwind amber-500
    { value: '#eab308', name: 'Yellow' },    // Tailwind yellow-500
    { value: '#84cc16', name: 'Lime' },      // Tailwind lime-500
    { value: '#22c55e', name: 'Green' },     // Tailwind green-500
    { value: '#14b8a6', name: 'Teal' },      // Tailwind teal-500
    { value: '#06b6d4', name: 'Cyan' },      // Tailwind cyan-500
    { value: '#0ea5e9', name: 'Sky' },       // Tailwind sky-500
    { value: '#3b82f6', name: 'Blue' },      // Tailwind blue-500
    { value: '#6366f1', name: 'Indigo' },    // Tailwind indigo-500
    { value: '#8b5cf6', name: 'Violet' },    // Tailwind violet-500
    { value: '#a855f7', name: 'Purple' },    // Tailwind purple-500
    { value: '#d946ef', name: 'Fuchsia' },   // Tailwind fuchsia-500
    { value: '#ec4899', name: 'Pink' },      // Tailwind pink-500
    { value: '#64748b', name: 'Slate' },     // Tailwind slate-500
];

/**
 * @param {Object} props
 * @param {string | null} props.value - Currently selected color (hex)
 * @param {(color: string | null) => void} props.onChange - Called when color changes
 * @param {string} props.className - Additional CSS classes
 */
const ColorPicker = ({ value, onChange, className }) => {

    const handleColorClick = (color) => {
        // If clicking the same color, deselect it
        if (value === color) {
            onChange(null);
        } else {
            onChange(color);
        }
    };

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {PRESET_COLORS.map((color) => (
                <button
                    key={color.value}
                    type="button"
                    title={color.name}
                    onClick={() => handleColorClick(color.value)}
                    className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all relative",
                        "cursor-pointer hover:scale-110 focus:outline-none",
                        value === color.value
                            ? "border-black dark:border-white"
                            : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    aria-label={`Select ${color.name} color`}
                >
                    {value === color.value && (
                        <Check
                            className="w-4 h-4 text-black dark:text-white absolute inset-0 m-auto"
                            aria-hidden="true"
                        />
                    )}
                </button>
            ))}
            
            {/* Clear button */}
            <button
                type="button"
                title="No color"
                onClick={() => onChange(null)}
                className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                    "cursor-pointer hover:scale-110 focus:outline-none",
                    "bg-muted border-muted-foreground/30",
                    !value && "border-black dark:border-white"
                )}
                aria-label="Clear color"
            >
                <X
                    className={cn(
                        "w-4 h-4",
                        !value 
                            ? "text-black dark:text-white" 
                            : "text-muted-foreground/60"
                    )}
                    aria-hidden="true"
                />
            </button>
        </div>
    );
};

export { ColorPicker };
