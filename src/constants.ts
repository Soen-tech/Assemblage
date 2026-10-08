import { Whisky, ClubEvent } from './types';

export const RECENT_SCANS: Whisky[] = [
  {
    id: '1',
    name: 'Macallan 18 Year',
    distillery: 'Macallan',
    region: 'Speyside',
    age: '18y',
    abv: '43%',
    description: 'Sherry Oak, 2023 Release. A rich and complex single malt.',
    tastingNotes: ['DRIED FRUIT', 'GINGER', 'PEATED'],
    swriProfile: { peaty: 2.5, fruity: 8.5, floral: 3.5, cereal: 4.5, intensity: 8.0 },
    image: 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: '2',
    name: 'Lagavulin 16',
    distillery: 'Lagavulin',
    region: 'Islay',
    age: '16y',
    abv: '43%',
    description: 'The definitive Islay malt—untameable, peaty and intense.',
    tastingNotes: ['SMOKY', 'SEA SALT', 'PEAT'],
    swriProfile: { peaty: 9.5, fruity: 3.5, floral: 1.5, cereal: 5.5, intensity: 9.0 },
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800'
  }
];

export const JOURNAL_ENTRIES: Whisky[] = [
  {
    id: '3',
    name: 'Laphroaig Lore',
    distillery: 'Laphroaig',
    region: 'Islay',
    age: 'NAS',
    abv: '48%',
    description: 'Deep, smoky, and complex with a lingering maritime finish.',
    tastingNotes: ['Peated', 'Islay', '48% ABV'],
    swriProfile: { peaty: 9.0, fruity: 2.5, floral: 2.0, cereal: 4.0, intensity: 8.5 },
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800',
    date: 'OCT 12, 2023',
    rating: 5
  },
  {
    id: '4',
    name: 'The Macallan Rare Cask',
    distillery: 'Macallan',
    region: 'Speyside',
    age: 'NAS',
    abv: '43%',
    description: 'Incredibly smooth with rich raisin and vanilla notes.',
    tastingNotes: ['Sherry Oak', 'Speyside', '43% ABV'],
    swriProfile: { peaty: 1.5, fruity: 9.0, floral: 4.5, cereal: 3.0, intensity: 7.5 },
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&q=80&w=800',
    date: 'SEPT 28, 2023',
    rating: 4
  }
];

export const FEATURED_EVENTS: ClubEvent[] = [];

export const BOUTIQUE_ITEMS: any[] = [];
