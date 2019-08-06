import {KeyType, ValueType} from "../core/codec"
import {DHandler, DObjectType} from "./data"

//
// Metadata decorators

type ValueMeta = {type: "value", vtype: ValueType}
type SetMeta = {type: "set", etype: ValueType}
type MapMeta = {type: "map", ktype: KeyType, vtype: ValueType}
type CollectionMeta = {type: "collection", ktype: KeyType, otype: DObjectType}
type QueueMeta = {type: "queue", mtype: ValueType}
type Meta = ValueMeta | SetMeta | MapMeta | CollectionMeta | QueueMeta

export function getPropMetas (proto :Function|Object) :Map<string, Meta> {
  const atarget = proto as any
  const props = atarget["__props__"]
  if (props) return props
  return atarget["__props__"] = new Map()
}

export function dobject (ctor :Function) {
  // const atarget = ctor.prototype as any
  // TODO: anything?
}

const propAdder = (prop :Meta) =>
  (proto :Function|Object, name :string, descrip? :PropertyDescriptor) =>
    void getPropMetas(proto).set(name, prop)

export const dvalue = (vtype :ValueType) =>
  propAdder({type: "value", vtype})
export const dset = (etype :ValueType) =>
  propAdder({type: "set", etype})
export const dmap = (ktype :KeyType, vtype :ValueType) =>
  propAdder({type: "map", ktype, vtype})
export const dqueue = <O,M>(mtype :ValueType, handler :DHandler<O,M>) =>
  propAdder({type: "queue", mtype})
export const dcollection = (ktype :KeyType, otype :DObjectType) =>
  propAdder({type: "collection", ktype, otype})
