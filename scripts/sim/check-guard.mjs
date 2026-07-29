import { guardLive } from "./lib/simulation-guard.mjs"
await guardLive({ requireMarker: process.argv.includes("--require-marker") })
process.exit(0)
