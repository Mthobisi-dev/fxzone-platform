export type WorkspaceDensity = 'compact' | 'comfortable' | 'spacious';

export function densityClass(density: WorkspaceDensity): string {
  switch (density) {
    case 'compact':
      return 'density-compact space-y-2';
    case 'spacious':
      return 'density-spacious space-y-7';
    default:
      return 'density-comfortable space-y-5';
  }
}
