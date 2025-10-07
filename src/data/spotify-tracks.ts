export interface SpotifyTrackEntry {
  title: string;
  artist: string;
  spotifyTrackId: string;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const createKey = (title: string, artist: string) => `${normalize(title)}::${normalize(artist)}`;

const tracks: SpotifyTrackEntry[] = [
  {
    title: 'Volare (Nel blu dipinto di blu)',
    artist: 'Domenico Modugno',
    spotifyTrackId: '5zyrEv4F3FaLECI8TOKpFM',
  },
];

export const spotifyTrackMap = new Map(
  tracks.map((track) => [createKey(track.title, track.artist), track] as const)
);

export const getSpotifyTrackId = (title: string, artist: string) => {
  const key = createKey(title, artist);
  return spotifyTrackMap.get(key)?.spotifyTrackId;
};
