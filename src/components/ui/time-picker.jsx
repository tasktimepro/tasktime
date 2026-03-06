import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ClockIcon } from "@/components/ui/icons";

const padTime = (value) => value.toString().padStart(2, "0");

const parseTime = (value) => {
    if (!value) {
        return { hours: "00", minutes: "00", seconds: "00" };
    }

    const [hours = "00", minutes = "00", seconds = "00"] = value.split(":");
    return {
        hours: padTime(Number.isNaN(Number(hours)) ? 0 : Number(hours)),
        minutes: padTime(Number.isNaN(Number(minutes)) ? 0 : Number(minutes)),
        seconds: padTime(Number.isNaN(Number(seconds)) ? 0 : Number(seconds)),
    };
};

const buildTimeValue = (hours, minutes, seconds) => `${padTime(hours)}:${padTime(minutes)}:${padTime(seconds)}`;
const buildTimeValueNoSeconds = (hours, minutes) => `${padTime(hours)}:${padTime(minutes)}`;

/**
 * Adjusts popup position to stay within viewport and modal boundaries.
 * Applies a CSS transform to shift the popup without changing its layout position.
 */
const adjustPopupPosition = (popupEl, containerEl) => {

    if (!popupEl || !containerEl) return;

    // Reset previous adjustment so measurements are from the natural position
    popupEl.style.transform = "";

    const rect = popupEl.getBoundingClientRect();
    const padding = 8;

    // Find nearest modal/dialog boundary
    const modal = popupEl.closest('[role="dialog"]');
    const modalRect = modal ? modal.getBoundingClientRect() : null;

    // Use the tighter of modal and viewport bounds
    const bounds = {
        top: Math.max(modalRect?.top ?? 0, 0) + padding,
        left: Math.max(modalRect?.left ?? 0, 0) + padding,
        right: Math.min(modalRect?.right ?? window.innerWidth, window.innerWidth) - padding,
        bottom: Math.min(modalRect?.bottom ?? window.innerHeight, window.innerHeight) - padding,
    };

    let dx = 0;
    let dy = 0;

    // Horizontal overflow
    if (rect.right > bounds.right) {
        dx = bounds.right - rect.right;
    }

    if (rect.left + dx < bounds.left) {
        dx = bounds.left - rect.left;
    }

    // Vertical overflow — flip above the input
    if (rect.bottom > bounds.bottom) {
        const containerRect = containerEl.getBoundingClientRect();
        dy = -(rect.height + containerRect.height + 8);
    }

    if (dx !== 0 || dy !== 0) {
        popupEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }
};

/**
 * Individual time field input that supports clearing the value while editing.
 * Validates and clamps on blur.
 */
const TimeFieldInput = ({ label, value, min, max, onCommit }) => {

    const [editValue, setEditValue] = React.useState(null);

    const displayValue = editValue !== null ? editValue : Number(value);

    const handleChange = (e) => {

        const raw = e.target.value;
        setEditValue(raw);

        if (raw !== "") {
            const num = Math.min(max, Math.max(min, Number(raw) || 0));
            onCommit(padTime(num));
        }
    };

    const handleBlur = () => {

        if (editValue === "" || editValue === null) {
            onCommit(padTime(0));
        }

        setEditValue(null);
    };

    return (
        <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Input
                type="number"
                min={min}
                max={max}
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className="h-8 text-sm"
            />
        </div>
    );
};

const TimePicker = React.forwardRef(({
    className,
    value = "00:00:00",
    onChange,
    disabled,
    showSeconds = true,
    ...props
}, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [localTime, setLocalTime] = React.useState(() => parseTime(value));
    const containerRef = React.useRef(null);
    const popupRef = React.useRef(null);

    React.useEffect(() => {
        setLocalTime(parseTime(value));
    }, [value]);

    // Adjust position before paint — no flash
    React.useLayoutEffect(() => {
        if (!isOpen) return;
        adjustPopupPosition(popupRef.current, containerRef.current);
    }, [isOpen]);

    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const handleTimeChange = (next) => {
        const nextTime = {
            ...localTime,
            ...next,
        };
        setLocalTime(nextTime);

        const nextValue = showSeconds
            ? buildTimeValue(nextTime.hours, nextTime.minutes, nextTime.seconds)
            : buildTimeValueNoSeconds(nextTime.hours, nextTime.minutes);

        if (onChange) {
            onChange({ target: { value: nextValue } });
        }
    };

    const handleToggle = () => {
        if (disabled) return;
        setIsOpen((open) => !open);
    };

    return (
        <div ref={containerRef} className="relative">
            <ClockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                ref={ref}
                type="text"
                readOnly
                value={showSeconds
                    ? buildTimeValue(localTime.hours, localTime.minutes, localTime.seconds)
                    : buildTimeValueNoSeconds(localTime.hours, localTime.minutes)}
                onClick={handleToggle}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleToggle();
                    }
                }}
                className={cn("pl-9 cursor-pointer", className)}
                disabled={disabled}
                {...props}
            />

            {isOpen && !disabled && (
                <div
                    ref={popupRef}
                    className={cn(
                        "absolute z-[100] mt-2 rounded-md border border-border bg-popover p-3 shadow-md",
                        showSeconds ? "min-w-[18rem]" : "min-w-[12.5rem]"
                    )}
                >
                    <div className={cn("grid gap-2", showSeconds ? "grid-cols-3" : "grid-cols-2")}>
                        <TimeFieldInput
                            label="Hours"
                            value={localTime.hours}
                            min={0}
                            max={23}
                            onCommit={(v) => handleTimeChange({ hours: v })}
                        />
                        <TimeFieldInput
                            label="Minutes"
                            value={localTime.minutes}
                            min={0}
                            max={59}
                            onCommit={(v) => handleTimeChange({ minutes: v })}
                        />
                        {showSeconds && (
                            <TimeFieldInput
                                label="Seconds"
                                value={localTime.seconds}
                                min={0}
                                max={59}
                                onCommit={(v) => handleTimeChange({ seconds: v })}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

TimePicker.displayName = "TimePicker";

export { TimePicker };
