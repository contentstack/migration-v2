import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * The contract by which a step panel tells the chrome whether it may advance,
 * and how to do the advancing (feature.md FR-6.4, FR-6.5).
 *
 * Deliberately React context rather than Redux: `satisfied` is per-render UI
 * state and `advance` is a callback — neither is serialisable or persisted.
 *
 * The orchestration (await the work, navigate only on success, guard against a
 * second run) lives HERE rather than in the footer, so that the footer's action
 * and any in-panel advance button share one gate and one action and can never
 * disagree — feature.md FR-4.5.
 */
export interface StepGate {
  satisfied: boolean;
  /** Why the gate is closed — takes precedence over the step's generic copy. */
  blockedReason?: string;
  /** The panel's own work. Resolve `true` to allow the wizard to move on. */
  advance?: () => Promise<boolean>;
}

/** A step that registers nothing is treated as satisfied (FR-6.5). */
const OPEN_GATE: StepGate = { satisfied: true };

interface StepGateValue {
  gate: StepGate;
  registerGate: (gate: StepGate | null) => void;
  /** Runs the current gate's advance work; calls `onAdvanced` only on success. */
  runAdvance: () => Promise<void>;
  advancing: boolean;
}

const StepGateContext = createContext<StepGateValue | null>(null);

export const StepGateProvider: FC<{ onAdvanced: () => void; children: ReactNode }> = ({
  onAdvanced,
  children,
}) => {
  const [gate, setGate] = useState<StepGate>(OPEN_GATE);
  const [advancing, setAdvancing] = useState(false);
  // A ref, not the state, guards re-entry: two clicks in the same tick would
  // both read a stale `advancing === false` and both start the work. For the
  // Destination step that would mint two management tokens (trd.md TRR-3).
  const inFlight = useRef(false);

  const registerGate = useCallback((next: StepGate | null) => {
    setGate(next ?? OPEN_GATE);
  }, []);

  const runAdvance = useCallback(async () => {
    // Refused here, not merely on a disabled button — the guard must hold even
    // when the orchestrator is invoked directly (feature.md FR-4.4, AC-3.4).
    if (!gate.satisfied || inFlight.current) return;

    if (!gate.advance) {
      onAdvanced();
      return;
    }

    inFlight.current = true;
    setAdvancing(true);
    try {
      const ok = await gate.advance();
      if (ok) onAdvanced();
    } catch {
      // A rejection is a failure, never an advance. The panel surfaces its own
      // error; the chrome only declines to navigate (feature.md EC-3).
    } finally {
      inFlight.current = false;
      setAdvancing(false);
    }
  }, [gate, onAdvanced]);

  const value = useMemo(
    () => ({ gate, registerGate, runAdvance, advancing }),
    [gate, registerGate, runAdvance, advancing]
  );

  return <StepGateContext.Provider value={value}>{children}</StepGateContext.Provider>;
};

/**
 * Panels call this to publish their gate. Returns the runner the panel's own
 * advance control should use, so that control and the footer's action run the
 * same work behind the same re-entrancy guard (FR-4.5).
 *
 * Outside a provider — a panel rendered standalone, as in its own unit tests —
 * registration is a no-op and the returned runner invokes the panel's advance
 * work directly, so the panel keeps working on its own.
 */
export const useRegisterStepGate = (gate: StepGate): (() => Promise<void>) => {
  const ctx = useContext(StepGateContext);
  const register = ctx?.registerGate;
  const { satisfied, blockedReason, advance } = gate;

  useEffect(() => {
    if (!register) return;
    register({ satisfied, blockedReason, advance });
    return () => register(null);
  }, [register, satisfied, blockedReason, advance]);

  const runLocally = useCallback(async () => {
    if (!satisfied || !advance) return;
    await advance();
  }, [satisfied, advance]);

  return ctx ? ctx.runAdvance : runLocally;
};

/** The chrome — and any in-panel advance control — reads the gate through this. */
export const useStepGate = (): StepGateValue => {
  const ctx = useContext(StepGateContext);
  if (!ctx) {
    // Rendered outside a provider (e.g. a panel used standalone): behave as an
    // open gate rather than crashing the panel.
    return {
      gate: OPEN_GATE,
      registerGate: () => {},
      runAdvance: async () => {},
      advancing: false,
    };
  }
  return ctx;
};
