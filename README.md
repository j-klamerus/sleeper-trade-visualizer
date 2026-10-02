# Huddle — Sleeper Trade Builder

A small browser-only fantasy football trade visualizer for public Sleeper leagues. It fetches a user's NFL leagues and the selected league's teams/rosters from Sleeper's public API, then lets you assign players to trade destinations and copy a text summary.

## Start locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To make a production build, run `npm run build`; `npm run preview` serves that build locally.

## Simplest structure

- `src/main.jsx`: React UI, direct Sleeper API calls, roster formatting, trade assignment state.
- `src/styles.css`: responsive vanilla CSS.
- `index.html`: Vite entry point.

No backend or API key is used.

## Sleeper endpoints

The app uses Sleeper's documented public read endpoints:

- `GET /user/{username}` — resolve the account to a Sleeper user ID.
- `GET /user/{user_id}/leagues/nfl/{season}` — list NFL leagues for that season.
- `GET /league/{league_id}/rosters` and `/users` — load each roster and its team owner/display name.
- `GET /players/nfl` — map roster player IDs to readable names and positions.

Sleeper documents these at [docs.sleeper.com](https://docs.sleeper.com/). The API is read-only and public.

## Current limitations

- The trade builder is a visual planning tool only. It does not create or submit a trade in Sleeper.
- Sleeper returns roster player IDs; traded draft picks and valuation data are not included.
- The NFL player directory is a large request and is downloaded once per app session. If it cannot load, IDs remain visible as fallback names.
- The app relies on the browser reaching Sleeper's API directly. A network or CORS restriction will surface as a loading error; there is no proxy/backend fallback.
