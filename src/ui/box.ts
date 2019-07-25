import {rect, dim2, vec2} from "../core/math"
import {Element, ElementConfig, ElementContext, ElementStyle} from "./element"
import {NoopDecor, BackgroundConfig, BorderConfig, Spec} from "./style"

const tmpr = rect.create()
const tmpd = dim2.create()

/** Padding and margin are either specified as a single value for all four sides, or as individual
  * values: `[top, right, bottom, left]`. */
export type Insets = number | [number,number,number,number]

function insetLeft (insets :Insets) :number {
  return typeof insets === 'number' ? insets : insets[3]
}
function insetTop (insets :Insets) :number {
  return typeof insets === 'number' ? insets : insets[0]
}
function insetWidth (insets :Insets) :number {
  return typeof insets === 'number' ? (2*insets) : (insets[1] + insets[3])
}
function insetHeight (insets :Insets) :number {
  return typeof insets === 'number' ? (2*insets) : (insets[0] + insets[2])
}
function insetRect (insets :Insets, source :rect, dest :rect) :rect {
  let top :number, right :number, bottom :number, left :number
  if (typeof insets === 'number') {
    left = insets ; right = insets ; top = insets ; bottom = insets
  } else {
    top = insets[0] ; right = insets[1] ; bottom = insets[2], left = insets[3]
  }
  dest[0] = source[0] + left
  dest[1] = source[1] + top
  dest[2] = source[2] - left - right
  dest[3] = source[3] - top - bottom
  return dest
}

/** Defines horizontal alignment values. */
export type HAlign = "left" | "center" | "right" | "stretch"
/** Defines vertical alignment values. */
export type VAlign = "top" | "center" | "bottom" | "stretch"

export function alignOffset (align :HAlign|VAlign, size :number, extent :number) :number {
  switch (align) {
  case    "left":
  case     "top": return 0
  case "stretch": return 0
  case  "center": return (extent - size)/2
  case   "right":
  case  "bottom": return (extent - size)
  }
}

//
// Box config and element

/** Defines the styles that apply to [[Box]]. */
export interface BoxStyle extends ElementStyle {
  margin? :Insets
  background? :Spec<BackgroundConfig>
  border? :Spec<BorderConfig>
  padding? :Insets
  halign? :HAlign
  valign? :VAlign
  // TODO: border?
}

/** Defines configuration for [[Box]] elements. */
export interface BoxConfig extends ElementConfig {
  type :"box"
  contents :ElementConfig
  style :{normal :BoxStyle, disabled :BoxStyle}
}

/** Displays a single child with an optional background, padding, margin, and alignment. */
export class Box extends Element {
  private background = this.observe(NoopDecor)
  private border = this.observe(NoopDecor)
  private readonly contents :Element

  constructor (ctx :ElementContext, parent :Element, readonly config :BoxConfig) {
    super(ctx, parent, config)
    this.contents = ctx.createElement(this, config.contents)
    this.state.onValue(state => {
      const style = this.config.style[state]
      if (style.background) this.background.observe(ctx.resolveBackground(style.background))
      else this.background.update(NoopDecor)
      if (style.border) this.border.observe(ctx.resolveBorder(style.border))
      else this.border.update(NoopDecor)
    })
  }

  render (canvas :CanvasRenderingContext2D) {
    const {margin} = this.style
    const inbounds = margin ? insetRect(margin, this._bounds, tmpr) : this._bounds
    // TODO: should we just do all element rendering translated to the element's origin
    canvas.translate(inbounds[0], inbounds[1])
    this.background.current(canvas, dim2.set(tmpd, inbounds[2], inbounds[3]))
    // TODO: should the border render over the contents?
    this.border.current(canvas, dim2.set(tmpd, inbounds[2], inbounds[3]))
    canvas.translate(-inbounds[0], -inbounds[1])
    this.contents.render(canvas)
  }

  handleMouseDown (event :MouseEvent, pos :vec2) {
    return rect.contains(this.contents.bounds, pos) ?
      this.contents.handleMouseDown(event, pos) : undefined
  }

  dispose () {
    super.dispose()
    this.contents.dispose()
  }

  protected get style () :BoxStyle { return this.config.style[this.state.current] }

  protected computePreferredSize (hintX :number, hintY :number, into :dim2) {
    const {padding, margin} = this.style
    const edgeWidth = insetWidth(padding || 0) - insetWidth(margin || 0)
    const edgeHeight = insetHeight(padding || 0) - insetHeight(margin || 0)
    const psize = this.contents.preferredSize(hintX-edgeWidth, hintY-edgeHeight)
    dim2.set(into, psize[0] + edgeWidth, psize[1] + edgeHeight)
  }

  protected relayout () {
    const {padding, margin} = this.style
    const halign = this.style.halign || "center"
    const valign = this.style.valign || "center"
    let inbounds = rect.copy(tmpr, this._bounds)
    if (padding) inbounds = insetRect(padding, inbounds, tmpr)
    if (margin) inbounds = insetRect(margin, inbounds, tmpr)
    const bwidth = inbounds[2], bheight = inbounds[3]
    const psize = this.contents.preferredSize(bwidth, bheight)
    const cwidth = halign == "stretch" ? bwidth : Math.min(bwidth, psize[0])
    const cheight = valign == "stretch" ? bheight : Math.min(bheight, psize[1])
    const edgeLeft = insetLeft(padding || 0) + insetLeft(margin || 0)
    const edgeTop = insetTop(padding || 0) + insetTop(margin || 0)
    const cx = this.x + edgeLeft + alignOffset(halign, cwidth, bwidth)
    const cy = this.y + edgeTop + alignOffset(valign, cheight, bheight)
    this.contents.setBounds(rect.set(tmpr, cx, cy, cwidth, cheight))
  }

  protected revalidate () {
    super.revalidate()
    this.contents.validate()
  }
}