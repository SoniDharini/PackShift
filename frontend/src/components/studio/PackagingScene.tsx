import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { Component, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import * as THREE from 'three'
import { FittedIso } from '../visual/IsoBox.tsx'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { formatMm, formatNumber } from '../../lib/format.ts'
import { centredPlacement, statedPackTooSmall } from '../../lib/sceneLayout.ts'
import type { PackagingDesign, TextureKind } from '../../types/packaging.ts'

export type ShadeMode = 'solid' | 'ghost' | 'wire'
export type CameraView = 'iso' | 'front' | 'top' | 'side'

export type PackagingSceneHandle = {
  zoomBy: (factor: number) => void
}

type SceneProps = {
  design: PackagingDesign
  shade: ShadeMode
  cameraView: CameraView
  viewSignal: number
  showDimensions: boolean
  showOutline: boolean
  hero?: boolean
}

type OrbitLike = {
  target: THREE.Vector3
  update: () => void
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

function asOrbit(value: unknown): OrbitLike | null {
  if (!value || typeof value !== 'object') return null
  if (!('target' in value) || !('update' in value)) return null
  return value as OrbitLike
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function makeKraft(kind: TextureKind) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  if (!context) return texture
  const base = kind === 'recycled' ? '#B7A56C' : kind === 'light' ? '#D8C093' : '#C8A56E'
  context.fillStyle = base
  context.fillRect(0, 0, 512, 512)
  for (let x = 0; x < 512; x += 6) {
    context.fillStyle = x % 12 === 0 ? 'rgba(82, 52, 24, 0.16)' : 'rgba(255, 244, 220, 0.2)'
    context.fillRect(x, 0, 2, 512)
  }
  for (let i = 0; i < 1800; i += 1) {
    context.fillStyle = `rgba(70, 46, 22, ${Math.random() * 0.08})`
    context.fillRect(Math.random() * 512, Math.random() * 512, 2, 1)
  }
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function useKraftTexture(kind: TextureKind) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    const next = makeKraft(kind)
    setTexture(next)
    return () => next.dispose()
  }, [kind])
  return texture
}

function frameCamera(view: CameraView, fitMm: number, focusY: number, viewportHeight = 640, ortho = false) {
  const radius = (fitMm / 100) * (ortho ? 2.4 : 3.35) + (ortho ? 0.6 : 2)
  const target = new THREE.Vector3(0, focusY, 0)
  const direction = {
    iso: new THREE.Vector3(0.82, 0.56, 0.9),
    front: new THREE.Vector3(0, 0.08, 1),
    top: new THREE.Vector3(0, 1, 0.001),
    side: new THREE.Vector3(1, 0.08, 0),
  }[view]
    .clone()
    .normalize()
    .multiplyScalar(radius)
  const zoom = ortho ? (viewportHeight * 0.62) / Math.max(fitMm / 100, 0.2) : undefined
  return { position: target.clone().add(direction), target, zoom }
}

function aim(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, tmp: THREE.Vector3, yAxis: THREE.Vector3) {
  tmp.subVectors(to, from)
  const length = Math.max(tmp.length(), 0.001)
  mesh.position.copy(from).addScaledVector(tmp, 0.5)
  mesh.scale.set(0.006, length, 0.006)
  tmp.multiplyScalar(1 / length)
  mesh.quaternion.setFromUnitVectors(yAxis, tmp)
}

const labelPoint = new THREE.Vector3()

function DimensionLabel({ anchor, text }: { anchor: RefObject<THREE.Group | null>; text: string }) {
  const { camera, gl, size } = useThree()
  const el = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const parent = gl.domElement.parentElement
    if (!parent) return
    const node = document.createElement('div')
    node.textContent = text
    node.className =
      'pointer-events-none z-20 whitespace-nowrap rounded-full border border-line bg-white px-2 py-1 text-[11px] font-medium text-forest shadow-sm'
    node.style.position = 'absolute'
    node.style.left = '0'
    node.style.top = '0'
    parent.appendChild(node)
    el.current = node
    return () => {
      node.remove()
      el.current = null
    }
  }, [gl, text])

  useFrame(() => {
    const node = el.current
    const group = anchor.current
    if (!node || !group) return
    const vector = group.getWorldPosition(labelPoint)
    vector.project(camera)
    const x = (vector.x * 0.5 + 0.5) * size.width
    const y = (-vector.y * 0.5 + 0.5) * size.height
    node.style.display = vector.z > 1 ? 'none' : 'block'
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
  })

  return null
}

