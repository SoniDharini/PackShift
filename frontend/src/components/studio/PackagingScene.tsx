import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Html, OrbitControls } from '@react-three/drei'
import { Component, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import * as THREE from 'three'
import { FittedIso } from '../visual/IsoBox.tsx'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { formatMm } from '../../lib/format.ts'
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

function frameCamera(view: CameraView, fitMm: number, focusY: number) {
  const radius = (fitMm / 100) * 3.35 + 2
  const target = new THREE.Vector3(0, focusY, 0)
  const direction = {
    iso: new THREE.Vector3(0.82, 0.56, 0.9),
    front: new THREE.Vector3(0, 0.14, 1),
    top: new THREE.Vector3(0.04, 1, 0.16),
    side: new THREE.Vector3(1, 0.14, 0),
  }[view]
    .clone()
    .normalize()
    .multiplyScalar(radius)
  return { position: target.clone().add(direction), target }
}

function aim(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, tmp: THREE.Vector3, yAxis: THREE.Vector3) {
  tmp.subVectors(to, from)
  const length = Math.max(tmp.length(), 0.001)
  mesh.position.copy(from).addScaledVector(tmp, 0.5)
  mesh.scale.set(0.006, length, 0.006)
  tmp.multiplyScalar(1 / length)
  mesh.quaternion.setFromUnitVectors(yAxis, tmp)
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
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), [])
  const bottom = useRef<THREE.Mesh>(null)
  const front = useRef<THREE.Mesh>(null)
  const back = useRef<THREE.Mesh>(null)
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const frontHinge = useRef<THREE.Group>(null)
  const backHinge = useRef<THREE.Group>(null)
  const leftHinge = useRef<THREE.Group>(null)
  const rightHinge = useRef<THREE.Group>(null)
  const frontFlap = useRef<THREE.Mesh>(null)
  const backFlap = useRef<THREE.Mesh>(null)
  const leftFlap = useRef<THREE.Mesh>(null)
  const rightFlap = useRef<THREE.Mesh>(null)
  const productRef = useRef<THREE.Group>(null)
  const lengthShaft = useRef<THREE.Mesh>(null)
  const widthShaft = useRef<THREE.Mesh>(null)
  const heightShaft = useRef<THREE.Mesh>(null)
  const lengthLabel = useRef<THREE.Group>(null)
  const widthLabel = useRef<THREE.Group>(null)
  const heightLabel = useRef<THREE.Group>(null)
  const fromV = useMemo(() => new THREE.Vector3(), [])
  const toV = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const target = {
    L: design.external.l / 100,
    W: design.external.w / 100,
    H: design.external.h / 100,
    t: Math.max(design.thickness / 100, 0.012),
  }
  const cur = useRef(target)

  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const wire = shade === 'wire'
    material.wireframe = wire
    material.map = wire ? null : texture
    material.color.set(wire ? '#146E54' : texture ? '#ffffff' : '#C6A36E')
    material.transparent = shade === 'ghost'
    material.opacity = shade === 'ghost' ? 0.42 : 1
    material.depthWrite = shade !== 'ghost'
    material.needsUpdate = true
  }, [material, shade, texture])

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05)
    const next = cur.current
    const lambda = reduced ? 40 : 7
    next.L = THREE.MathUtils.damp(next.L, design.external.l / 100, lambda, step)
    next.W = THREE.MathUtils.damp(next.W, design.external.w / 100, lambda, step)
    next.H = THREE.MathUtils.damp(next.H, design.external.h / 100, lambda, step)
    next.t = THREE.MathUtils.damp(next.t, Math.max(design.thickness / 100, 0.012), lambda, step)

    const { L, W, H } = next
    const t = Math.min(next.t, L / 3, W / 3, H / 2.2)
    const wallH = Math.max(H - t, 0.02)
    const sideSpan = Math.max(W - 2 * t, 0.02)
    const flapDepth = Math.max((W - 2 * t) / 2, 0.03)
    const majorW = Math.max(L - 2 * t - 0.04, 0.04)
    const minorW = Math.max(sideSpan - 0.05, 0.04)
    const yWall = t + wallH / 2

    const place = (mesh: THREE.Mesh | null, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (!mesh) return
      mesh.position.set(x, y, z)
      mesh.scale.set(Math.max(sx, 0.001), Math.max(sy, 0.001), Math.max(sz, 0.001))
    }
    place(bottom.current, 0, t / 2, 0, L, t, W)
    place(front.current, 0, yWall, W / 2 - t / 2, L, wallH, t)
    place(back.current, 0, yWall, -(W / 2 - t / 2), L, wallH, t)
    place(left.current, -(L / 2 - t / 2), yWall, 0, t, wallH, sideSpan)
    place(right.current, L / 2 - t / 2, yWall, 0, t, wallH, sideSpan)

    const angle = 0.78
    if (frontHinge.current) {
      frontHinge.current.position.set(0, H, W / 2 - t / 2)
      frontHinge.current.rotation.set(-angle, 0, 0)
    }
    if (backHinge.current) {
      backHinge.current.position.set(0, H, -(W / 2 - t / 2))
      backHinge.current.rotation.set(angle, 0, 0)
    }
    if (leftHinge.current) {
      leftHinge.current.position.set(-(L / 2 - t / 2), H, 0)
      leftHinge.current.rotation.set(0, 0, -angle)
    }
    if (rightHinge.current) {
      rightHinge.current.position.set(L / 2 - t / 2, H, 0)
      rightHinge.current.rotation.set(0, 0, angle)
    }
    place(frontFlap.current, 0, 0, flapDepth / 2, majorW, t, flapDepth)
    place(backFlap.current, 0, 0, -flapDepth / 2, majorW, t, flapDepth)
    place(leftFlap.current, -flapDepth / 2, 0, 0, flapDepth, t, minorW)
    place(rightFlap.current, flapDepth / 2, 0, 0, flapDepth, t, minorW)

    const productH = design.product.h / 100
    if (productRef.current) productRef.current.position.set(0, t + productH / 2, 0)

    if (showDimensions && lengthShaft.current && widthShaft.current && heightShaft.current) {
      fromV.set(-L / 2, -0.14, W / 2 + 0.22)
      toV.set(L / 2, -0.14, W / 2 + 0.22)
      aim(lengthShaft.current, fromV, toV, tmp, yAxis)
      fromV.set(L / 2 + 0.22, -0.14, -W / 2)
      toV.set(L / 2 + 0.22, -0.14, W / 2)
      aim(widthShaft.current, fromV, toV, tmp, yAxis)
      fromV.set(-L / 2 - 0.22, 0, W / 2 + 0.16)
      toV.set(-L / 2 - 0.22, H, W / 2 + 0.16)
      aim(heightShaft.current, fromV, toV, tmp, yAxis)
      lengthLabel.current?.position.set(0, 0.02, W / 2 + 0.22)
      widthLabel.current?.position.set(L / 2 + 0.22, 0.02, 0)
      heightLabel.current?.position.set(-L / 2 - 0.22, H / 2, W / 2 + 0.16)
    }
  })

  const productL = design.product.l / 100
  const productW = design.product.w / 100
  const productH = design.product.h / 100
  const radius = (productW / 2) * 0.92
  const mugShift = -productL / 2 + radius

  const panel = (ref: Ref<THREE.Mesh>) => (
    <mesh ref={ref} material={material} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  )

  return (
    <group>
      {panel(bottom)}
      {panel(front)}
      {panel(back)}
      {panel(left)}
      {panel(right)}
      <group ref={frontHinge}>{panel(frontFlap)}</group>
      <group ref={backHinge}>{panel(backFlap)}</group>
      <group ref={leftHinge}>{panel(leftFlap)}</group>
      <group ref={rightHinge}>{panel(rightFlap)}</group>
      <group ref={productRef}>
        {design.category === 'Drinkware' ? (
          <group position={[mugShift, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[radius, radius * 0.94, productH, 40]} />
              <meshStandardMaterial color="#F4F1EA" roughness={0.32} metalness={0.02} />
            </mesh>
            <mesh position={[radius * 0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[productH * 0.16, Math.min(0.035, radius * 0.18), 12, 24, Math.PI]} />
              <meshStandardMaterial color="#F4F1EA" roughness={0.32} />
            </mesh>
          </group>
        ) : (
          <mesh>
            <boxGeometry args={[productL, productH, productW]} />
            <meshStandardMaterial color="#E5DDD2" roughness={0.64} />
          </mesh>
        )}
      </group>
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
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <span className="whitespace-nowrap rounded-full border border-line bg-white px-2 py-1 text-[11px] font-medium text-forest shadow-sm">
                L {formatMm(design.external.l)}
              </span>
            </Html>
          </group>
          <group ref={widthLabel}>
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <span className="whitespace-nowrap rounded-full border border-line bg-white px-2 py-1 text-[11px] font-medium text-forest shadow-sm">
                W {formatMm(design.external.w)}
              </span>
            </Html>
          </group>
          <group ref={heightLabel}>
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <span className="whitespace-nowrap rounded-full border border-line bg-white px-2 py-1 text-[11px] font-medium text-forest shadow-sm">
                H {formatMm(design.external.h)}
              </span>
            </Html>
          </group>
        </>
      ) : null}
    </group>
  )
}

