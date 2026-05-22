export function SmokeParticles({ count = 6 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-0 block rounded-full bg-foreground/10 blur-md"
          style={{
            left: `${(i / count) * 100 + Math.random() * 10}%`,
            width: `${20 + Math.random() * 30}px`,
            height: `${20 + Math.random() * 30}px`,
            animation: `smoke-rise ${5 + Math.random() * 4}s linear ${i * 0.6}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