function Carton({
  design,
  shade,
  showDimensions,
  reduced,
}: {
  design: PackagingDesign
  shade: ShadeMode
  showDimensions: boolean
  reduced: boolean
}) {
  const texture = useKraftTexture(design.material.texture)
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), [])
  const productMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6E7C8A', roughness: 0.62 }), [])
  const outer = useRef<THREE.Mesh>(null)
  const cavity = useRef<THREE.LineSegments>(null)
  const product = useRef<THREE.Mesh>(null)
  const lengthShaft = useRef<THREE.Mesh>(null)
  const widthShaft = useRef<THREE.Mesh>(null)
  const heightShaft = useRef<THREE.Mesh>(null)
  const lengthLabel = useRef<THREE.Group>(null)
  const widthLabel = useRef<THREE.Group>(null)
  const heightLabel = useRef<THREE.Group>(null)
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), [])
  const fromV = useMemo(() => new THREE.Vector3(), [])
  const toV = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const layout = centredPlacement(design.product, design.internal, design.external)
  const cur = useRef({
    x: layout.external.x,
    y: layout.external.y,
    z: layout.external.z,
    ix: layout.internal.x,
    iy: layout.internal.y,
    iz: layout.internal.z,
    px: layout.product.x,
    py: layout.product.y,
    pz: layout.product.z,
    cy: layout.productCenterY,
    iy0: layout.internalCenterY,
  })

  useEffect(() => () => {
    shell.dispose()
    productMaterial.dispose()
    edges.dispose()
  }, [edges, productMaterial, shell])

  useEffect(() => {
    const ghost = shade === 'ghost'
    const wire = shade === 'wire'
    shell.wireframe = wire
    shell.map = wire ? null : texture
    shell.color.set(wire ? '#146E54' : texture ? '#ffffff' : '#C6A36E')
    shell.transparent = ghost
    shell.opacity = ghost ? 0.28 : 1
    shell.depthWrite = !ghost
    shell.polygonOffset = ghost
    shell.polygonOffsetFactor = ghost ? 1 : 0
    shell.side = ghost ? THREE.FrontSide : THREE.FrontSide
    shell.needsUpdate = true
    const statedClash = design.existing ? statedPackTooSmall(design.product, design.existing.size) : false
    productMaterial.color.set(layout.fits && !statedClash ? '#6E7C8A' : '#9C3B2E')
    productMaterial.depthWrite = true
    productMaterial.transparent = false
  }, [design.existing, design.product, layout.fits, productMaterial, shade, shell, texture])

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05)
    const next = cur.current
    const lambda = reduced ? 40 : 7
    const place = centredPlacement(design.product, design.internal, design.external)
    const damp = (value: number, target: number) => THREE.MathUtils.damp(value, target, lambda, step)
    next.x = damp(next.x, place.external.x)
    next.y = damp(next.y, place.external.y)
    next.z = damp(next.z, place.external.z)
    next.ix = damp(next.ix, place.internal.x)
    next.iy = damp(next.iy, place.internal.y)
    next.iz = damp(next.iz, place.internal.z)
    next.px = damp(next.px, place.product.x)
    next.py = damp(next.py, place.product.y)
    next.pz = damp(next.pz, place.product.z)
    next.cy = damp(next.cy, place.productCenterY)
    next.iy0 = damp(next.iy0, place.internalCenterY)
    outer.current?.scale.set(next.x, next.y, next.z)
    outer.current?.position.set(0, next.y / 2, 0)
    cavity.current?.scale.set(next.ix, next.iy, next.iz)
    cavity.current?.position.set(0, next.iy0, 0)
    cavity.current?.computeLineDistances()
    product.current?.scale.set(next.px, next.py, next.pz)
    product.current?.position.set(0, next.cy, 0)
    if (showDimensions && lengthShaft.current && widthShaft.current && heightShaft.current) {
      fromV.set(-next.x / 2, -0.14, next.z / 2 + 0.22)
      toV.set(next.x / 2, -0.14, next.z / 2 + 0.22)
      aim(lengthShaft.current, fromV, toV, tmp, yAxis)
      fromV.set(next.x / 2 + 0.22, -0.14, -next.z / 2)
      toV.set(next.x / 2 + 0.22, -0.14, next.z / 2)
      aim(widthShaft.current, fromV, toV, tmp, yAxis)
      fromV.set(-next.x / 2 - 0.22, 0, next.z / 2 + 0.16)
      toV.set(-next.x / 2 - 0.22, next.y, next.z / 2 + 0.16)
      aim(heightShaft.current, fromV, toV, tmp, yAxis)
      lengthLabel.current?.position.set(0, 0.02, next.z / 2 + 0.22)
      widthLabel.current?.position.set(next.x / 2 + 0.22, 0.02, 0)
      heightLabel.current?.position.set(-next.x / 2 - 0.22, next.y / 2, next.z / 2 + 0.16)
    }
  })

  const showCavity = shade !== 'solid'

  return (
    <group>
      <mesh ref={outer} material={shell} renderOrder={shade === 'ghost' ? 2 : 0} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {showCavity ? (
        <lineSegments ref={cavity} geometry={edges} renderOrder={3}>
          <lineDashedMaterial color="#146E54" dashSize={0.05} gapSize={0.035} />
        </lineSegments>
      ) : null}
      <mesh ref={product} material={productMaterial} renderOrder={1}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {showDimensions ? (
        <>
          <mesh ref={lengthShaft}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#142923" />
          </mesh>
          <mesh ref={widthShaft}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#142923" />
          </mesh>
          <mesh ref={heightShaft}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#142923" />
          </mesh>
          <group ref={lengthLabel}>
            <DimensionLabel anchor={lengthLabel} text={`L ${formatMm(design.external.l)}`} />
          </group>
          <group ref={widthLabel}>
            <DimensionLabel anchor={widthLabel} text={`W ${formatMm(design.external.w)}`} />
          </group>
          <group ref={heightLabel}>
            <DimensionLabel anchor={heightLabel} text={`H ${formatMm(design.external.h)}`} />
          </group>
        </>
      ) : null}
    </group>
  )
}

