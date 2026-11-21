export class SeededRandom {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  nextBool(prob = 0.5) {
    return this.next() < prob;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  setSeed(seed) {
    this.seed = seed >>> 0;
  }
}

export const globalRandom = new SeededRandom(Date.now() & 0xffffffff);