export interface RankingHighlight {
  position: number;
  title: string;
  artist: string;
  movement: string;
  movementValue: number | null;
  peak: number;
  notes?: string;
}

const rankingHighlightMap: Record<string, RankingHighlight[]> = {
  'top-220-neon-nights-1984-08-04': [
    {
      position: 1,
      title: 'When Doves Cry',
      artist: 'Prince',
      movement: '—',
      movementValue: null,
      peak: 1,
      notes: 'Still commanding club floors with the extended mix.',
    },
    {
      position: 2,
      title: 'Sweet Dreams (Are Made of This)',
      artist: 'Eurythmics',
      movement: '+2',
      movementValue: 2,
      peak: 2,
      notes: 'New radio edit boosts national rotation.',
    },
    {
      position: 14,
      title: 'Automatic',
      artist: 'The Pointer Sisters',
      movement: '+6',
      movementValue: 6,
      peak: 14,
      notes: 'Synth bassline finds new life in after-hours mixes.',
    },
    {
      position: 42,
      title: 'Together in Electric Dreams',
      artist: 'Philip Oakey & Giorgio Moroder',
      movement: 'new',
      movementValue: 1000,
      peak: 42,
      notes: 'Import single debuts thanks to record-pool demand.',
    },
    {
      position: 117,
      title: 'Relax',
      artist: 'Frankie Goes to Hollywood',
      movement: '-8',
      movementValue: -8,
      peak: 7,
      notes: 'Momentum cools as Top 40 shifts toward fall ballads.',
    },
  ],
  'hot-100-july-31-1999': [
    {
      position: 1,
      title: 'Smooth',
      artist: 'Santana feat. Rob Thomas',
      movement: '—',
      movementValue: null,
      peak: 1,
      notes: 'Latin rock mainstay retains the crown.',
    },
    {
      position: 2,
      title: 'Genie In A Bottle',
      artist: 'Christina Aguilera',
      movement: '+3',
      movementValue: 3,
      peak: 2,
      notes: 'Breakout single surges on TRL airplay.',
    },
    {
      position: 5,
      title: 'Bills, Bills, Bills',
      artist: "Destiny's Child",
      movement: '-2',
      movementValue: -2,
      peak: 1,
      notes: 'Slips as summer ballads gain spins.',
    },
    {
      position: 12,
      title: "Someday We'll Know",
      artist: 'New Radicals',
      movement: 'new',
      movementValue: 1000,
      peak: 12,
      notes: 'Follow-up single earns a soft landing on the chart.',
    },
    {
      position: 38,
      title: 'No Scrubs',
      artist: 'TLC',
      movement: '-5',
      movementValue: -5,
      peak: 1,
      notes: 'Former #1 continues a graceful descent.',
    },
  ],
  'bottom-60-late-night-rebounds-1984-09-15': [
    {
      position: 241,
      title: 'The Warrior',
      artist: 'Scandal feat. Patty Smyth',
      movement: '-12',
      movementValue: -12,
      peak: 7,
      notes: 'Slipping but still a staple on rock countdowns.',
    },
    {
      position: 248,
      title: 'Self Control',
      artist: 'Laura Branigan',
      movement: '-20',
      movementValue: -20,
      peak: 4,
      notes: 'Late-night video rotations keep curiosity alive.',
    },
    {
      position: 253,
      title: 'Borderline',
      artist: 'Madonna',
      movement: '-5',
      movementValue: -5,
      peak: 10,
      notes: 'Cooling as follow-up singles overtake attention.',
    },
    {
      position: 259,
      title: "Catch Me I'm Falling",
      artist: 'Real Life',
      movement: 'new',
      movementValue: 1000,
      peak: 259,
      notes: 'Breakout synth-pop act enters the rebound zone.',
    },
    {
      position: 264,
      title: 'I Can Dream About You',
      artist: 'Dan Hartman',
      movement: '-18',
      movementValue: -18,
      peak: 6,
      notes: 'Soundtrack favorite holds on thanks to adult contemporary spins.',
    },
  ],
};

export function getRankingHighlights(slug: string): RankingHighlight[] {
  return rankingHighlightMap[slug] ?? [];
}
