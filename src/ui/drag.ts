import {dim2, rect, vec2} from "../core/math"
import {Mutable, Value} from "../core/react"
import {Noop} from "../core/util"
import {ModelKey} from "./model"
import {Control, ControlConfig, ControlStates, Element, ElementContext, Root} from "./element"
import {Spec} from "./style"
import {CursorConfig, Cursor, DefaultCursor} from "./cursor"

/** Whether drags are constrainted to the horizontal or vertical axis. */
export type DragConstraint = "none" | "horizontal" | "vertical"

/** Interface used by elements that support dragging. */
export interface DragOwner {

  /** Whether drags should move horizontally, vertically or freely. */
  dragConstraint :DragConstraint

  /** Indicates whether a drag gesture should be allowed to start a drag. */
  canStartDrag :boolean

  /** Called when the dragged element is moved.
    * @param elem the element being dragged.
    * @param pos the center of the dragged element. */
  handleDrag (elem :DragElement, pos :vec2) :void

  /** Called when the dragged element is released (dropped).
    * @param elem the dropped element. */
  handleDrop (elem :DragElement) :void

  /** Called if the drag interaction is canceled. */
  cancelDrag () :void
}

function findDropIndex (elems :Element[], pos :vec2, horizontal :boolean) :number|undefined {
  let dropDistance = Infinity, dropIndex :number|undefined = undefined
  const axisIdx = horizontal ? 0 : 1, center = pos[axisIdx]
  for (let ii = 0; ii < elems.length; ii++) {
    const element = elems[ii]
    const startPos = element.bounds[axisIdx]
    const startDistance = Math.abs(startPos - center)
    if (startDistance < dropDistance) {
      dropDistance = startDistance
      dropIndex = ii
    }
    const endPos = startPos + element.bounds[axisIdx+2]
    const endDistance = Math.abs(endPos - center)
    if (endDistance < dropDistance) {
      dropDistance = endDistance
      dropIndex = ii + 1
    }
  }
  return dropIndex
}

const tmpr = rect.create()

function cursorBounds (
  host :Element, elements :Element[], horizontal :boolean,
  gap :number, lineWidth :number, index :number
) :rect {
  const append = index >= elements.length
  const elem = append ? elements[elements.length-1] : elements[index]
  const gapAdjust = ((index > 0 && !append) ? gap/2 : 0)
  if (horizontal) return rect.set(
    tmpr, elem.x + (append ? elem.width-1 : 0) - gapAdjust, host.y, lineWidth, elem.height)
  else return rect.set(
    tmpr, host.x, elem.y + (append ? elem.height-1 : 0) - gapAdjust, host.width, lineWidth)
}

/** A function that changes the order of a list element. */
export type OrderUpdater = (key :ModelKey, index :number) => void

export interface ReorderDragger extends DragOwner {
  validate () :void
  render (canvas :CanvasRenderingContext2D, region :rect) :void
}

export function makeReorderer (
  ctx :ElementContext, dragConstraint :DragConstraint, orderUpdater :OrderUpdater,
  host :Element, elements :Element[], horizontal :boolean, gap :number, cursorConfig? :CursorConfig
) :ReorderDragger {
  const dropIndex = Mutable.local<number|undefined>(undefined)
  const cursorViz = dropIndex.map(i => i !== undefined)
  const config = {...(cursorConfig || DefaultCursor), visible: cursorViz}
  const cursor = ctx.elem.create(ctx, host, config) as Cursor
  dropIndex.onEmit(index => host.invalidate())
  return {
    canStartDrag: true,
    dragConstraint,
    handleDrag (elem, pos) { dropIndex.update(findDropIndex(elements, pos, horizontal)) },
    handleDrop (elem) {
      const index = dropIndex.current
      if (index !== undefined) {
        orderUpdater(elem.key.current, index)
        dropIndex.update(undefined)
      }
    },
    cancelDrag () { dropIndex.update(undefined) },
    validate () {
      const index = dropIndex.current
      if (index !== undefined) {
        cursor.setBounds(cursorBounds(host, elements, horizontal, gap, cursor.lineWidth, index))
        cursor.validate()
      }
    },
    render (canvas, region) { cursor.render(canvas, region) }
  }
}

