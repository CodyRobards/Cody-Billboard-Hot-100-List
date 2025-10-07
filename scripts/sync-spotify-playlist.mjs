#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const TARGET_FILE = path.resolve(projectRoot, "src", "data", "spotify-tracks.ts");

const ensureEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required ${name} environment variable.`);
  return value;
};

const playlistId = process.argv[2];
if (!playlistId) {
  console.error("Usage: node scripts/sync-spotify-playlist.mjs <playlistId>");
  process.exit(1);
}

const requestAccessToken = async () => {
  const clientId = ensureEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = ensureEnv("SPOTIFY_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) {
    throw new Error(`Failed to obtain access token (${res.status})`);
  }

  const data = await res.json();
  return data.access_token;
};

const normalize = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");
const createKey = (title, artist) => `${normalize(title)}::${normalize(artist)}`;

// 🧹 Clean up Spotify titles — removes remaster/version suffixes
const cleanTitle = (title) => {
  return (
    title
      // Remove " - 2001 Remaster", " - Remastered 2011", " - Mono Version", etc.
      .replace(/\s*-\s*(Remaster(ed)?(\s\d{4})?|Mono|Stereo|Version.*|Single Mix.*)$/i, "")
      // Remove trailing whitespace and punctuation
      .replace(/[\s\-–]+$/, "")
      .trim()
  );
};

const fetchPlaylistTracks = async (playlist, token) => {
  let url = new URL(`https://api.spotify.com/v1/playlists/${playlist}/tracks`);
  url.searchParams.set("fields", "items(track(id,name,artists(name))),next");
  url.searchParams.set("limit", "100"); // ✅ Spotify API limit

  const entries = new Map();

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify request failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const track = item.track;
      if (!track?.id || !track?.name || !track.artists?.length) continue;

      const primaryArtist = track.artists[0].name;
      const title = cleanTitle(track.name); // ✅ Clean title here
      const key = createKey(title, primaryArtist);

      entries.set(key, {
        title,
        artist: primaryArtist,
        spotifyTrackId: track.id,
      });
    }

    url = data.next ? new URL(data.next) : null;
  }

  return Array.from(entries.values()).sort((a, b) => a.title.localeCompare(b.title));
};

const renderModule = (tracks) => {
  const rows = tracks
    .map(
      (track) =>
        `  { title: ${JSON.stringify(track.title)}, artist: ${JSON.stringify(
          track.artist
        )}, spotifyTrackId: ${JSON.stringify(track.spotifyTrackId)} },`
    )
    .join("\n");

  return `export interface SpotifyTrackEntry {
  title: string;
  artist: string;
  spotifyTrackId: string;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\\s+/g, ' ');
const createKey = (title: string, artist: string) => \`\${normalize(title)}::\${normalize(artist)}\`;

const tracks: SpotifyTrackEntry[] = [
${rows}
];

export const spotifyTrackMap = new Map(
  tracks.map((track) => [createKey(track.title, track.artist), track] as const)
);

export const getSpotifyTrackId = (title: string, artist: string) => {
  const key = createKey(title, artist);
  const exact = spotifyTrackMap.get(key)?.spotifyTrackId;
  if (exact) return exact;

  // Fallback: partial match by substring
  const normalizedTitle = normalize(title);
  const normalizedArtist = normalize(artist);

  for (const [storedKey, entry] of spotifyTrackMap.entries()) {
    const [storedTitle, storedArtist] = storedKey.split("::");
    const titleMatch =
      storedTitle.includes(normalizedTitle) || normalizedTitle.includes(storedTitle);
    const artistMatch =
      storedArtist.includes(normalizedArtist) || normalizedArtist.includes(storedArtist);
    if (titleMatch && artistMatch) {
      return entry.spotifyTrackId;
    }
  }

  return undefined;
};
`;
};

const main = async () => {
  const token = await requestAccessToken();
  const tracks = await fetchPlaylistTracks(playlistId, token);
  const contents = renderModule(tracks);
  await writeFile(TARGET_FILE, `${contents}`, "utf8");
  console.log(`Wrote ${tracks.length} tracks to ${path.relative(projectRoot, TARGET_FILE)}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
