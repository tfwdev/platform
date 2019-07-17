import {
  BoxBufferGeometry,
  BufferGeometry,
  GridHelper,
  Math as ThreeMath,
  PerspectiveCamera,
  Scene,
  SphereBufferGeometry,
  Vector3,
  WebGLRenderer,
} from "three"

import {Body, Box, Plane, Quaternion, Shape, Sphere, Vec3} from "cannon"

import {Clock} from "tfw/core/clock"
import {Subject} from "tfw/core/react"
import {DenseValueComponent, Domain, Float32Component} from "tfw/entity/entity"
import {Renderer} from "tfw/scene2/gl"
import {TransformComponent} from "tfw/space/entity"
import {MeshSystem} from "tfw/scene3/entity"
import {Planet} from "tfw/scene3/planet"
import {PhysicsSystem} from "tfw/physics3/entity"
import {RenderFn} from "./index"

export function spaceDemo (renderer :Renderer) :Subject<RenderFn> {
  return Subject.derive(disp => {
    const webglRenderer = new WebGLRenderer()

    const scene = new Scene()
    scene.add(new GridHelper(100, 100))
    const camera = new PerspectiveCamera()
    camera.position.y = 3

    const planet = new Planet(webglRenderer)
    scene.add(planet.group)
    planet.group.position.set(0, 6, -10)

    // replace 2d canvas with 3d one
    const root = renderer.canvas.parentElement as HTMLElement
    root.removeChild(renderer.canvas)
    root.appendChild(webglRenderer.domElement)
    const sizeRemover = renderer.size.onValue(size => {
      webglRenderer.setPixelRatio(window.devicePixelRatio)
      webglRenderer.setSize(size[0], size[1])
      camera.aspect = size[0] / size[1]
      camera.updateProjectionMatrix()
    })

    const trans = new TransformComponent("trans")
    const geom = new DenseValueComponent<BufferGeometry>("geom", new BufferGeometry())
    const shapes = new DenseValueComponent<Shape[]>("shapes", [])
    const mass = new Float32Component("mass", 0)
    const domain = new Domain({}, {trans, geom, shapes, mass})
    const meshsys = new MeshSystem(domain, trans, geom)
    const physicssys = new PhysicsSystem(domain, trans, shapes, mass)
    physicssys.world.gravity.y = -9.8
    physicssys.world.addBody(new Body({
      shape: new Plane(),
      quaternion: new Quaternion().setFromEuler(-Math.PI * 0.5, 0, 0)
    }))
    scene.add(meshsys.group)

    const econfig = {
      components: {trans: {}, geom: {}, shapes: {}, mass: {}}
    }

    const sphereGeom = new SphereBufferGeometry()
    const boxGeom = new BoxBufferGeometry()

    const sphereShapes = [new Sphere(1)]
    const boxShapes = [new Box(new Vec3(0.5, 0.5, 0.5))]

    const origin = new Vector3(0, 3, -10)
    const position = new Vector3()
    for (let ii = 0; ii < 10; ii++) {
      const id = domain.add(econfig)
      if (ii & 1) {
        geom.update(id, sphereGeom)
        shapes.update(id, sphereShapes)
      } else {
        geom.update(id, boxGeom)
        shapes.update(id, boxShapes)
      }
      mass.update(id, 1)
      position.set(
        origin.x + ThreeMath.randFloat(-2, 2),
        origin.y + ThreeMath.randFloat(-2, 2),
        origin.z + ThreeMath.randFloat(-2, 2),
      )
      trans.updatePosition(id, position)
    }

    disp((clock: Clock) => {
      physicssys.update(clock)
      meshsys.update()
      planet.group.rotateY(clock.dt)
      webglRenderer.render(scene, camera)
    })

    return () => {
      sizeRemover()
      // restore 2d canvas
      root.removeChild(webglRenderer.domElement)
      root.appendChild(renderer.canvas)
      planet.dispose()
      webglRenderer.dispose()
    }
  })
}
