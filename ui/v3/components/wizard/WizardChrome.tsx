import { FC, ReactNode, useCallback, useMemo } from 'react';

import { isStepComplete, StepContext } from './steps';
import { StepGateProvider } from './StepGateContext';
import { useWizardNavigation } from './useWizardNavigation';
import { useWizardSource } from './useWizardSource';
import WizardAppBar from './WizardAppBar';
import WizardFooter from './WizardFooter';
import WizardStepTracker from './WizardStepTracker';
import WizardToast from './WizardToast';

/**
 * The persistent frame every step panel renders inside (feature.md UC-1, UC-6).
 *
 * Composition is app bar → tracker → panel → footer, and this component owns
 * all three chrome regions plus every step transition. A panel is a child: it
 * publishes a gate and renders its own body, and does not navigate.
 */
const WizardChrome: FC<{ children?: ReactNode }> = ({ children }) => {
  const { activeIndex, isFirst, projectId, goTo, goBack, goNext } = useWizardNavigation();

  // Read once for the whole chrome — the app bar and the tracker share it
  // rather than fetching per region (NFR-4).
  /*
    `activeIndex` is passed so the documents are re-read on every step change. Without it
    the chrome read them once per project, and a successful export left the Source step
    un-ticked until the page was refreshed.
  */
  const { sourceName, sourceReady, destinationPersisted } = useWizardSource(projectId, activeIndex);

  const stepContext = useMemo<StepContext>(
    () => ({ sourceReady, destinationPersisted }),
    [sourceReady, destinationPersisted]
  );

  const isComplete = useCallback(
    (index: number) => isStepComplete(index, activeIndex, stepContext),
    [activeIndex, stepContext]
  );

  return (
    <StepGateProvider onAdvanced={goNext}>
      <div
        data-testid="wizard-chrome"
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <WizardAppBar activeIndex={activeIndex} sourceName={sourceName} />
        <WizardStepTracker activeIndex={activeIndex} isComplete={isComplete} onSelect={goTo} />

        <div
          data-chrome-region="panel"
          style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '24px' }}
        >
          {children}
          {/* Shared across every step, so Content mapping, Preview and Migrate reuse it
              rather than each growing its own (cs-audit-report FR-9.1). */}
          <WizardToast />
        </div>

        <WizardFooter
          activeIndex={activeIndex}
          isFirst={isFirst}
          onBack={goBack}
          stepContext={stepContext}
        />
      </div>
    </StepGateProvider>
  );
};

export default WizardChrome;
