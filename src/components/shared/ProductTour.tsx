'use client';

export interface TourStep {
  selector: string;
  titleKey: string;
  descKey: string;
}

export function startProductTour() {
  // Tour disabled per user request
}

export function getStepsForPanel(): TourStep[] {
  return [];
}

export function ProductTour() {
  return null;
}