function OutlineBox({ design }: { design: PackagingDesign }) {
  const existing = design.existing
  if (!existing) return null
  const clashes = statedPackTooSmall(design.product, existing.size)
  return (
    <mesh position={[0, existing.size.h / 200, 0]} raycast={() => null}>
      <boxGeometry args={[existing.size.l / 100, existing.size.h / 100, existing.size.w / 100]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color={clashes ? '#9C3B2E' : '#5C6B64'} threshold={15} />
    </mesh>
  )
}

function StudioRig({
  imperativeRef,
  cameraView,
  viewSignal,
  fitMm,
  focusY,
  reduced,
}: {
  imperativeRef: Ref<PackagingSceneHandle>
  cameraView: CameraView
  viewSignal: number
  fitMm: number
  focusY: number
  reduced: boolean
}) {
  const { camera, controls, size } = useThree()
  const desiredPos = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3())
  const desiredZoom = useRef<number | null>(null)
  const anim = useRef(false)
  const ready = useRef(false)
  const fitRef = useRef(fitMm)
  const focusRef = useRef(focusY)
  fitRef.current = fitMm
  focusRef.current = focusY

  useEffect(() => {
    const orbit = asOrbit(controls)
    if (!orbit) return
    const stop = () => {
      anim.current = false
    }
    orbit.addEventListener('start', stop)
    return () => orbit.removeEventListener('start', stop)
  }, [controls])

  useEffect(() => {
    const ortho = camera instanceof THREE.OrthographicCamera
    const framed = frameCamera(cameraView, fitRef.current, focusRef.current, size.height, ortho)
    desiredPos.current.copy(framed.position)
    desiredTarget.current.copy(framed.target)
    desiredZoom.current = framed.zoom ?? null
    const orbit = asOrbit(controls)
    const applyZoom = () => {
      if (camera instanceof THREE.OrthographicCamera && framed.zoom) {
        camera.zoom = framed.zoom
        camera.updateProjectionMatrix()
      }
    }
    if (!ready.current) {
      camera.position.copy(framed.position)
      camera.lookAt(framed.target)
      applyZoom()
      if (orbit) {
        orbit.target.copy(framed.target)
        orbit.update()
      }
      ready.current = true
      anim.current = false
      return
    }
    if (reduced) {
      camera.position.copy(framed.position)
      camera.lookAt(framed.target)
      applyZoom()
      if (orbit) {
        orbit.target.copy(framed.target)
        orbit.update()
      }
      anim.current = false
      return
    }
    anim.current = true
  }, [camera, cameraView, controls, reduced, size.height, viewSignal])

  useImperativeHandle(
    imperativeRef,
    () => ({
      zoomBy(factor: number) {
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, 12, 600)
          camera.updateProjectionMatrix()
          desiredZoom.current = camera.zoom
          return
        }
        const orbit = asOrbit(controls)
        const target = orbit?.target.clone() ?? desiredTarget.current.clone()
        const offset = camera.position.clone().sub(target)
        offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 1.8, 18))
        desiredPos.current.copy(target).add(offset)
        desiredTarget.current.copy(target)
        if (reduced) {
          camera.position.copy(desiredPos.current)
          camera.lookAt(target)
          if (orbit) {
            orbit.target.copy(target)
            orbit.update()
          }
          return
        }
        anim.current = true
      },
    }),
    [camera, controls, reduced],
  )

  useFrame((_, delta) => {
    if (!anim.current) return
    const orbit = asOrbit(controls)
    const t = reduced ? 1 : 1 - Math.exp(-7 * Math.min(delta, 0.05))
    camera.position.lerp(desiredPos.current, t)
    if (orbit) {
      orbit.target.lerp(desiredTarget.current, t)
      camera.lookAt(orbit.target)
      orbit.update()
    } else {
      camera.lookAt(desiredTarget.current)
    }
    if (camera instanceof THREE.OrthographicCamera && desiredZoom.current) {
      camera.zoom = THREE.MathUtils.damp(camera.zoom, desiredZoom.current, 7, Math.min(delta, 0.05))
      camera.updateProjectionMatrix()
    }
    if (camera.position.distanceTo(desiredPos.current) < 0.02) anim.current = false
  })

  return (
    <OrbitControls
      makeDefault
      target={[0, focusY, 0]}
      enableDamping={!reduced}
      dampingFactor={0.08}
      enablePan
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2.04}
      minDistance={1.8}
      maxDistance={18}
    />
  )
}

