import {vec2, vec2ToString} from "../core/math"
import {MutableMap, RMap} from "../core/rcollect"
import {Disposable, Disposer} from "../core/util"
import {Mouse} from "./mouse"
import {pointerEvents} from "./react"
import {Touchpad} from "./touchpad"

/** The ID we use for the mouse pointer, which should never be a touch identifier. */
export const MOUSE_ID = -999

const position = vec2.create()
const movement = vec2.create()

/** Combines mouse and touchpad input. */
export class Hand implements Disposable {
  readonly mouse :Mouse
  readonly touchpad :Touchpad

  private _disposer = new Disposer()
  private _pointers :MutableMap<number, Pointer> = MutableMap.local()

  /** Returns a reactive view of the map from ids to active pointers. */
  get pointers () :RMap<number, Pointer> {
    return this._pointers
  }

  constructor (private readonly _canvas :HTMLElement) {
    this._disposer.add(this.mouse = new Mouse(_canvas))
    this._disposer.add(this.touchpad = new Touchpad())

    this._disposer.add(pointerEvents("pointerdown").onEmit(event => {
      const target = event.target as HTMLElement
      target.setPointerCapture(event.pointerId)
    }))
    this._disposer.add(pointerEvents("pointerup").onEmit(event => {
      const target = event.target as HTMLElement
      target.releasePointerCapture(event.pointerId)
    }))
  }

  /** Updates the mouse and touchpad state.  Should be called once per frame. */
  update () {
    this.mouse.update()

    const mouseClient = this.mouse.lastClient
    const rect = this._canvas.getBoundingClientRect()
    const outside = (
      !mouseClient ||
      mouseClient[0] < rect.left ||
      mouseClient[0] > rect.right ||
      mouseClient[1] < rect.top ||
      mouseClient[1] > rect.bottom
    )
    const pressed = this.mouse.pressed
    let pointer = this._pointers.get(MOUSE_ID)
    // remain "inside" after we've pressed the pointer inside until the pointer is released
    // remain "outside" after we've pressed the pointer outside until the pointer is released
    if (
      this.mouse.entered &&
      mouseClient &&
      (outside ? pressed && pointer && pointer.pressed : pointer || !this.mouse.rawPressed)
    ) {
      vec2.set(position, mouseClient[0] - rect.left, mouseClient[1] - rect.top)
      if (!(
        pointer &&
        vec2.exactEquals(pointer.position, position) &&
        vec2.exactEquals(pointer.movement, this.mouse.movement.current) &&
        pointer.pressed === pressed
      )) {
        this._pointers.set(
          MOUSE_ID,
          new Pointer(
            vec2.clone(position),
            vec2.clone(this.mouse.movement.current),
            pressed,
          ),
        )
      }
    } else if (this._pointers.has(MOUSE_ID)) {
      this._pointers.delete(MOUSE_ID)
    }

    for (const touch of this.touchpad.touches.values()) {
      vec2.set(position, touch.clientX - rect.left, touch.clientY - rect.top)
      pointer = this._pointers.get(touch.identifier)
      if (pointer) {
        vec2.subtract(movement, position, pointer.position)
      } else {
        // @ts-ignore zero missing from type definition
        vec2.zero(movement)
      }
      if (!(
        pointer &&
        vec2.exactEquals(pointer.position, position) &&
        vec2.exactEquals(pointer.movement, movement))
      ) {
        this._pointers.set(
          touch.identifier,
          new Pointer(vec2.clone(position), vec2.clone(movement), true),
        )
      }
    }
    for (const id of this._pointers.keys()) {
      if (id !== MOUSE_ID && !this.touchpad.touches.has(id)) {
        this._pointers.delete(id)
      }
    }
  }

  dispose () {
    this._disposer.dispose()
  }
}

/** Describes a touch or mouse point. */
export class Pointer {

  constructor (
    readonly position :vec2 = vec2.create(),
    readonly movement :vec2 = vec2.create(),
    readonly pressed :boolean = false,
  ) {}

  toString () {
    const p = this.position, m = this.movement, pd = this.pressed
    return `P${vec2ToString(p, 2)} M${vec2ToString(m, 2)}${pd ? " pressed" : ""}`
  }
}
