import { motion } from "framer-motion";

interface Props {
  value: number; // 0-100
  label: string;
  sub?: string;
  size?: number;
  color?: string;
}

export function CircularMeter({ value, label, sub, size = 160, color = "oklch(0.68 0.15 50)" }: Props) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (safeValue / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="meterGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="oklch(0.62 0.12 310)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(0.18 0.01 260 / 0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#meterGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}/0.2)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
        <div className="text-4xl font-bold text-foreground mt-1">{Math.round(safeValue)}%</div>
        {sub && <div className="text-[10px] mt-1 font-medium text-muted-foreground max-w-[100px]">{sub}</div>}
      </div>
    </div>
  );
}
