import { AnimatePresence, motion } from "framer-motion";
import { CircleCheckBig, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { appStore } from "@/lib/app-store";

interface MentalStabilityChallengeProps {
  open: boolean;
  onClose: () => void;
  onResult?: (result: { passed: boolean; challengeText: string; requiredAccuracy: number; attempts: number }) => void;
}

const paragraphs = [
  "Self-control sounds noble until it is midnight, your card is warm from bad ideas, and the balcony air feels like permission. You tell yourself this next cigarette is symbolic, ceremonial, educational even, but the ash says otherwise. Discipline is not dramatic. It is dull, repetitive, and deeply inconvenient. It asks you to sit with the itch, with the boredom, with the tiny emotional riot in your chest that insists one reckless decision could become relief. It cannot. Relief purchased in smoke, impulse messages, and fake confidence always invoices you later with compound interest. The version of you that survives tomorrow needs tonight's hands to stay steady, the wallet zipped, the contacts untouched, and the lighter ignored. Regret does not arrive screaming. It arrives quietly, as notifications, receipts, screenshots, and the smell in your hoodie. Type carefully. Your impulse control is allegedly auditioning for adulthood.",
  "Financial destruction rarely enters through the front door wearing a villain cape. It sneaks in disguised as a harmless order, a tiny craving, a one-time exception, a cigarette you swear you earned for enduring your own thoughts. Late-night bad decisions have a seductive script: just one more, just this once, just until the mood improves. The mood does not improve. It changes costumes, adds a headache, and leaves you checking your bank balance like a crime scene investigator. Discipline is boring because it works. It is the art of denying your most theatrical impulses before they build a stage and charge admission. Tonight, every unnecessary drag, every doomed message, every irrational purchase wants you to confuse motion with comfort. Do not. Sit in the discomfort long enough to recognize it as temporary, not prophetic. The chaos in your head is loud, but loud things are not automatically true. Accuracy matters now because your self-sabotage has always relied on technicalities and loopholes.",
  "Regret is a patient archivist. It stores the timestamp of every collapse, every receipt from a convenience store pilgrimage, every sunrise witnessed for the wrong reasons, every message sent because loneliness briefly impersonated destiny. You are not being asked to become perfect, holy, or emotionally organized. You are being asked to prove that your hands can obey your brain for one uninterrupted paragraph. That should be easy. It never is. The hardest part of discipline is how insultingly small it looks in the moment. Declining one cigarette feels trivial. Not texting your ex feels petty. Closing the shopping app feels anticlimactic. Yet entire disasters have been built out of these microscopic permissions. If you can replicate each comma, each period, each stubborn capital letter exactly, perhaps your future can trust you with one more unlocked app. If you cannot, then the lock is not punishment. It is witness protection for whatever dignity remains."
];

function getCharacterState(source: string, typed: string, index: number) {
  if (index >= typed.length) {
    return "pending";
  }

  return source[index] === typed[index] ? "correct" : "wrong";
}

export function MentalStabilityChallenge({ open, onClose, onResult }: MentalStabilityChallengeProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * paragraphs.length));
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);

  const paragraph = useMemo(() => paragraphs[seed]!, [seed]);
  const progress = Math.min(100, (typed.length / paragraph.length) * 100);

  useEffect(() => {
    if (!open) {
      setComposerFocused(false);
      return;
    }

    setTyped("");
    setFailed(false);
    setCompleted(false);
  }, [open, seed]);

  const handleChange = (nextValue: string) => {
    if (failed || completed) {
      return;
    }

    let mismatch = false;

    for (let index = 0; index < nextValue.length; index += 1) {
      if (nextValue[index] !== paragraph[index]) {
        mismatch = true;
        break;
      }
    }

    setTyped(nextValue);

    if (mismatch) {
      setFailed(true);
      appStore.failUnlockAttempt();
      onResult?.({ passed: false, challengeText: paragraph, requiredAccuracy: 100, attempts: 1 });
      return;
    }

    if (nextValue === paragraph) {
      setCompleted(true);
      appStore.unlockApps();
      onResult?.({ passed: true, challengeText: paragraph, requiredAccuracy: 100, attempts: 1 });
    }
  };

  const retry = () => {
    setSeed((current) => (current + 1) % paragraphs.length);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-center justify-center bg-background/85 px-4 py-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={
              failed
                ? { opacity: 1, y: [0, -6, 6, -4, 0], scale: [1, 0.995, 1] }
                : { opacity: 1, y: composerFocused ? -64 : 0, scale: 1 }
            }
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.35 }}
            className={`glass-strong max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border p-5 ${
              failed ? "border-red-400/40 shadow-[0_0_40px_-10px_rgba(248,113,113,0.35)]" : "border-foreground/10"
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">// MENTAL.STABILITY.VERIFICATION</div>
                <h2 className="mt-1 text-2xl font-bold text-foreground">Type like your bad choices depend on it.</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every character matters. Spaces, commas, periods, and pride included.</p>
              </div>
              <button onClick={onClose} className="rounded-full border border-foreground/10 bg-card px-3 py-2 text-[10px] font-mono uppercase text-muted-foreground shadow-sm">
                Close
              </button>
            </div>

            <div className="mb-4 h-2 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
                className={`h-full ${completed ? "bg-foreground" : failed ? "bg-red-500" : "bg-foreground"}`}
              />
            </div>

            <div className={`rounded-[1.75rem] border bg-card p-4 text-[15px] leading-7 ${failed ? "border-red-400/35" : "border-foreground/10"}`}>
              {paragraph.split("").map((character, index) => {
                const state = getCharacterState(paragraph, typed, index);
                const className =
                  state === "correct"
                    ? "text-emerald-500"
                    : state === "wrong"
                      ? "bg-red-100 text-red-600"
                      : "text-foreground/80";

                return (
                  <span key={`${character}-${index}`} className={`${className} rounded-sm transition-colors`}>
                    {character}
                  </span>
                );
              })}
            </div>

            <textarea
              value={typed}
              onChange={(event) => handleChange(event.target.value)}
              disabled={failed || completed}
              placeholder="Prove your alleged discipline..."
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              className={`mt-4 min-h-40 w-full rounded-[1.75rem] border bg-card px-4 py-4 text-sm outline-none placeholder:text-muted-foreground ${
                failed
                  ? "border-red-400/45 shadow-[0_0_30px_-12px_rgba(248,113,113,0.35)]"
                  : completed
                    ? "border-emerald-400/45 shadow-[0_0_30px_-12px_rgba(74,222,128,0.3)]"
                    : "border-foreground/10 bg-card"
              }`}
            />

            <AnimatePresence mode="wait">
              {failed ? (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-2xl border border-red-400/30 bg-red-50 p-4 text-sm text-red-600"
                >
                  Nice try, disaster.
                </motion.div>
              ) : completed ? (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-50 p-4 text-sm text-emerald-600"
                >
                  Congratulations. Terrible decision unlocked.
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="mt-4 flex gap-2">
              <button
                onClick={retry}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-card py-3 text-xs font-bold uppercase tracking-widest text-foreground shadow-sm"
              >
                <RefreshCw className="h-4 w-4 text-foreground" />
                New Paragraph
              </button>
              <button
                onClick={completed ? onClose : retry}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)]"
              >
                <CircleCheckBig className="h-4 w-4" />
                {completed ? "Return Armed" : "Reset Attempt"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
