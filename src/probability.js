/**
 * Rolling dice a lot of times.
 *
 * The law of large numbers is usually taught as "do it enough and the
 * relative frequency settles on the probability", which is true — and is
 * routinely misread as "the counts even out". They do not: the gap between
 * the actual count and n/6 typically *grows*, roughly like √n. Both numbers
 * are tracked here so the two can be shown side by side.
 */

export const EXPERIMENTS = [
  {
    key: "die",
    label: "サイコロ 1 個",
    outcomes: [1, 2, 3, 4, 5, 6],
    theory: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
    theoryLabel: "どの目も 1/6",
    roll: () => 1 + Math.floor(Math.random() * 6),
    watch: 1,
    watchLabel: "1 の目",
  },
  {
    key: "coin",
    label: "コイン",
    outcomes: ["表", "裏"],
    theory: [1 / 2, 1 / 2],
    theoryLabel: "表も裏も 1/2",
    roll: () => (Math.random() < 0.5 ? "表" : "裏"),
    watch: "表",
    watchLabel: "表",
  },
  {
    key: "twodice",
    label: "サイコロ 2 個の和",
    outcomes: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    theory: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((k) => k / 36),
    theoryLabel: "7 がいちばん出やすく 6/36、2 と 12 は 1/36",
    roll: () => 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6),
    watch: 7,
    watchLabel: "和が 7",
  },
];

export function experimentByKey(key) {
  return EXPERIMENTS.find((e) => e.key === key) || EXPERIMENTS[0];
}

export class Tally {
  constructor(spec) {
    this.spec = spec;
    this.counts = spec.outcomes.map(() => 0);
    this.n = 0;
    // relative frequency of the watched outcome, sampled as it goes
    this.history = [];
    this.nextMark = 1;
  }

  add(times) {
    for (let i = 0; i < times; i++) {
      const v = this.spec.roll();
      const idx = this.spec.outcomes.indexOf(v);
      if (idx >= 0) this.counts[idx]++;
      this.n++;
      if (this.n >= this.nextMark) {
        this.history.push([this.n, this.watchedRel()]);
        // dense at first, then log-spaced so the tail stays cheap to keep
        this.nextMark = Math.max(this.nextMark + 1, Math.ceil(this.nextMark * 1.06));
      }
    }
  }

  reset() {
    this.counts = this.spec.outcomes.map(() => 0);
    this.n = 0;
    this.history = [];
    this.nextMark = 1;
  }

  rel() {
    return this.counts.map((c) => (this.n ? c / this.n : 0));
  }

  watchIndex() {
    return this.spec.outcomes.indexOf(this.spec.watch);
  }

  watchedRel() {
    const i = this.watchIndex();
    return this.n ? this.counts[i] / this.n : 0;
  }

  /** Largest |relative frequency − probability| across outcomes. */
  maxRelGap() {
    if (!this.n) return 0;
    let worst = 0;
    for (let i = 0; i < this.counts.length; i++) {
      worst = Math.max(worst, Math.abs(this.counts[i] / this.n - this.spec.theory[i]));
    }
    return worst;
  }

  /** Largest |count − expected count| — the one that does not shrink. */
  maxCountGap() {
    let worst = 0;
    for (let i = 0; i < this.counts.length; i++) {
      worst = Math.max(worst, Math.abs(this.counts[i] - this.n * this.spec.theory[i]));
    }
    return worst;
  }
}