/** Defines configuration for [[DragElement]] elements. */
export interface DragElementConfig extends ControlConfig {
  key :Spec<Value<ModelKey>>
}

/** The states used for draggable elements. */
export const DragElementStates = [...ControlStates, "selected"]

/** Base class for draggable list elements. */
export abstract class DragElement extends Control {
  private readonly _createDragRoot :() => Root
  readonly key :Value<ModelKey>

  constructor (ctx :ElementContext, parent :Element, config :DragElementConfig) {
    super(ctx, parent, config)
    this.key = ctx.model.resolve(config.key)
    this._createDragRoot = () => {
      const root = this.root.createPopup(ctx, {
        type: "root",
        inert: true,
        contents: {
          type: "box",
          contents: config.contents,
          style: {halign: "stretch", valign: "stretch", alpha: 0.5},
        }
      })
      root.setSize(this.size(dim2.create()))
      return root
    }
  }

  /** Checks whether this element is selected. */
  get selected () :boolean { return false }

  /** Selects this element. */
  select (event :MouseEvent|TouchEvent) :void {}

  handlePointerDown (event :MouseEvent|TouchEvent, pos :vec2) {
    const interaction = this.contents.handlePointerDown(event, pos)
    if (interaction) return interaction
    const buttonNon0 = event instanceof MouseEvent && event.button !== 0
    if (buttonNon0 || !this.visible.current || !this.enabled.current) return undefined

    this.select(event)
    const owner = this.dragOwner
    if (!owner || !owner.canStartDrag) return {move: Noop, release: Noop, cancel: Noop}

    const startPos = vec2.clone(pos)
    const offsetPos = vec2.fromValues(this.x - startPos[0], this.y - startPos[1])
    const DragHysteresis = 5
    const dragPos = vec2.create(), dragOrigin = vec2.create(), dragSize = vec2.create()
    let dragRoot :Root|undefined
    let clear = () => {}

    return {
      move: (moveEvent :MouseEvent|TouchEvent, pos :vec2) => {
        if (dragRoot === undefined && vec2.distance(startPos, pos) < DragHysteresis) return
        if (!dragRoot) {
          dragRoot = this._createDragRoot()
          dragRoot.size(dragSize)
          dragRoot.setCursor(this, "move")
          this.root.dragPopup.update(dragRoot)
          clear = () => {
            this.clearCursor(this)
            this.root.dragPopup.updateIf(r => r === dragRoot, undefined)
            dragRoot && dragRoot.dispose()
          }
        }
        vec2.add(dragPos, pos, offsetPos)
        const constraint = owner.dragConstraint
        if (constraint !== "none") {
          const posIdx = constraint === "horizontal" ? 1 : 0
          dragPos[posIdx] = this.bounds[posIdx]
        }
        dragRoot.setOrigin(vec2.add(dragOrigin, this.root.origin, dragPos))
        owner.handleDrag(this, vec2.scaleAndAdd(dragPos, dragPos, dragSize, 0.5))
      },
      release: (upEvent :MouseEvent|TouchEvent, pos :vec2) => {
        clear()
        if (dragRoot) owner.handleDrop(this)
      },
      cancel: () => {
        clear()
        if (dragRoot) owner.cancelDrag()
      },
    }
  }

  handleWheel (event :WheelEvent, pos :vec2) :boolean {
    return this.contents.handleWheel(event, pos)
  }

  handleDoubleClick (event :MouseEvent, pos :vec2) :boolean {
    return this.contents.handleDoubleClick(event, pos)
  }

  protected abstract get dragOwner () :DragOwner|undefined

  protected get computeState () {
    return this.enabled.current && this.selected ? "selected" : super.computeState
  }
}