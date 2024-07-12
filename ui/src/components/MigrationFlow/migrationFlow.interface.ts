/**
 * Represents the props for the MigrationFlow component.
 */
export interface MigrationFlowProps {
  /**
   * The text to display for the settings.
   */
  settingsText: string;

  /**
   * The text to display for the migration steps.
   */
  migrationStepsText: string;

  /**
   * A callback function that is called when the settings are clicked.
   */
  settingsClick: () => void;

  /**
   * A boolean value indicating whether to show the info.
   */
  showInfo: boolean;

  /**
   * The current step of the migration flow.
   */
  currentStep: number;
}
