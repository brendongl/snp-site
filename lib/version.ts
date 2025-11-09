/**
 * Application Version Configuration
 *
 * This file contains version information displayed to users
 * and used for cache busting and feature flags.
 */

export const VERSION = '1.7.5';
export const BUILD_DATE = '2025-11-09';
export const CHANGELOG_URL = '/docs/CHANGELOG.md';

export const FEATURES = {
  boardGames: true,
  contentChecker: true,
  serverCache: true,
  staffMode: true,
  spinnerWheel: true,
  advancedFilters: true,
  vikunjaTasks: true,
} as const;

export function getVersionInfo() {
  return {
    version: VERSION,
    buildDate: BUILD_DATE,
    features: FEATURES,
  };
}

export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}
