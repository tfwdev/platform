import {dim2} from "../core/math"
import {Color} from "../core/color"
import {Subject, Value} from "../core/react"

type Defs<C> = {[key :string]: C}

/** Defines styles which can be referenced by name in element configuration. */
export interface StyleDefs {
  colors      :Defs<ColorConfig>
  shadows     :Defs<ShadowConfig>
  fonts       :Defs<FontConfig>
  paints      :Defs<PaintConfig>
  borders     :Defs<BorderConfig>
  backgrounds :Defs<BackgroundConfig>
}

const SpecPrefix = "$"

/** Defines either an "immediate" style configuration or the id of style def. */
export type Spec<T> = string | T

// TODO?: ImageConfig = string | {source/path/url :string, scale :number} | ?

function readDef<C> (type :string, defs :Defs<C>, id :string) :C {
  const config = defs[id.substring(1)]
  if (config) return config
  throw new Error(`Missing ${type} style def '${id}'`)
}

/** Provides style definitions for use when resolving styles, and other needed context. */
export abstract class StyleContext {

  constructor (readonly styles :StyleDefs) {}

  resolveColor (spec :Spec<ColorConfig>) :string {
    if (typeof spec !== "string" || !spec.startsWith(SpecPrefix)) return makeCSSColor(spec)
    else return makeCSSColor(readDef("color", this.styles.colors, spec))
  }

  resolveShadow (spec :Spec<ShadowConfig>) :Shadow {
    const config = (typeof spec !== "string") ? spec : readDef("shadow", this.styles.shadows, spec)
    return new Shadow(config.offsetX, config.offsetY, config.blur, this.resolveColor(config.color))
  }
  resolveShadowOpt (spec :Spec<ShadowConfig>|undefined) :Shadow {
    return spec ? this.resolveShadow(spec) : NoShadow
  }

  resolveFont (spec :Spec<FontConfig>) :FontConfig {
    if (typeof spec !== "string") return spec
    else return readDef("font", this.styles.fonts, spec)
  }
  resolveFontOpt (spec :Spec<FontConfig>|undefined) :FontConfig {
    return spec ? this.resolveFont(spec) : DefaultFontConfig
  }

  // TODO: we should probably cache resolved borders, bgs & paints

  resolveBorder (spec :Spec<BorderConfig>) :Subject<Decoration> {
    if (typeof spec !== "string") return makeBorder(this, spec)
    else return makeBorder(this, readDef("border", this.styles.borders, spec))
  }

  resolveBackground (spec :Spec<BackgroundConfig>) :Subject<Decoration> {
    if (typeof spec !== "string") return makeBackground(this, spec)
    else return makeBackground(this, readDef("background", this.styles.backgrounds, spec))
  }

  resolvePaint (spec :Spec<PaintConfig>) :Subject<Paint> {
    if (typeof spec !== "string") return makePaint(this, spec)
    else return makePaint(this, readDef("paint", this.styles.paints, spec))
  }

  /** Resolves `path` into either a successful `<image>` element or an `Error`. */
  abstract resolveImage (path :string) :Subject<HTMLImageElement|Error>
}

let scratch2D :CanvasRenderingContext2D|null = null
function requireScratch2D () :CanvasRenderingContext2D {
  if (!scratch2D) {
    const scratch = document.createElement("canvas")
    scratch2D = scratch.getContext("2d")
    if (!scratch2D) throw new Error(`Support for 2D canvas required`)
  }
  return scratch2D
}

//
// Paint: color/gradient/pattern filling and stroking

// TODO: also allow JS array [a,r,g,b]? (Color is a float32array)
export type ColorConfig = string | Color

/** Configures a paint that uses a single color. */
export interface ColorPaintConfig {
  type :"color"
  color :Spec<ColorConfig>
}

/** Defines a color stop for a linear or radial gradient. */
export type ColorStop = [number, Spec<ColorConfig>]

// TODO: gradient configurations are specified in absolute pixel coordinates which is problematic;
// you don't know how big a space you'll need to fill until your widget is laid out, and you
// probably want your gradient defined in terms of that laid out space (so the gradient can smoothly
// go from top to bottom of your widget, say); we could allow gradients to be specified using
// fractions of the final laid out size, but then we'd need to instantiate paints after layout in
// Box which is kinda fiddly... still probably worth it eventually

