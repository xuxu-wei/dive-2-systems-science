/** Carry frame-budget remainder, rather than dropping to every other display frame. */
export class FrameClock {
  reset() {this.last = null; this.next = null; this.fps = null;}
  constructor() {this.reset();}
  step(time, fps = 60) {
    if (fps !== this.fps) {this.next = time; this.fps = fps;}
    if (this.next !== null && time + .1 < this.next) return null;
    const interval = 1000 / fps;
    const dt = this.last === null ? 0 : Math.max(0, (time - this.last) / 1000);
    this.last = time;
    this.next = time + interval - Math.max(0, (time - (this.next ?? time)) % interval);
    return dt;
  }
}
