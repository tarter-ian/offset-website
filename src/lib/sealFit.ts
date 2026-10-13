// Fits a badge's name inside the seal's inner ring (Ian, 2026-10-13: no text may
// touch a ring). The seal is drawn on a 120 by 120 grid; the name sits inside the
// ring of radius 39.5, with the small italic "offset" under a short rule.

/** Fraunces semibold advance widths, in ems, measured in Chromium. Unknown letters count as wide. */
const EM: Record<string, number> = {
  a: 0.56, b: 0.61, c: 0.52, d: 0.62, e: 0.53, f: 0.4, g: 0.58, h: 0.64, i: 0.32, j: 0.32, k: 0.62, l: 0.32, m: 0.96,
  n: 0.64, o: 0.6, p: 0.63, q: 0.61, r: 0.48, s: 0.49, t: 0.39, u: 0.63, v: 0.56, w: 0.84, x: 0.55, y: 0.57, z: 0.49,
  A: 0.74, B: 0.71, C: 0.7, D: 0.8, E: 0.66, F: 0.61, G: 0.77, H: 0.85, I: 0.41, J: 0.51, K: 0.79, L: 0.63, M: 0.93,
  N: 0.77, O: 0.8, P: 0.7, Q: 0.8, R: 0.75, S: 0.61, T: 0.68, U: 0.75, V: 0.65, W: 1, X: 0.73, Y: 0.62, Z: 0.64,
  " ": 0.22, ",": 0.28, "-": 0.36, "&": 0.8,
};

/** A line's width at a font size, in grid units. */
export const textWidth = (s: string, fs: number) => [...s].reduce((w, ch) => w + (EM[ch] ?? 0.8), 0) * fs;

/** How far from the center any letter may reach: the inner ring's inside edge, less a clear gap. */
export const FIELD_R = 36;
const CENTER = 60;
/** How far letters reach above and below their baseline, in ems: capitals and ascenders up, descenders down. */
const ASCENT = 0.74;
const DESCENT = 0.23;
const LEADING = 1.0;
/** The rule and italic "offset" under the name: gap, rule, gap, then lettering about 8 tall and 31 wide. */
const TAIL = { gap: 2.4, below: 9.6, height: 11.4, width: 31 };

export interface SealLayout {
  lines: string[];
  /** Font size of the name, in grid units. */
  fs: number;
  /** Baseline of each line. */
  baselines: number[];
  /** Where the short rule and "offset" go, when there is a tail. */
  rule?: number;
  tail?: number;
}

/** Every way to set the words on one to three lines, in order. */
function splits(words: string[]): string[][] {
  const out: string[][] = [[words.join(" ")]];
  for (let i = 1; i < words.length; i++) {
    out.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
    for (let j = i + 1; j < words.length; j++) out.push([words.slice(0, i).join(" "), words.slice(i, j).join(" "), words.slice(j).join(" ")]);
  }
  return out;
}

/** Lays out the lines at a size, centered as a block, or null when a corner of any line would cross the field. */
function place(lines: string[], fs: number, tail: boolean): SealLayout | null {
  const lh = fs * LEADING;
  const nameHeight = ASCENT * fs + (lines.length - 1) * lh + DESCENT * fs;
  const height = nameHeight + (tail ? TAIL.height + TAIL.gap : 0);
  const top = CENTER - height / 2;
  const baselines = lines.map((_, i) => top + ASCENT * fs + i * lh);
  const boxes = lines.map((l, i) => ({ half: textWidth(l, fs) / 2, top: baselines[i] - ASCENT * fs, bottom: baselines[i] + DESCENT * fs }));
  const rule = top + nameHeight + TAIL.gap;
  if (tail) boxes.push({ half: TAIL.width / 2, top: rule, bottom: rule + TAIL.height });
  const inside = boxes.every((b) => Math.hypot(b.half, Math.max(Math.abs(b.top - CENTER), Math.abs(b.bottom - CENTER))) <= FIELD_R);
  return inside ? { lines, fs, baselines, ...(tail ? { rule, tail: rule + TAIL.below } : {}) } : null;
}

/**
 * The biggest size that fits, from max down to min in quarter steps, over every
 * one to three line split. A split with more lines must win by a clear step to be
 * used, so short names stay on one line and two-word names on two.
 */
export function fitSeal(name: string, { tail = true, max = 19, min = 10.5 }: { tail?: boolean; max?: number; min?: number } = {}): SealLayout {
  let best: SealLayout | null = null;
  for (const lines of splits(name.split(" "))) {
    for (let fs = max; fs >= min; fs -= 0.25) {
      const fit = place(lines, fs, tail);
      if (!fit) continue;
      if (!best || fit.fs > best.fs + (lines.length > best.lines.length ? 1.5 : 0) || (fit.fs === best.fs && fit.lines.length === best.lines.length && balance(fit) < balance(best)))
        best = fit;
      break;
    }
  }
  return best ?? place(name.split(" "), min, tail) ?? { lines: name.split(" "), fs: min, baselines: [] };
}

/** How uneven the lines are; lower reads calmer. */
const balance = (l: SealLayout) => {
  const w = l.lines.map((x) => textWidth(x, 1));
  return Math.max(...w) - Math.min(...w);
};
