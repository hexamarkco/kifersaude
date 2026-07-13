import { Check } from 'lucide-react';

import { cx } from '../../lib/cx';

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepStatus = 'completed' | 'active' | 'pending';

export type StepperProps = {
  currentStep: number;
  steps: Array<{ label: string; description?: string }>;
  orientation?: StepperOrientation;
  className?: string;
};

export function Stepper({ currentStep, steps, orientation = 'horizontal', className }: StepperProps) {
  return (
    <div
      className={cx(
        'kds-stepper',
        orientation === 'vertical' && 'kds-stepper-vertical',
        className,
      )}
      role="list"
    >
      {steps.map((step, index) => {
        const status: StepStatus =
          index < currentStep ? 'completed' : index === currentStep ? 'active' : 'pending';

        return (
          <div
            key={index}
            className={cx('kds-stepper-step', `kds-stepper-step-${status}`)}
            role="listitem"
          >
            <div className="kds-stepper-indicator">
              <div className="kds-stepper-circle">
                {status === 'completed' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={cx('kds-stepper-line', status === 'completed' && 'kds-stepper-line-completed')} />
              )}
            </div>
            <div className="kds-stepper-content">
              <span className="kds-stepper-label">{step.label}</span>
              {step.description && (
                <span className="kds-stepper-description">{step.description}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type ProgressProps = {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
};

export function Progress({ value, max = 100, size = 'md', showLabel = false, className }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cx('kds-progress', `kds-progress-${size}`, className)}>
      <div className="kds-progress-track">
        <div
          className="kds-progress-fill"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <span className="kds-progress-label">{Math.round(percentage)}%</span>
      )}
    </div>
  );
}
