// Tiny pub/sub bus. Systems talk through it so quests, HUD and audio don't import each other.
export class Events {
  constructor() {
    this.map = new Map();
  }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.map.get(type)?.delete(fn);
  }

  emit(type, data) {
    this.map.get(type)?.forEach((fn) => fn(data));
  }
}