/** Configures a paint that uses a linear gradient. */
export interface LinearGradientPaintConfig {
  type :"linear"
  /** The `x, y` coordinate of the start point of the gradient. */
  start :[number,number]
  /** The `x, y` coordinate of the end point of the gradient. */
  end :[number,number]
  /** Zero or more color stops which specify `[frac, color]` where `frac` is the fraction of
    * distance between `start` and `end` at which the gradient should be fully transitioned to
    * `color`. */
  stops? :ColorStop[]
}

/** Configures a paint that uses a radial gradient. */
export interface RadialGradientPaintConfig {
  type :"radial"
  /** The `x, y, r` coordinate of the start point of the gradient. */
  start :[number,number,number]
  /** The `x, y, r` coordinate of the end point of the gradient. */
  end :[number,number,number]
  /** Zero or more color stops which specify `[frac, color]` where `frac` is the fraction of
    * distance between `start` and `end` at which the gradient should be fully transitioned to
    * `color`. */
  stops? :ColorStop[]
}

type GradientPaintConfig = LinearGradientPaintConfig | RadialGradientPaintConfig

export type PatternRepeat = "repeat" | "repeat-x" | "repeat-y" | "no-repeat"

/** Configures a paint that uses an image pattern. */
export interface PatternPaintConfig {
  type :"pattern"
  image :string
  repeat? :PatternRepeat
}

/** Defines configuration for the various types of paints. */
export type PaintConfig = ColorPaintConfig
                        | GradientPaintConfig
                        | PatternPaintConfig

/** Configures a canvas to paint using a color, gradient or pattern. */
export abstract class Paint {

  abstract prepStroke (canvas :CanvasRenderingContext2D) :void
  abstract prepFill (canvas :CanvasRenderingContext2D) :void
}

export function makePaint (ctx :StyleContext, config :PaintConfig) :Subject<Paint> {
  const type :string = config.type
  switch (config.type) {
  case   "color": return Value.constant(new ColorPaint(ctx.resolveColor(config.color)))
  case  "linear":
  case  "radial": return Value.constant(new GradientPaint(ctx, config))
  case "pattern": return ctx.resolveImage(config.image).map(img => {
      if (img instanceof HTMLImageElement) return new PatternPaint(img, config)
      // TODO: return error pattern
      else return new ColorPaint("#FF0000")
    })
  }
  // though TypeScript thinks we're safe here, our data may have been coerced from a config object,
  // so we need to handle the unexpected case
  throw new Error(`Unknown paint type '${type}' (in ${JSON.stringify(config)})`)
}

function makeCSSColor (config? :ColorConfig) :string {
  if (config === undefined) return "#000"
  else if (typeof config === "string") return config
  else return Color.toCSS(config)
}

class ColorPaint extends Paint {
  constructor (readonly color :string) { super() }

  prepStroke (canvas :CanvasRenderingContext2D) {
    canvas.strokeStyle = this.color
  }
  prepFill (canvas :CanvasRenderingContext2D) {
    canvas.fillStyle = this.color
  }
}

class GradientPaint extends Paint {
  private gradient :CanvasGradient

  constructor (ctx :StyleContext, config :GradientPaintConfig) {
    super()
    const canvas = requireScratch2D()
    if (config.type === "radial") {
      const [x0, y0, r0] = config.start, [x1, y1, r1] = config.end
      this.gradient = canvas.createRadialGradient(x0, y0, r0, x1, y1, r1)
    } else {
      const [x0, y0] = config.start, [x1, y1] = config.end
      this.gradient = canvas.createLinearGradient(x0, y0, x1, y1)
    }
    (config.stops || []).forEach(
      ([frac, color]) => this.gradient.addColorStop(frac, ctx.resolveColor(color)))
  }

  prepStroke (canvas :CanvasRenderingContext2D) {
    canvas.strokeStyle = this.gradient
  }
  prepFill (canvas :CanvasRenderingContext2D) {
    canvas.fillStyle = this.gradient
  }
}

