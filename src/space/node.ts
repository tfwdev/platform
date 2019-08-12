import {Euler, Math as ThreeMath, Matrix4, Quaternion, Vector3} from "three"

import {Value} from "../core/react"
import {Graph} from "../graph/graph"
import {
  InputEdge,
  Operator,
  OperatorConfig,
  Node,
  NodeConfig,
  NodeTypeRegistry,
  OutputEdge,
} from "../graph/node"
import {EntityComponentConfig, EntityComponentNode} from "../entity/node"
import {TransformComponent} from "./entity"

/** The different types of coordinate frames available. */
export type CoordinateFrame = "world" | "local"

/** Creates a set of Euler angles from individual components. */
export interface EulerConfig extends NodeConfig {
  type :"Euler"
  order? :string
  x :InputEdge<number>
  y :InputEdge<number>
  z :InputEdge<number>
  output :OutputEdge<Euler>
}

class EulerNode extends Node {

  constructor (graph :Graph, id :string, readonly config :EulerConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return Value
      .join(
        this.graph.getValue(this.config.x, 0),
        this.graph.getValue(this.config.y, 0),
        this.graph.getValue(this.config.z, 0),
      )
      .map(([x, y, z]) => new Euler(x, y, z, this.config.order))
  }
}

/** Creates a vector from individual components. */
export interface Vector3Config extends NodeConfig {
  type :"Vector3"
  x :InputEdge<number>
  y :InputEdge<number>
  z :InputEdge<number>
  output :OutputEdge<Vector3>
}

class Vector3Node extends Node {

  constructor (graph :Graph, id :string, readonly config :Vector3Config) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return Value
      .join(
        this.graph.getValue(this.config.x, 0),
        this.graph.getValue(this.config.y, 0),
        this.graph.getValue(this.config.z, 0),
      )
      .map(([x, y, z]) => new Vector3(x, y, z))
  }
}

/** Splits a vector into its individual components. */
export interface Vector3SplitConfig extends NodeConfig {
  type :"Vector3.split"
  input :InputEdge<Vector3>
  x :OutputEdge<number>
  y :OutputEdge<number>
  z :OutputEdge<number>
}

class Vector3Split extends Node {

  constructor (graph :Graph, id :string, readonly config :Vector3SplitConfig) {
    super(graph, id, config)
  }

  protected _createOutput (name :string = "x") {
    return this.graph.getValue(this.config.input, new Vector3()).map(value => value[name])
  }
}

/** Adds a set of vectors. */
export interface Vector3AddConfig extends OperatorConfig<Vector3> {
  type :"Vector3.add"
}

class Vector3Add extends Operator<Vector3> {

  constructor (graph :Graph, id :string, readonly config :Vector3AddConfig) {
    super(graph, id, config)
  }

  protected get _defaultInputValue () {
    return new Vector3()
  }

  protected _apply (values :Vector3[]) {
    const sum = new Vector3()
    for (const value of values) {
      sum.add(value)
    }
    return sum
  }
}

/** Applies an Euler angle rotation to a vector. */
export interface Vector3ApplyEulerConfig extends NodeConfig {
  type :"Vector3.applyEuler"
  vector :InputEdge<Vector3>
  euler :InputEdge<Euler>
  output :OutputEdge<Vector3>
}

class Vector3ApplyEuler extends Node {

  constructor (graph :Graph, id :string, readonly config :Vector3ApplyEulerConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return Value
      .join2(
        this.graph.getValue(this.config.vector, new Vector3()),
        this.graph.getValue(this.config.euler, new Euler()),
      )
      .map(([vector, euler]) => vector.clone().applyEuler(euler))
  }
}

/** Projects a vector onto a plane. */
export interface Vector3ProjectOnPlaneConfig extends NodeConfig {
  type :"Vector3.projectOnPlane"
  planeNormal? :Vector3
  input :InputEdge<Vector3>
  output :OutputEdge<Vector3>
}

class Vector3ProjectOnPlane extends Node {

  constructor (graph :Graph, id :string, readonly config :Vector3ProjectOnPlaneConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    const planeNormal = this.config.planeNormal || new Vector3(0, 1, 0)
    return this.graph.getValue(this.config.input, new Vector3()).map(
      vector => vector.clone().projectOnPlane(planeNormal),
    )
  }
}

