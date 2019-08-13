import {vec2} from "gl-matrix"

import {vec2zero} from "../core/math"
import {Graph} from "../graph/graph"
import {InputEdge, Node, NodeConfig, NodeContext, NodeTypeRegistry} from "../graph/node"
import {Host, Root, RootConfig} from "./element"
import {Model, ModelData, ModelValue, Spec} from "./model"
import {Theme, UI} from "./ui"
import {ImageResolver, StyleDefs} from "./style"

/** Context for nodes relating to UI. */
export interface UINodeContext extends NodeContext {
  host :Host
  theme :Theme
  styles :StyleDefs
  image :ImageResolver
}

/** Creates a UI element when the input becomes true. */
export interface UINodeConfig extends NodeConfig {
  type :"UI"
  model? :ModelData
  root :RootConfig
  origin? :vec2
  size? :vec2
  input :InputEdge<boolean>
}

class UINode extends Node {

  constructor (graph :Graph, id :string, readonly config :UINodeConfig) {
    super(graph, id, config)
  }

  connect () {
    this._disposer.add(this.graph.getValue(this.config.input, false).onValue(value => {
      if (value) {
        const ctx = this.graph.ctx as UINodeContext
        let root :Root | undefined
        class NodeModel extends Model {
          resolve<V extends ModelValue> (spec :Spec<V>) :V {
            // special handling for remove action
            if (spec === "remove") {
              const action = () => {
                if (root) {
                  ctx.host.removeRoot(root)
                  root.dispose()
                }
              }
              return action as V
            }
            return super.resolve(spec)
          }
        }
        const ui = new UI(ctx.theme, ctx.styles, ctx.image, new NodeModel(this.config.model || {}))
        root = ui.createRoot(this.config.root)
        if (this.config.size) {
          root.pack(this.config.size[0], this.config.size[1])
        }
        ctx.host.addRoot(root, this.config.origin || vec2zero)
      }
    }))
  }
}

/** Registers the nodes in this module with the supplied registry. */
export function registerUINodes (registry :NodeTypeRegistry) {
  registry.registerNodeType("UI", UINode)
}