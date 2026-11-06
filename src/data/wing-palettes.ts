import type { WingId } from './wings';

// Wayfinding tones inspired by works in each wing. These color interface
// details only; scan materials, lighting and textures remain independent.
export const wingPalettes: Record<WingId, { accent: string; inspiration: string }> = {
  'near-east': { accent: '#8fc8cc', inspiration: 'Blue faience, including the Met hippopotamus' },
  'greece-rome': { accent: '#d8cfb9', inspiration: 'Marble and the pale surfaces of historical casts' },
  europe: { accent: '#9fc5b8', inspiration: 'Bronze patina, including the Copenhagen Thinker' },
  asia: { accent: '#e0c885', inspiration: 'Gilded bronze, including the Pensive Bodhisattva' },
  africa: { accent: '#d7a49b', inspiration: 'Carved and painted masks and figures' },
  'americas-oceania': { accent: '#c7b3d9', inspiration: 'The painted surfaces and varied materials of the collection' },
};

export function wingAccent(id: string): string {
  return wingPalettes[id as WingId]?.accent ?? '#e9c86b';
}