/** Multiplies a vector by a scalar. */
export interface Vector3MultiplyScalarConfig extends NodeConfig {
  type :"Vector3.multiplyScalar"
  vector :InputEdge<Vector3>
  scalar :InputEdge<number>
  output :OutputEdge<Vector3>
}

class Vector3MultiplyScalar extends Node {

  constructor (graph :Graph, id :string, readonly config :Vector3MultiplyScalarConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return Value
      .join2(
        this.graph.getValue(this.config.vector, new Vector3()),
        this.graph.getValue(this.config.scalar, 1),
      )
      .map(([vector, scalar]) => vector.clone().multiplyScalar(scalar === undefined ? 1 : scalar))
  }
}

/** Computes the signed angle between two vectors about an axis. */
export interface Vector3AngleBetweenConfig extends NodeConfig {
  type :"Vector3.angleBetween"
  axis? :Vector3
  v1 :InputEdge<Vector3>
  v2 :InputEdge<Vector3>
  output :OutputEdge<number>
}

class Vector3AngleBetween extends Node {

  constructor (graph :Graph, id :string, readonly config :Vector3AngleBetweenConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    const axis = this.config.axis || new Vector3(0, 1, 0)
    const first = new Vector3()
    const second = new Vector3()
    return Value
      .join2(
        this.graph.getValue(this.config.v1, new Vector3()),
        this.graph.getValue(this.config.v2, new Vector3()),
      )
      .map(([v1, v2]) => {
        first.copy(v1).projectOnPlane(axis)
        second.copy(v2).projectOnPlane(axis)
        return first.angleTo(second) * (first.cross(second).dot(axis) < 0 ? -1 : 1)
      })
  }
}

/** Produces a unit vector in a random direction. */
export interface RandomDirectionConfig extends NodeConfig {
  type :"randomDirection"
  output :OutputEdge<Vector3>
}

class RandomDirection extends Node {

  constructor (graph :Graph, id :string, readonly config :RandomDirectionConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return this.graph.clock.fold(
      createRandomDirection(),
      (direction, clock) => createRandomDirection(),
    )
  }
}

function createRandomDirection () {
  // https://github.com/ey6es/clyde/blob/master/core/src/main/java/com/threerings/opengl/effect/config/ShooterConfig.java#L110
  const cosa = ThreeMath.randFloatSpread(2)
  const sina = Math.sqrt(1 - cosa*cosa)
  const theta = Math.random() * Math.PI * 2
  return new Vector3(Math.cos(theta) * sina, Math.sin(theta) * sina, cosa)
}

/** Rotates by an amount determined by the inputs. */
export interface RotateConfig extends EntityComponentConfig {
  type :"rotate"
  frame? :CoordinateFrame
  input :InputEdge<Euler>
}

class Rotate extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :RotateConfig) { super(graph, id, config) }

  connect () {
    const quaternion = new Quaternion()
    const rotation = new Quaternion()
    this._disposer.add(
      this.graph.getValue(this.config.input, new Euler()).onValue(euler => {
        this._component.readQuaternion(this._entityId, quaternion)
        rotation.setFromEuler(euler)
        if (this.config.frame === "world") quaternion.premultiply(rotation)
        else quaternion.multiply(rotation)
        this._component.updateQuaternion(this._entityId, quaternion)
      }),
    )
  }
}

/** Translates by an amount determined by the inputs. */
export interface TranslateConfig extends EntityComponentConfig {
  type :"translate"
  frame? :CoordinateFrame
  input :InputEdge<Vector3>
}

class Translate extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :TranslateConfig) {
    super(graph, id, config)
  }

  connect () {
    const position = new Vector3()
    const quaternion = new Quaternion()
    this._disposer.add(
      this.graph.getValue(this.config.input, new Vector3()).onValue(vector => {
        this._component.readPosition(this._entityId, position)
        if (this.config.frame !== "world") {
          this._component.readQuaternion(this._entityId, quaternion)
          vector.applyQuaternion(quaternion)
        }
        this._component.updatePosition(this._entityId, position.add(vector))
      }),
    )
  }
}

/** Reads an entity's transform. */
export interface ReadTransformConfig extends EntityComponentConfig {
  type :"readTransform"
  position :OutputEdge<Vector3>
  quaternion :OutputEdge<Quaternion>
  scale :OutputEdge<Vector3>
}

