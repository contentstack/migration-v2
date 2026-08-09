import { FC, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { V3Dispatch, V3RootState } from '../../store';
import { toastActions, TOAST_DISMISS_MS } from '../../store/slice/toast.slice';

/**
 * Shared wizard toast (cs-audit-report FR-9.1 … FR-9.4, TR-21).
 *
 * Lives with the chrome rather than with the Audit step, so Content mapping, Preview and
 * Migrate can reuse it instead of each growing its own.
 *
 * FR-9.4 keeps it strictly non-load-bearing: it confirms a change the impact panel and
 * the affected control already show. That is what makes it safe as a P1 fast-follow —
 * removing it costs an acknowledgement, never information.
 */
const AUTO_DISMISS = TOAST_DISMISS_MS;

const WizardToast: FC = () => {
  const dispatch = useDispatch<V3Dispatch>();
  const queue = useSelector((s: V3RootState) => s.toast?.queue ?? []);
  const current = queue[queue.length - 1];

  useEffect(() => {
    if (!current) return undefined;
    const timer = setTimeout(() => {
      dispatch(toastActions.dismiss(current.id));
    }, AUTO_DISMISS);
    // Cleared on unmount and whenever a newer toast supersedes this one, so a rapid
    // sequence cannot leave an orphaned timer dismissing the wrong message.
    return () => clearTimeout(timer);
  }, [current, dispatch]);

  if (!current) return null;

  return (
    <div className="wizard-toast" role="status" aria-live="polite">
      {current.text}
    </div>
  );
};

export default WizardToast;
