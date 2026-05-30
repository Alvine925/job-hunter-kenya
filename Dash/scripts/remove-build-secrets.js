import { rmSync } from "node:fs";

const secretArtifacts = ["dist/server/.dev.vars"];

for (const artifact of secretArtifacts) {
  rmSync(artifact, { force: true });
}
