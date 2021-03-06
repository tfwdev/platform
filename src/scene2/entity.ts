import {Clock} from "../core/clock"
import {Color} from "../core/color"
import {ArrayComponent, Component, Domain, EntityConfig, ID, Matcher, System,
        Float32ArrayComponent} from "../entity/entity"
import {QuadBatch} from "./batch"
import {Tile} from "./gl"
import {mat2d, vec2, vec2zero} from "../core/math"
import {Transform, updateMatrix, multiplyMatrix} from "./transform"

// offsets into the transform buffer for our various properties
// note: these must be kept in sync with transform.ts
const OX = 6
const OY = 7
const TX = 8
const TY = 9
const SX = 10
const SY = 11
const RO  = 12
const DT  = 13

/** A collection of 2D transforms for sprite-like entities. A transform includes translation,
  * rotation, scale and origin. These individual components are combined into a transform matrix
  * which can then be used to render the sprite using [[RenderSystem]]. */
export class TransformComponent extends Float32ArrayComponent {

  constructor (id :string, batchBits :number = 8) { super(id, Transform.Default, batchBits) }

  /** Returns the `Transform` for entity `id`. */
  readTransform (id :ID) :Transform {
    const batch = this.batch(id), start = this.start(id)
    return new Transform(batch.subarray(start, start+DT+1))
  }

  /** Copies the origin of entity `id` into `into`.
    * @return the supplied `into` vector. */
  readOrigin (id :ID, into :vec2) :vec2 {
    const batch = this.batch(id), start = this.start(id)
    return vec2.set(into, batch[start+OX], batch[start+OY])
  }

  /** Copies the translation of entity `id` into `into`.
    * @return the supplied `into` vector. */
  readTranslation (id :ID, into :vec2) :vec2 {
    const batch = this.batch(id), start = this.start(id)
    return vec2.set(into, batch[start+TX], batch[start+TY])
  }
  /** Reads and returns the x translation of entity `id`. */
  readTx (id :ID) :number {
    return this.batch(id)[this.start(id)+TX]
  }
  /** Reads and returns the y translation of entity `id`. */
  readTy (id :ID) :number {
    return this.batch(id)[this.start(id)+TY]
  }

  /** Copies the scale of entity `id` into `into`.
    * @return the supplied `into` vector. */
  readScale (id :ID, into :vec2) :vec2 {
    const batch = this.batch(id), start = this.start(id)
    return vec2.set(into, batch[start+SX], batch[start+SY])
  }
  /** Reads and returns the x scale of entity `id`. */
  readSx (id :ID) :number {
    return this.batch(id)[this.start(id)+SX]
  }
  /** Reads and returns the y scale of entity `id`. */
  readSy (id :ID) :number {
    return this.batch(id)[this.start(id)+SY]
  }

  /** Reads and returns the rotation of entity `id`. */
  readRotation (id :ID) :number {
    return this.batch(id)[this.start(id)+RO]
  }

  /** Reads the transform matrix for entity `id`. */
  readMatrix (id :ID, into? :mat2d) :mat2d {
    const batch = this.batch(id), start = this.start(id)
    if (into) {
      into[0] = batch[start+0]
      into[1] = batch[start+1]
      into[2] = batch[start+2]
      into[3] = batch[start+3]
      into[4] = batch[start+4]
      into[5] = batch[start+5]
      return into
    }
    else return batch.subarray(start, start+6) as mat2d
  }

  /** Sets the origin of entity `id` to `origin`. */
  updateOrigin (id :ID, origin :vec2) {
    const batch = this.batch(id), start = this.start(id)
    batch[start+OX] = origin[0]
    batch[start+OY] = origin[1]
    batch[start+DT] = 1
  }

  /** Sets the translation of entity `id` to `trans`. */
  updateTranslation (id :ID, trans :vec2) {
    const batch = this.batch(id), start = this.start(id)
    batch[start+TX] = trans[0]
    batch[start+TY] = trans[1]
    batch[start+DT] = 1
  }

  /** Sets the scale of entity `id` to `scale`. */
  updateScale (id :ID, scale :vec2) {
    const batch = this.batch(id), start = this.start(id)
    batch[start+SX] = scale[0]
    batch[start+SY] = scale[1]
    batch[start+DT] = 1
  }

  /** Sets the rotation of entity `id` to `rot` (in radians). */
  updateRotation (id :ID, rot :number) {
    const batch = this.batch(id), start = this.start(id)
    batch[start+RO] = rot
    batch[start+DT] = 1
  }

  /** Updates the transform matrices of all dirty components. */
  updateMatrices (force :boolean, parent :Transform) {
    this.onComponents((id, data, offset, size) => {
      if (force || data[offset+DT] === 1) {
        updateMatrix(data, offset)
        multiplyMatrix(data, offset, parent.data, 0, data, offset)
      }
    })
  }
}