class ReadTransform extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :ReadTransformConfig) {
    super(graph, id, config)
  }

  protected _createOutput (name :string | undefined, defaultValue :any) {
    let getter :() => any
    switch (name) {
      case "quaternion":
        getter = () => this._component.readQuaternion(this._entityId, new Quaternion())
        break;
      case "scale":
        getter = () => this._component.readScale(this._entityId, new Vector3())
        break;
      default:
        getter = () => this._component.readPosition(this._entityId, new Vector3())
        break;
    }
    return this.graph.clock.fold(getter(), getter)
  }
}

/** Sets an entity's position. */
export interface UpdatePositionConfig extends EntityComponentConfig {
  type :"updatePosition"
  input :InputEdge<Vector3>
}

class UpdatePosition extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :UpdatePositionConfig) {
    super(graph, id, config)
  }

  connect () {
    this._disposer.add(
      this.graph.getValue(this.config.input, new Vector3()).onValue(position => {
        this._component.updatePosition(this._entityId, position)
      }),
    )
  }
}

/** Sets an entity's rotation. */
export interface UpdateRotationConfig extends EntityComponentConfig {
  type :"updateRotation"
  input :InputEdge<Euler>
}

class UpdateRotation extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :UpdateRotationConfig) {
    super(graph, id, config)
  }

  connect () {
    const quaternion = new Quaternion()
    this._disposer.add(
      this.graph.getValue(this.config.input, new Euler()).onValue(euler => {
        this._component.updateQuaternion(this._entityId, quaternion.setFromEuler(euler))
      }),
    )
  }
}

/** Sets an entity's scale. */
export interface UpdateScaleConfig extends EntityComponentConfig {
  type :"updateScale"
  input :InputEdge<Vector3>
}

class UpdateScale extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :UpdateScaleConfig) {
    super(graph, id, config)
  }

  connect () {
    this._disposer.add(
      this.graph.getValue(this.config.input, new Vector3()).onValue(scale => {
        this._component.updateScale(this._entityId, scale)
      }),
    )
  }
}

/** Transforms a point from world space to the local space of the entity. */
export interface WorldToLocalConfig extends EntityComponentConfig {
  type :"updateScale"
  input :InputEdge<Vector3>
  output :OutputEdge<Vector3>
}

class WorldToLocal extends EntityComponentNode<TransformComponent> {

  constructor (graph :Graph, id :string, readonly config :WorldToLocalConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    const position = new Vector3()
    const quaternion = new Quaternion()
    const scale = new Vector3()
    const matrix = new Matrix4()
    const inverse = new Matrix4()
    return this.graph.getValue(this.config.input, new Vector3()).map(point => {
      this._component.readPosition(this._entityId, position)
      this._component.readQuaternion(this._entityId, quaternion)
      this._component.readScale(this._entityId, scale)
      inverse.getInverse(matrix.compose(position, quaternion, scale))
      return point.clone().applyMatrix4(inverse)
    })
  }
}

/** Registers the nodes in this module with the supplied registry. */
export function registerSpaceNodes (registry :NodeTypeRegistry) {
  registry.registerNodeType("Euler", EulerNode)
  registry.registerNodeType("Vector3", Vector3Node)
  registry.registerNodeType("Vector3.split", Vector3Split)
  registry.registerNodeType("Vector3.add", Vector3Add)
  registry.registerNodeType("Vector3.applyEuler", Vector3ApplyEuler)
  registry.registerNodeType("Vector3.projectOnPlane", Vector3ProjectOnPlane)
  registry.registerNodeType("Vector3.multiplyScalar", Vector3MultiplyScalar)
  registry.registerNodeType("Vector3.angleBetween", Vector3AngleBetween)
  registry.registerNodeType("randomDirection", RandomDirection)
  registry.registerNodeType("rotate", Rotate)
  registry.registerNodeType("translate", Translate)
  registry.registerNodeType("readTransform", ReadTransform)
  registry.registerNodeType("updatePosition", UpdatePosition)
  registry.registerNodeType("updateRotation", UpdateRotation)
  registry.registerNodeType("updateScale", UpdateScale)
  registry.registerNodeType("worldToLocal", WorldToLocal)
}