function HeroRig({ fitMm, focusY, reduced }: { fitMm: number; focusY: number; reduced: boolean }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    const framed = frameCamera('iso', fitMm, focusY)
    camera.position.copy(framed.position)
    camera.lookAt(framed.target)
    const orbit = asOrbit(controls)
    if (orbit) {
      orbit.target.copy(framed.target)
      orbit.update()
    }
  }, [camera, controls, fitMm, focusY])

  return (
    <OrbitControls
      makeDefault
      target={[0, focusY, 0]}
      enablePan={false}
      enableZoom={false}
      autoRotate={!reduced}
      autoRotateSpeed={0.55}
      minPolarAngle={0.4}
      maxPolarAngle={Math.PI / 2.2}
    />
  )
}

function SceneInner({
  design,
  shade,
  cameraView,
  viewSignal,
  showDimensions,
  showOutline,
  hero = false,
  imperativeRef,
}: SceneProps & { imperativeRef: Ref<PackagingSceneHandle> }) {
  const reduced = usePrefersReducedMotion()
  const outlineMm = showOutline && design.existing ? Math.max(design.existing.size.l, design.existing.size.w, design.existing.size.h) : 0
  const fitMm = Math.max(design.external.l, design.external.w, design.external.h, outlineMm)
  const focusY = ((showOutline && design.existing ? Math.max(design.external.h, design.existing.size.h) : design.external.h) / 100) * 0.46

  return (
    <>
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#f7f8f4', '#d9c4a0', 0.48]} />
      <directionalLight position={[4.5, 6.4, 3.4]} intensity={1.45} />
      <directionalLight position={[-3.2, 2.4, -2]} intensity={0.38} />
      <directionalLight position={[0.4, 2.2, 4.2]} intensity={0.32} />
      {showOutline ? <OutlineBox design={design} /> : null}
      <Carton design={design} shade={shade} showDimensions={showDimensions} reduced={reduced} />
      {hero ? (
        <HeroRig fitMm={fitMm} focusY={focusY} reduced={reduced} />
      ) : (
        <StudioRig
          imperativeRef={imperativeRef}
          cameraView={cameraView}
          viewSignal={viewSignal}
          fitMm={fitMm}
          focusY={focusY}
          reduced={reduced}
        />
      )}
    </>
  )
}

