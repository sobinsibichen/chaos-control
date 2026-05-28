import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Clock3 } from "lucide-react";

interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  format?: "24h" | "12h"; // 24-hour or 12-hour format
  label?: string;
  disabled?: boolean;
}

export function TimePicker({
  value,
  onChange,
  format = "24h",
  label = "Select Time",
  disabled = false,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState<string>("00");
  const [minutes, setMinutes] = useState<string>("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM"); // For 12-hour format

  // Parse initial value
  useEffect(() => {
    const [h, m] = value.split(":").map((v) => v.padStart(2, "0"));
    if (format === "12h") {
      const hour24 = parseInt(h);
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      const ampm = hour24 >= 12 ? "PM" : "AM";
      setHours(String(hour12).padStart(2, "0"));
      setPeriod(ampm);
    } else {
      setHours(h);
    }
    setMinutes(m);
  }, [value, format]);

  // Generate hour options based on format
  const hourOptions = useMemo(() => {
    if (format === "12h") {
      return Array.from({ length: 12 }, (_, i) =>
        String((i + 1) % 12 === 0 ? 12 : (i + 1) % 12).padStart(2, "0")
      );
    }
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  }, [format]);

  // Generate minute options with 1-minute increments
  const minuteOptions = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  }, []);

  // Handle time change
  const handleTimeChange = () => {
    let hour24 = parseInt(hours);

    if (format === "12h") {
      if (period === "AM") {
        hour24 = hour24 === 12 ? 0 : hour24;
      } else {
        hour24 = hour24 === 12 ? 12 : hour24 + 12;
      }
    }

    const newTime = `${String(hour24).padStart(2, "0")}:${minutes}`;
    onChange(newTime);
    setIsOpen(false);
  };

  // Increment/Decrement handlers
  const incrementHours = () => {
    let newHour = parseInt(hours) + 1;
    if (format === "12h") {
      newHour = newHour > 12 ? 1 : newHour;
    } else {
      newHour = newHour > 23 ? 0 : newHour;
    }
    setHours(String(newHour).padStart(2, "0"));
  };

  const decrementHours = () => {
    let newHour = parseInt(hours) - 1;
    if (format === "12h") {
      newHour = newHour < 1 ? 12 : newHour;
    } else {
      newHour = newHour < 0 ? 23 : newHour;
    }
    setHours(String(newHour).padStart(2, "0"));
  };

  const incrementMinutes = () => {
    let newMinute = parseInt(minutes) + 1;
    if (newMinute > 59) {
      newMinute = 0;
      incrementHours();
    }
    setMinutes(String(newMinute).padStart(2, "0"));
  };

  const decrementMinutes = () => {
    let newMinute = parseInt(minutes) - 1;
    if (newMinute < 0) {
      newMinute = 59;
      decrementHours();
    }
    setMinutes(String(newMinute).padStart(2, "0"));
  };

  const togglePeriod = () => {
    setPeriod(period === "AM" ? "PM" : "AM");
  };

  const displayTime = `${hours}:${minutes}${format === "12h" ? " " + period : ""}`;

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm text-foreground outline-none transition-all hover:border-foreground/20 disabled:opacity-50"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-sky-600" />
            <span className="font-semibold">{displayTime}</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && !disabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-foreground/10 bg-card p-4 shadow-lg backdrop-blur-sm"
        >
          <div className="grid grid-cols-3 gap-3">
            {/* Hours */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hour
              </div>
              <button
                onClick={incrementHours}
                className="rounded-full p-2 hover:bg-foreground/5 transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="relative h-20 overflow-hidden rounded-xl border border-foreground/10 bg-background">
                <div className="absolute inset-0 flex flex-col">
                  {hourOptions.map((h, idx) => (
                    <button
                      key={h}
                      onClick={() => setHours(h)}
                      className={`flex-1 text-sm font-semibold transition-colors ${
                        hours === h
                          ? "bg-sky-600/20 text-sky-600"
                          : "text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={decrementHours}
                className="rounded-full p-2 hover:bg-foreground/5 transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-foreground">:</div>
            </div>

            {/* Minutes */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Minute
              </div>
              <button
                onClick={incrementMinutes}
                className="rounded-full p-2 hover:bg-foreground/5 transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="relative h-20 overflow-hidden rounded-xl border border-foreground/10 bg-background">
                <div className="absolute inset-0 flex flex-col">
                  {minuteOptions.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`flex-1 text-sm font-semibold transition-colors ${
                        minutes === m
                          ? "bg-sky-600/20 text-sky-600"
                          : "text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={decrementMinutes}
                className="rounded-full p-2 hover:bg-foreground/5 transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Period selector for 12-hour format */}
          {format === "12h" && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPeriod("AM")}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  period === "AM"
                    ? "bg-sky-600 text-white"
                    : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                }`}
              >
                AM
              </button>
              <button
                onClick={() => setPeriod("PM")}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  period === "PM"
                    ? "bg-sky-600 text-white"
                    : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                }`}
              >
                PM
              </button>
            </div>
          )}

          {/* Confirmation button */}
          <button
            onClick={handleTimeChange}
            className="mt-4 w-full rounded-full bg-black py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-black/90"
          >
            Confirm Time
          </button>
        </motion.div>
      )}
    </div>
  );
}
