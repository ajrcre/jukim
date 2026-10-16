/**
 * Strategy: mouse + touch via Pointer Events. Emits "strike" on press and
 * keeps the hovering/touching pointers as threats that roaches flee from.
 */
export class PointerInput {
  constructor(element, bus) {
    this.element = element;
    this.bus = bus;
    this.pointers = new Map();
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
  }

  enable() {
    this.element.addEventListener("pointerdown", this.onDown);
    this.element.addEventListener("pointermove", this.onMove);
    this.element.addEventListener("pointerup", this.onUp);
    this.element.addEventListener("pointercancel", this.onUp);
    this.element.addEventListener("pointerleave", this.onUp);
  }

  disable() {
    this.element.removeEventListener("pointerdown", this.onDown);
    this.element.removeEventListener("pointermove", this.onMove);
    this.element.removeEventListener("pointerup", this.onUp);
    this.element.removeEventListener("pointercancel", this.onUp);
    this.element.removeEventListener("pointerleave", this.onUp);
    this.pointers.clear();
  }

  point(e) {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onDown(e) {
    e.preventDefault();
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);
    const radius = e.pointerType === "touch" ? 26 : 14;
    this.bus.emit("strike", { x: p.x, y: p.y, radius, source: e.pointerType });
  }

  onMove(e) {
    // Mice threaten while hovering; fingers only while touching.
    if (e.pointerType === "mouse" || this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, this.point(e));
  }

  onUp(e) {
    if (e.pointerType !== "mouse" || e.type === "pointerleave") this.pointers.delete(e.pointerId);
  }

  threats() {
    return [...this.pointers.values()];
  }

  cursors() {
    return [];
  }
}
