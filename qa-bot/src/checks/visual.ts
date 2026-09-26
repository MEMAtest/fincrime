import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export interface VisualDiff {
  changedRatio: number;
  diffFile?: string;
  sizeChanged: boolean;
}

/** Compare a screenshot with its stored baseline. Returns undefined when there is no baseline yet. */
export function compareWithBaseline(current: string, baseline: string, diffOut: string): VisualDiff | undefined {
  if (!fs.existsSync(baseline)) return undefined;
  const a = PNG.sync.read(fs.readFileSync(baseline));
  const b = PNG.sync.read(fs.readFileSync(current));
  if (a.width !== b.width || a.height !== b.height) return { changedRatio: 1, sizeChanged: true };
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12, includeAA: false });
  const ratio = changed / (a.width * a.height);
  if (ratio > 0) {
    fs.mkdirSync(path.dirname(diffOut), { recursive: true });
    fs.writeFileSync(diffOut, PNG.sync.write(diff));
  }
  return { changedRatio: ratio, diffFile: ratio > 0 ? diffOut : undefined, sizeChanged: false };
}

export function updateBaseline(current: string, baseline: string) {
  fs.mkdirSync(path.dirname(baseline), { recursive: true });
  fs.copyFileSync(current, baseline);
}
