# Walkthrough assets

`walkthrough.gif` is assembled from four screenshots of the production sidebar UI in the local documentation fixture. The background is `x-open.jpg`, a screenshot captured on X after names, handles, profile imagery, posts, and signed-in identity were masked locally. The eight foreground names, handles, and ranking counts are fictional. These assets do not establish live ranking performance.

To replay the interactive fixture, run `node tests/server.cjs` and open `http://127.0.0.1:8766/demo_profile?scenario=demo`. The first page contains eight fictional people; ranking requests return deterministic fictional counts. The fixture is excluded from extension builds.

The GIF holds the minimized pill for 2 seconds, the open list for 3 seconds, automatic calculation for 3 seconds, and the final ranking for 5 seconds. No developer tools, terminal, or request log appears in the recording.
