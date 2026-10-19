// Lets a test write again the data it checks, when asked to
// (UPDATE_LANDING=1 npx vitest run …), with Node's own modules.
import { writeFileSync } from "node:fs";

export const updating = Boolean(process.env.UPDATE_LANDING);

export function writeJson(url, data) {
  writeFileSync(url, JSON.stringify(data) + "\n");
}
