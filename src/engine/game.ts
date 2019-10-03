import {mat4, quat, vec3} from "../core/math"
import {Disposable} from "../core/util"

/** The available primitive types. */
export type PrimitiveType = "sphere" | "cylinder" | "cube" | "quad"

/** Top-level interface to scene graph engine. */
export interface GameEngine {

  /** Creates and returns a new game object containing a primitive.
    * @param type the type of primitive desired. */
  createPrimitive (type :PrimitiveType) :GameObject

  /** Creates and returns a new (empty) game object.
    * @param [name] the name of the object. */
  createGameObject (name? :string) :GameObject
}

/** Represents an object in the game hierarchy. */
export interface GameObject extends Disposable {

  /** The game object's name. */
  name :string

  /** The game object's transform component. */
  readonly transform :Transform

  /** Adds a component to the game object.  Once the component is added, it will be accessible as
    * `gameObject.componentType`.
    * @param type the type of component to add.
    * @return the newly created component. */
  addComponent<T extends Component> (type :string) :T

  /** Gets a typed reference to a component.
    * @param type the type of component desired.
    * @return the component reference. */
  getComponent<T extends Component> (type :string) :T

  /** Anything else is an untyped component. */
  readonly [type :string] :any
}

/** Base class for object components. */
export interface Component extends Disposable {

  /** The game object to which this component is attached. */
  readonly gameObject :GameObject

  /** The component type. */
  readonly type :string
}

/** Represents a game object transform. */
export interface Transform extends Component {

  /** The transform's parent, if any. Setting the parent does not change the world position. */
  parent? :Transform

  /** Sets the transform's parent.
    * @param parent the new parent, if any.
    * @param [worldPositionStays=true] whether or not to retain the world position. */
  setParent (parent :Transform|undefined, worldPositionStays? :boolean) :void

  /** The number of children of the transform. */
  readonly childCount :number

  /** Retrieves a child by index.
    * @param index the index of the desired child.
    * @return the child at the index. */
  getChild (index :number) :Transform

  /** The transform's position relative to its parent. */
  localPosition :vec3

  /** The transform's rotation relative to its parent. */
  localRotation :quat

  /** The transform's scale relative to its parent. */
  localScale :vec3

  /** The transform's position in world space. */
  position :vec3

  /** The transform's rotation in world space. */
  rotation :quat

  /** The transform's scale in world space (approximate). */
  readonly lossyScale :vec3

  /** The matrix that transforms from local to world space. */
  readonly localToWorldMatrix :mat4
}

/** Contains a mesh. */
export interface MeshFilter extends Component {

  /** The mesh to render. */
  mesh? :Mesh
}

/** A piece of geometry. */
export interface Mesh extends Disposable {}

/** A spherical mesh. */
export interface Sphere extends Mesh {}

/** A cylindrical mesh. */
export interface Cylinder extends Mesh {}

/** A cubic mesh. */
export interface Cube extends Mesh {}

/** A quad mesh. */
export interface Quad extends Mesh {}