// TODO: pattern fills don't play well with HiDPI images: on a 2x HiDPI display the canvas is scaled
// 2x which causes a normal pattern image to be drawn at 2x the size, then if one uses a HiDPI image
// for the pattern, it's already 2x the size so we end up with a pattern that's 4x the size; I'm not
// sure if this can be fixed without major hackery...
class PatternPaint extends Paint {
  private pattern :CanvasPattern

  constructor (image :HTMLImageElement, config :PatternPaintConfig) {
    super()
    const pattern = requireScratch2D().createPattern(image, config.repeat || "repeat")
    if (pattern) this.pattern = pattern
    else throw new Error(`Failed to create pattern? [config=${JSON.stringify(config)}]`)
  }

  prepStroke (canvas :CanvasRenderingContext2D) {
    canvas.strokeStyle = this.pattern
  }
  prepFill (canvas :CanvasRenderingContext2D) {
    canvas.fillStyle = this.pattern
  }
}

export const DefaultPaint :Paint = new ColorPaint("#FF0000")

//
// Shadows

export interface ShadowConfig {
  offsetX :number
  offsetY :number
  blur :number
  color :Spec<ColorConfig>
}

export class Shadow {
  constructor (readonly ox :number, readonly oy :number, readonly blur :number, readonly color :string) {}

  prep (canvas :CanvasRenderingContext2D) {
    canvas.shadowOffsetX = this.ox
    canvas.shadowOffsetY = this.oy
    canvas.shadowBlur = this.blur
    canvas.shadowColor = this.color
  }
  reset (canvas :CanvasRenderingContext2D) {
    canvas.shadowOffsetX = 0
    canvas.shadowOffsetY = 0
    canvas.shadowBlur = 0
  }
}

export const NoShadow = new Shadow(0, 0, 0, "white")

//
// Fonts

export type FontWeight = "normal" | "bold" | "bolder" | "lighter" | number
export type FontStyle = "normal" | "italic" | "oblique"
export type FontVariant = "normal" | "small-caps"

export interface FontConfig {
  family :string
  size :number
  weight? :FontWeight
  style? :FontStyle
  variant? :FontVariant
}

export const DefaultFontConfig :FontConfig = {
  family: "Helvetica",
  size: 16
}

function toCanvasFont (config :FontConfig) :string {
  const weight = config.weight || "normal"
  const style = config.style || "normal"
  const variant = config.variant || "normal"
  return `${style} ${variant} ${weight} ${config.size}px ${config.family}`
}

//
// Backgrounds and borders

/** A decoration (border or background) is simply a rendering function. The canvas will be
  * translated such that `0, 0` is the upper left of the region into which the decoration should be
  * rendered, and `size` indicates its size. */
export type Decoration = (canvas :CanvasRenderingContext2D, size :dim2) => void

/** A decoration that renders nothing. */
export const NoopDecor :Decoration = (canvas, size) => {}

export type FitConfig = "start"| "center"  | "end" | "stretch"

/** Defines a background rendered behind a [[Box]]. */
export interface BackgroundConfig {
  /** The paint used to fill this background (if it is a filled background). */
  fill? :Spec<PaintConfig>
  /** The corner radius if a filled background is used. */
  cornerRadius? :number // TODO: support [ul, ur, lr, ll] radii as well
  /** A shadow rendered behind this background. */
  shadow? :Spec<ShadowConfig>
  /** Defines an image which is rendered for the background. */
  image? :{
    /** The source URL for the image. Passed to the image resolver. */
    source :string
    /** The fit for the image on both x and y axes. Defaults to `center`. */
    fit? :FitConfig
    /** The fit for the image on the x axis. Supercedes `fit`, defaults to `center`. */
    fitX? :FitConfig
    /** The fit for the image on the y axis. Supercedes `fit`, defaults to `center`. */
    fitY? :FitConfig
  }
}

