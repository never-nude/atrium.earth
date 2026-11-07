import type { WingId } from './wings';

// Wayfinding tones inspired by works in each wing. These color interface
// details only; scan materials, lighting and textures remain independent.
export const wingPalettes: Record<WingId, { accent: string; inspiration: string }> = {
  europe: { accent: '#48e6ff', inspiration: 'Cool blue wayfinding, shared with Europe on the globe' },
  asia: { accent: '#ffd36d', inspiration: 'Gilded bronze, including the Pensive Bodhisattva' },
  africa: { accent: '#ff846a', inspiration: 'Warm painted surfaces and terracotta' },
  americas: { accent: '#fa7bd7', inspiration: 'Vivid painted surfaces across the collection' },
  oceania: { accent: '#81ffd0', inspiration: 'Pacific greens and the globe’s Oceania markers' },
};

export function wingAccent(id: string): string {
  return wingPalettes[id as WingId]?.accent ?? '#e9c86b';
}