function OutlineBox({ design }: { design: PackagingDesign }) {
  const existing = design.existing
  if (!existing) return null
  return (
    <mesh position={[0, existing.size.h / 200, 0]} raycast={() => null}>
      <boxGeometry args={[existing.size.l / 100, existing.size.h / 100, existing.size.w / 100]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#5C6B64" threshold={15} />
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
  const { camera, controls } = useThree()
  const desiredPos = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3())
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
    const framed = frameCamera(cameraView, fitRef.current, focusRef.current)
    desiredPos.current.copy(framed.position)
    desiredTarget.current.copy(framed.target)
    const orbit = asOrbit(controls)
    if (!ready.current) {
      camera.position.copy(framed.position)
      camera.lookAt(framed.target)
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
      if (orbit) {
        orbit.target.copy(framed.target)
        orbit.update()
      }
      anim.current = false
      return
    }
    anim.current = true
  }, [camera, cameraView, controls, reduced, viewSignal])

  useImperativeHandle(
    imperativeRef,
    () => ({
      zoomBy(factor: number) {
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
    if (camera.position.distanceTo(desiredPos.current) < 0.02) anim.current = false
  })

  return (
    <OrbitControls
      makeDefault
      target={[0, focusY, 0]}
      enableDamping={!reduced}
      dampingFactor={0.08}
      enablePan
      minPolarAngle={0.05}
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
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="h-56 w-full max-w-sm">
        <FittedIso
          length={design.external.l}
          width={design.external.w}
          height={design.external.h}
          label={`Isometric carton ${formatMm(design.external.l)} by ${formatMm(design.external.w)} by ${formatMm(design.external.h)}`}
        />
      </div>
      <p className="max-w-sm text-sm text-secondary">Interactive 3D needs WebGL. This isometric view still uses the calculated outer size.</p>
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
  const initial = frameCamera('iso', Math.max(props.design.external.l, props.design.external.w, props.design.external.h, props.showOutline && props.design.existing ? props.design.existing.size.l : 0), props.design.external.h / 200)
  return (
    <WebGLBoundary fallback={<SceneFallback design={props.design} />}>
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.75]}
        camera={{ position: [initial.position.x, initial.position.y, initial.position.z], fov: 32, near: 0.05, far: 80 }}
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