/** Creates a background based on the supplied `config`. */
export function makeBackground (ctx :StyleContext, config :BackgroundConfig) :Subject<Decoration> {
  if (config.fill) return ctx.resolvePaint(config.fill).map(fill => {
    const cornerRadius = config.cornerRadius
    const shadow = ctx.resolveShadowOpt(config.shadow)
    return (canvas, size) => {
      fill.prepFill(canvas)
      const w = size[0], h = size[1]
      shadow.prep(canvas)
      if (cornerRadius) {
        const midx = w/2, midy = h/2, maxx = w, maxy = h
        canvas.beginPath()
        canvas.moveTo(0, midy)
        canvas.arcTo(0, 0, midx, 0, cornerRadius)
        canvas.arcTo(maxx, 0, maxx, midy, cornerRadius)
        canvas.arcTo(maxx, maxy, midx, maxy, cornerRadius)
        canvas.arcTo(0, maxy, 0, midy, cornerRadius)
        canvas.closePath()
        canvas.fill()
      } else {
        canvas.fillRect(0, 0, w, h)
      }
      shadow.reset(canvas)
    }
  })
  // TODO
  else if (config.image) return Value.constant(NoopDecor)
  // TODO: log a warning?
  else return Value.constant(NoopDecor)
}

/** Defines a border rendered around a [[Box]]. */
export interface BorderConfig {
  /** The paint used to stroke this border. */
  stroke :Spec<PaintConfig>
  /** The corner radius of the border. */
  cornerRadius? :number // TODO: support [ul, ur, lr, ll] radii as well
  /** A shadow rendered behind this border. */
  shadow? :Spec<ShadowConfig>
}

/** Creates a border based on the supplied `config`. */
export function makeBorder (ctx :StyleContext, config :BorderConfig) :Subject<Decoration> {
  return ctx.resolvePaint(config.stroke).map(stroke => {
    const cornerRadius = config.cornerRadius
    const shadow = ctx.resolveShadowOpt(config.shadow)
    return (canvas, size) => {
      stroke.prepStroke(canvas)
      const w = size[0], h = size[1]
      shadow.prep(canvas)
      if (cornerRadius) {
        const midx = w/2, midy = h/2, maxx = w, maxy = h
        canvas.beginPath()
        canvas.moveTo(0, midy)
        canvas.arcTo(0, 0, midx, 0, cornerRadius)
        canvas.arcTo(maxx, 0, maxx, midy, cornerRadius)
        canvas.arcTo(maxx, maxy, midx, maxy, cornerRadius)
        canvas.arcTo(0, maxy, 0, midy, cornerRadius)
        canvas.closePath()
        canvas.stroke()
      } else {
        canvas.strokeRect(0, 0, w, h)
      }
      shadow.reset(canvas)
    }
  })
}

//
// Styled text

/** A span of text in a particular style, all rendered in a single line. */
export class Span {
  readonly size = dim2.create()

  constructor (
    readonly text :string,
    readonly font :FontConfig,
    readonly fill? :Paint,
    readonly stroke? :Paint,
    readonly shadow? :Shadow
  ) {
    if (!fill && !stroke) console.warn(`Span with neither fill nor stroke? [text=${text}]`)
    const canvas = requireScratch2D()
    this.prepCanvas(canvas)
    const metrics = canvas.measureText(this.text)
    dim2.set(this.size, metrics.width, this.font.size)
    this.resetCanvas(canvas)
  }

  render (canvas :CanvasRenderingContext2D, x :number, y :number) {
    this.prepCanvas(canvas)
    const {fill, stroke, text} = this
    fill && canvas.fillText(text, x, y)
    stroke && canvas.strokeText(text, x, y)
    this.resetCanvas(canvas)
  }

  private prepCanvas (canvas :CanvasRenderingContext2D) {
    canvas.textAlign = "start"
    canvas.textBaseline = "top"
    canvas.font = toCanvasFont(this.font)
    this.fill && this.fill.prepFill(canvas)
    this.stroke && this.stroke.prepStroke(canvas)
    if (this.shadow) this.shadow.prep(canvas)
  }
  private resetCanvas (canvas :CanvasRenderingContext2D) {
    if (this.shadow) this.shadow.reset(canvas)
  }
}

export const EmptySpan = new Span("", DefaultFontConfig, undefined, DefaultPaint, undefined)