function SceneFallback({ design }: { design: PackagingDesign }) {
  const place = centredPlacement(design.product, design.internal, design.external)
  const clash = design.existing ? statedPackTooSmall(design.product, design.existing.size) : false
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="h-52">
          <FittedIso
            length={design.external.l}
            width={design.external.w}
            height={design.external.h}
            label={`Outer carton ${formatMm(design.external.l)} by ${formatMm(design.external.w)} by ${formatMm(design.external.h)}`}
          />
        </div>
        <div className="h-40 self-center">
          <FittedIso
            length={design.product.l}
            width={design.product.w}
            height={design.product.h}
            label={`Product ${formatMm(design.product.l)} by ${formatMm(design.product.w)} by ${formatMm(design.product.h)}`}
          />
        </div>
      </div>
      <p className="max-w-md text-sm leading-6 text-secondary">
        Product {formatMm(design.product.l)} × {formatNumber(design.product.w)} × {formatNumber(design.product.h)} mm, centered in an internal cavity of {formatMm(design.internal.l)} × {formatNumber(design.internal.w)} × {formatNumber(design.internal.h)} mm.
        Clearance {formatNumber(place.clearanceMm.l)} × {formatNumber(place.clearanceMm.w)} × {formatNumber(place.clearanceMm.h)} mm. Outer {formatMm(design.external.l)} × {formatNumber(design.external.w)} × {formatNumber(design.external.h)} mm.
        {place.fits ? '' : ' The product is larger than the internal cavity and is not scaled down.'}
        {clash ? ' The stated current pack is smaller than the product on at least one axis.' : ''}
      </p>
    </div>
  )
}

class WebGLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(error: Error) {
    void error
    return { failed: true }
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

const PackagingScene = function PackagingScene(
  props: SceneProps & { imperativeRef?: Ref<PackagingSceneHandle> },
) {
  const [ok] = useState(hasWebGL)
  const ref = props.imperativeRef ?? null
  if (!ok) return <SceneFallback design={props.design} />
  const initial = frameCamera(
    'iso',
    Math.max(props.design.external.l, props.design.external.w, props.design.external.h, props.showOutline && props.design.existing ? props.design.existing.size.l : 0),
    props.design.external.h / 200,
    640,
    !props.hero,
  )
  return (
    <WebGLBoundary fallback={<SceneFallback design={props.design} />}>
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.75]}
        orthographic={!props.hero}
        camera={
          props.hero
            ? { position: [initial.position.x, initial.position.y, initial.position.z], fov: 32, near: 0.05, far: 80 }
            : { position: [initial.position.x, initial.position.y, initial.position.z], zoom: initial.zoom ?? 60, near: 0.1, far: 200 }
        }
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.08
        }}
      >
        <Suspense fallback={null}>
          <SceneInner {...props} imperativeRef={ref} />
        </Suspense>
      </Canvas>
    </WebGLBoundary>
  )
}

export default PackagingScene
