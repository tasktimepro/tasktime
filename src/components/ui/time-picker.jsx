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

    React.useEffect(() => {
        setLocalTime(parseTime(value));
    }, [value]);

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
                    className={cn(
                        "absolute z-50 mt-2 rounded-md border border-border bg-popover p-3 shadow-md",
                        showSeconds ? "min-w-[18rem]" : "min-w-[12.5rem]"
                    )}
                >
                    <div className={cn("grid gap-2", showSeconds ? "grid-cols-3" : "grid-cols-2")}>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Hours</span>
                            <Input
                                type="number"
                                min={0}
                                max={23}
                                value={Number(localTime.hours)}
                                onChange={(event) => handleTimeChange({ hours: padTime(Math.min(23, Math.max(0, Number(event.target.value) || 0))) })}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Minutes</span>
                            <Input
                                type="number"
                                min={0}
                                max={59}
                                value={Number(localTime.minutes)}
                                onChange={(event) => handleTimeChange({ minutes: padTime(Math.min(59, Math.max(0, Number(event.target.value) || 0))) })}
                                className="h-8 text-sm"
                            />
                        </div>
                        {showSeconds && (
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Seconds</span>
                                <Input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={Number(localTime.seconds)}
                                    onChange={(event) => handleTimeChange({ seconds: padTime(Math.min(59, Math.max(0, Number(event.target.value) || 0))) })}
                                    className="h-8 text-sm"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

TimePicker.displayName = "TimePicker";

export { TimePicker };