const tmppos = vec2.create(), tmpvel = vec2.create(), tmpacc = vec2.create()

/** Handles simple dynamics for an entity. Applies (optional) acceleration to velocity on every
  * frame, then applies velocity to the translation of a [[TransformComponent]]. Users of this
  * system must call [[DynamicsSystem.update]] on every frame with the [[Clock]]. */
export class DynamicsSystem extends System {

  constructor (domain :Domain,
               readonly trans :TransformComponent,
               readonly vel :ArrayComponent<vec2>,
               readonly acc? :ArrayComponent<vec2>) {
    super(domain, acc ? Matcher.hasAllC(trans.id, vel.id, acc.id) :
          Matcher.hasAllC(trans.id, vel.id))
  }

  update (clock :Clock) {
    const dt = clock.dt
    this.onEntities(id => {
      const vel = this.vel.read(id, tmpvel)
      if (this.acc) {
        const acc = this.acc.read(id, tmpacc)
        if (acc[0] !== 0 || acc[1] !== 0) this.vel.update(id, vec2.scaleAndAdd(vel, vel, acc, dt))
      }
      if (vel[0] !== 0 || vel[1] !== 0) {
        const pos = this.trans.readTranslation(id, tmppos)
        this.trans.updateTranslation(id, vec2.scaleAndAdd(pos, pos, vel, dt))
      }
    })
  }
}

const noTint = Color.fromRGB(1, 1, 1)
const ttrans = mat2d.create()
const ttint = Color.create()

/** The components used by the render system. */
export type RenderComponents = {
  trans :TransformComponent
  tile :Component<Tile>
  tint? :ArrayComponent<Color>
  layer? :Component<number>
}

function makeMatcher (comps :RenderComponents) {
  const ids = [comps.trans.id, comps.tile.id]
  if (comps.tint) ids.push(comps.tint.id)
  if (comps.layer) ids.push(comps.layer.id)
  return Matcher.hasAllC(...ids)
}

/** Renders textured quads based on a [[TransformComponent]] and a component providing a [[Tile]]
  * for each quad. Optionally a [[Color]] component can be provided to tint the rendered quads.
  *
  * A `layer` component may also be provided to define the render order of the quads (lower layers
  * rendered before higher layers). Note: layers must be positive integers and should ideally not
  * have large gaps as the render system will attempt to render every layer starting at 0 up to the
  * highest numbered layer. Though it is relatively cheap to skip a layer with zero elements, you
  * don't want to unnecessarily add a 10,000 iteration NOOP loop by needlessly sticking things on
  * very high layers.
  *
  * Users of this system must call [[RenderSystem.update]] on every frame, and then
  * [[RenderSystem.render]] with the [[QuadBatch]] into which to render. */
export class RenderSystem extends System {
  private readonly layerCounts :number[] = []

  /** A parent transform for this render system. It will be pre-multiplied to the transform of all
    * entities in the system. */
  readonly systrans = new Transform()

  constructor (domain :Domain, readonly comps :RenderComponents) {
    super(domain, makeMatcher(comps))

    if (comps.layer) comps.layer.addObserver((id, v, ov) => {
      this.layerCounts[ov] -= 1
      this.layerCounts[v] = (this.layerCounts[v] || 0) + 1
    })
  }

  update () {
    // if our parent transform is dirty, update it and force update of all entities
    const systrans = this.systrans
    const sysdirty = systrans.data[DT] === 1
    if (sysdirty) updateMatrix(systrans.data, 0)
    this.comps.trans.updateMatrices(sysdirty, systrans)
  }

  render (batch :QuadBatch) {
    const {tile, trans, tint, layer} = this.comps
    const render = (id :ID) => {
      const etile = tile.read(id)
      const etrans = trans.readMatrix(id, ttrans)
      const etint = tint ? tint.read(id, ttint) : noTint
      batch.addTile(etile, etint, etrans, vec2zero, etile.size)
    }
    if (!layer) this.onEntities(render)
    else {
      for (let ll = 0, lc = this.layerCounts.length; ll < lc; ll += 1) {
        if (this.layerCounts[ll] > 0) this.onEntities(id => {
          const elayer = layer.read(id)
          if (elayer === ll) render(id)
        })
      }
    }
  }

  protected added (id :ID, config :EntityConfig) {
    super.added(id, config)
    if (this.comps.layer) {
      const layer = this.comps.layer.read(id)
      this.layerCounts[layer] = (this.layerCounts[layer] || 0) + 1
    }
  }

  protected deleted (id :ID) {
    super.deleted(id)
    if (this.comps.layer) this.layerCounts[this.comps.layer.read(id)] -= 1
  }
}
