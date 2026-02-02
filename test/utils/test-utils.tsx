import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with necessary providers
 * Usage: renderWithProviders(<YourComponent />)
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // For now, we don't have global providers like Redux Provider or Router
  // If you add global context providers later, wrap them here
  
  return render(ui, { ...options });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
