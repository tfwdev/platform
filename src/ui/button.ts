import {dim2, rect, vec2} from "../core/math"
import {Mutable, Value} from "../core/react"
import {Action, NoopAction, Spec} from "./model"
import {Control, ControlConfig, Element, ElementConfig, ElementContext,
        MouseInteraction} from "./element"

export interface ButtonConfig extends ControlConfig {
  type :"button"
  onClick? :Spec<Action>
}

const ButtonStyleScope = {id: "button", states: ["normal", "disabled", "focused", "pressed"]}

export class Button extends Control {
  protected readonly _pressed = Mutable.local(false)
  protected readonly onClick :Action

  constructor (ctx :ElementContext, parent :Element, readonly config :ButtonConfig) {
    super(ctx, parent, config)
    this.onClick = config.onClick ? ctx.model.resolve(config.onClick) : NoopAction
    this._pressed.onValue(_ => this._state.update(this.computeState))
  }

  get styleScope () { return ButtonStyleScope }
  get pressed () :Value<boolean> { return this._pressed }

  handleMouseDown (event :MouseEvent, pos :vec2) :MouseInteraction|undefined {
    if (event.button !== 0) return undefined
    this._pressed.update(true)
    this.focus()
    return {
      move: (event, pos) => this._pressed.update(rect.contains(this.bounds, pos)),
      release: () => {
        this._pressed.update(false)
        if (rect.contains(this.bounds, pos)) this.onClick()
      },
      cancel: () => this._pressed.update(false)
    }
  }

  protected get computeState () {
    // meh, this can be called before our constructor runs...
    const pressed = (this._pressed  && this._pressed.current)
    return this.enabled.current && pressed ? "pressed" : super.computeState
  }
}

export interface ToggleConfig extends ControlConfig {
  type :"checkbox"
  checked :Spec<Value<boolean>>
  onClick? :Spec<Action>
  checkedContents? :ElementConfig
}

function adjustViz (cfg :ElementConfig, visible :Spec<Value<boolean>>) :ElementConfig {
  return {...cfg, visible}
}

export class Toggle extends Control {
  readonly checked :Value<boolean>
  readonly onClick :Action
  readonly checkedContents? :Element

  constructor (ctx :ElementContext, parent :Element, readonly config :ToggleConfig) {
    super(ctx, parent, config)
    this.checked = ctx.model.resolve(config.checked)
    this.invalidateOnChange(this.checked)
    this.onClick = config.onClick ? ctx.model.resolve(config.onClick) : NoopAction
    if (config.checkedContents) this.checkedContents = ctx.elem.create(
      ctx, this, adjustViz(config.checkedContents, config.checked))
  }

  findChild (type :string) :Element|undefined {
    return super.findChild(type) || this.contents.findChild(type)
  }
  findTaggedChild (tag :string) :Element|undefined {
    return super.findTaggedChild(tag) || this.contents.findTaggedChild(tag)
  }

  dispose () {
    super.dispose()
    if (this.checkedContents) this.checkedContents.dispose()
  }

  handleMouseDown (event :MouseEvent, pos :vec2) :MouseInteraction|undefined {
    if (event.button !== 0) return undefined
    this.focus()
    return {
      move: (event, pos) => {},
      release: () => {
        if (rect.contains(this.bounds, pos)) this.onClick()
      },
      cancel: () => {}
    }
  }

  protected createContents (ctx :ElementContext) :Element {
    const {contents, checked, checkedContents} = this.config
    // if we have a special checked contents element, then bind visibility of our "not" checked
    // contents to the opposite of our checked value
    const unchecked = ctx.model.resolve(checked).map(c => !c)
    return ctx.elem.create(ctx, this, checkedContents ? adjustViz(contents, unchecked) : contents)
  }

  protected computePreferredSize (hintX :number, hintY :number, into :dim2) {
    super.computePreferredSize(hintX, hintY, into)
    if (this.checkedContents) {
      const cpsize = this.checkedContents.preferredSize(hintX, hintY)
      into[0] = Math.max(into[0], cpsize[0])
      into[1] = Math.max(into[1], cpsize[1])
    }
  }

  protected relayout () {
    super.relayout()
    if (this.checkedContents) this.checkedContents.setBounds(this._bounds)
  }

  protected revalidate () {
    super.revalidate()
    if (this.checkedContents) this.checkedContents.validate()
  }

  protected rerender (canvas :CanvasRenderingContext2D) {
    if (this.checked.current && this.checkedContents) this.checkedContents.render(canvas)
    else this.contents.render(canvas)
  }
}
