export interface MigrationFlowProps {
  settingsText: string;
  migrationStepsText: string;
  settingsClick: () => void;
  showInfo: boolean;
  currentStep: number;
}
