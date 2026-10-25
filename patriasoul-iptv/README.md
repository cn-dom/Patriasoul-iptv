# PatriaSoul IPTV

Windows desktop IPTV player scaffold for personal M3U/M3U8 playlists.

## Current features

- Import a local `.m3u` or `.m3u8` playlist.
- Import a remote playlist URL when the source permits cross-origin requests.
- Parse channel/title names, group categories and optional logo metadata.
- Search the playlist and filter by category.
- Save favorites locally in the app profile.
- Play HLS `.m3u8` streams with HLS.js where supported, or direct browser-supported media URLs.
- Croatian interface with dark blue styling and red-white-blue accents.
- Windows NSIS installer and portable executable build targets.

## Run locally

Install Node.js LTS, then from this directory:

```powershell
npm install
npm start
```

Check JavaScript syntax:

```powershell
npm run check
```

Build Windows installer and portable version:

```powershell
npm run dist:win
```

Artifacts are written to `release/`.

## Playlist and content notes

This application is a player only. It does not supply TV channels, movies, series, subscriptions, or access credentials. Use only streams and playlists you are authorized to access. A stream may be offline, geo-restricted, blocked by its provider, or encoded in an unsupported format.

The existing root-level `playlist.m3u` and `UPUTE.txt` are intentionally left untouched. The app does not automatically publish or embed that playlist into its installer; select the file locally in the application.

**Repository privacy warning:** the repository containing the root playlist is currently public. The existing `UPUTE.txt` says not to publish that playlist publicly. Review repository visibility and stream rights before sharing this repository or its contents. Do not copy playlist URLs into public documentation.

## Security

- Electron Node integration is disabled in the renderer.
- Context isolation and sandboxing are enabled.
- External links are handed off to the default browser.
- Favorites are stored locally in the Electron renderer profile.

This is an initial development scaffold, not yet a fully verified production player. Validate the build and test streams from authorized sources before wider distribution.
