import {Mutable, Value} from "../core/react"
import {ButtonStates} from "./button"
import {Dropdown} from "./dropdown"
import {Element} from "./element"
import {HGroup} from "./group"
import {List} from "./list"
import {Spec} from "./model"
import {formatBinding} from "./keymap"
import {AbstractLabel, AbstractLabelConfig} from "./text"

export namespace Menu {

  /** Defines configuration for [[MenuBar]] elements. */
  export interface BarConfig extends List.AbstractConfig {
    type :"menuBar"
  }

  /** A horizontal menu bar. */
  export class Bar extends HGroup implements List.Like, Dropdown.Host {
    readonly elements = new Map<string, Element>()
    readonly contents :Element[] = []

    readonly activeChild = Mutable.local<Dropdown.Abstract|undefined>(undefined)
    get autoActivate () { return this.activeChild.current ? this.activeChild.current.isOpen : false }

    constructor (ctx :Element.Context, parent :Element, readonly config :BarConfig) {
      super(ctx, parent, config)
      this.disposer.add(List.syncContents(ctx, this, ctx.model.resolveAs(config.model, "model")))

      // while we have an active menu, intercept all event handling from the root so that all other
      // elements are inactive until the menu is dismissed
      this.activeChild.onValue(child => {
        if (child) this.root.targetElem.update(this)
        else this.root.targetElem.updateIf(e => e === this, undefined)
      })
    }
  }

  /** Defines configuration for [[Menu]] elements. */
  export interface Config extends Dropdown.AbstractConfig {
    type :"menu"
  }

  const MenuStyleScope = {id: "menu", states: ButtonStates}

  /** A menu within a menu bar. */
  export class Menu extends Dropdown.Abstract {

    constructor (ctx :Element.Context, parent :Element, readonly config :Config) {
      super(ctx, parent, config)
    }

    protected get customStyleScope () { return MenuStyleScope }
  }

  /** Defines configuration for [[Item]] elements. */
  export interface ItemConfig extends Dropdown.AbstractItemConfig {
    type :"menuItem"
  }

  const ItemStyleScope = {id: "menuItem", states: ButtonStates}

  /** A menu item within a menu. */
  export class Item extends Dropdown.AbstractItem {

    constructor (ctx :Element.Context, parent :Element, readonly config :ItemConfig) {
      super(ctx, parent, config)
    }

    protected get customStyleScope () { return ItemStyleScope }
  }

  /** Defines configuration for [[Item]] elements. */
  export interface ShortcutConfig extends AbstractLabelConfig {
    type :"shortcut"
    command? :Spec<Value<string>>
  }

  export class Shortcut extends AbstractLabel {

    constructor (ctx :Element.Context, parent :Element, readonly config :ShortcutConfig) {
      super(ctx, parent, config)
    }

    protected resolveText (ctx :Element.Context, config :ShortcutConfig) {
      return ctx.model.resolveOr(config.command, Value.blank).map((command :string) => {
        const commandKeys = this.root.keymap.getCommandBindings(command)
        return (commandKeys.length === 0) ? "" : formatBinding(commandKeys[0])
      })
    }
  }

  export const Catalog :Element.Catalog = {
    "menuBar": (ctx, parent, cfg) => new Bar(ctx, parent, cfg as BarConfig),
    "menu": (ctx, parent, cfg) => new Menu(ctx, parent, cfg as Config),
    "menuItem": (ctx, parent, cfg) => new Item(ctx, parent, cfg as ItemConfig),
    "shortcut": (ctx, parent, cfg) => new Shortcut(ctx, parent, cfg as ShortcutConfig),
  }
}
