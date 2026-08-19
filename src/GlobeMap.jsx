import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { eventMarkerHtml, assetMarkerHtml } from './markers'

const R = 100

export default function GlobeMap({ events, assets, selected, onSelect, showRadiusFor, acked, timeMode }) {
  const [mode, setMode] = useState('globe')
  const [MapView, setMapView] = useState(null)
  const [hud, setHud] = useState({ lat: 20.5, lng: 78.9, alt: 2.4 })
  const [status, setStatus] = useState('booting')
  const hostRef = useRef(null)
  const worldRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const dataRef = useRef({ events, assets, showRadiusFor, acked })
  dataRef.current = { events, assets, showRadiusFor, acked }

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    let cancelled = false
    let world
    let ro

    const boot = () => {
      if (cancelled || world) return
      if (el.clientWidth < 40 || el.clientHeight < 40) return
      try {
        world = createWorld(el, () => onSelectRef.current)
        worldRef.current = world
        world.setData(dataRef.current)
        setStatus('live')
      } catch (err) {
        console.error('Globe failed', err)
        setStatus('failed')
      }
    }

    ro = new ResizeObserver(() => {
      if (!world) boot()
      else world.resize()
    })
    ro.observe(el)
    boot()
    const late = [50, 200, 500, 1200].map((ms) => setTimeout(boot, ms))

    const hudTimer = setInterval(() => {
      const pov = worldRef.current?.pointOfView()
      if (pov) setHud(pov)
    }, 240)

    return () => {
      cancelled = true
      late.forEach(clearTimeout)
      clearInterval(hudTimer)
      ro?.disconnect()
      world?.dispose()
      worldRef.current = null
    }
  }, [])

  useEffect(() => {
    worldRef.current?.setData(dataRef.current)
  }, [events, assets, showRadiusFor, acked])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    if (!selected) {
      world.setAutoRotate(mode === 'globe')
      return
    }
    const target = events.find((e) => e.id === selected.id) || assets.find((a) => a.id === selected.id)
    if (!target) return
    const close = selected.type === 'asset' || Boolean(showRadiusFor)
    world.flyTo(target.coords[1], target.coords[0], close)
  }, [selected, events, assets, mode, showRadiusFor])

  useEffect(() => {
    worldRef.current?.setAutoRotate(mode === 'globe' && !selected)
    worldRef.current?.setPaused(mode !== 'globe')
  }, [mode, selected])

  return (
    <div className="map-wrap">
      <div className="hud-frame" aria-hidden="true">
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
      </div>
      <div className={`globe-stage ${mode === 'globe' ? 'on' : 'off'}`} ref={hostRef} />
      <div className={`map-stage ${mode === 'map' ? 'on' : 'off'}`}>
        {mode === 'map' && MapView && (
          <MapView
            events={events}
            assets={assets}
            selected={selected}
            onSelect={onSelect}
            showRadiusFor={showRadiusFor}
            timeMode={timeMode}
          />
        )}
      </div>

      {mode === 'globe' && status === 'booting' && (
        <div className="globe-msg">Raising the globe…</div>
      )}
      {mode === 'globe' && status === 'failed' && (
        <div className="globe-msg">
          WebGL did not start.{' '}
          <button
            type="button"
            onClick={() => {
              setMode('map')
              import('./MapView.jsx').then((m) => setMapView(() => m.default))
            }}
          >
            Open terrain map
          </button>
        </div>
      )}

      <div className="view-toggle">
        <button className={mode === 'globe' ? 'active' : ''} onClick={() => setMode('globe')}>
          3D Globe
        </button>
        <button
          className={mode === 'map' ? 'active' : ''}
          onClick={() => {
            setMode('map')
            import('./MapView.jsx').then((m) => setMapView(() => m.default))
          }}
        >
          Terrain map
        </button>
      </div>

      <div className="telemetry">
        <span>SAT-CORVEX</span>
        <b>
          {hud.lat.toFixed(2)}° {hud.lng.toFixed(2)}°
        </b>
        <span>ALT {hud.alt.toFixed(2)}</span>
        <i />
      </div>

      <div className="hud">
        <div className="legend">
          <h4>{mode === 'globe' ? 'Read' : 'Terrain'}</h4>
          <div className="lg">Dashed ring = site fence</div>
          <div className="lg">Arc = event → asset</div>
          <div className="lg">Drag · scroll altitude</div>
        </div>
      </div>
    </div>
  )
}

function createWorld(el, getOnSelect) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#03040a')

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
  camera.position.set(0, 40, 280)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  const labels = new CSS2DRenderer()
  labels.domElement.className = 'globe-labels'
  el.appendChild(labels.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.55
  controls.minDistance = 130
  controls.maxDistance = 520
  controls.enablePan = false

  scene.add(new THREE.AmbientLight(0xc4b8a4, 1.15))
  const sun = new THREE.DirectionalLight(0xffe6c8, 1.35)
  sun.position.set(-120, 80, 160)
  scene.add(sun)

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshPhongMaterial({
      color: 0x1a1410,
      emissive: 0x0b0806,
      shininess: 8,
    }),
  )
  scene.add(globe)

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.045, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6a8aaa,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    }),
  )
  scene.add(atmos)

  const stars = makeStars()
  scene.add(stars)

  const overlay = new THREE.Group()
  scene.add(overlay)

  const loader = new THREE.TextureLoader()
  loader.load(
    '/textures/earth-night.jpg',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      globe.material.map = tex
      globe.material.color = new THREE.Color(0xffffff)
      globe.material.needsUpdate = true
    },
    undefined,
    () => {
      globe.material.map = paintFallbackEarth()
      globe.material.color = new THREE.Color(0xffffff)
      globe.material.needsUpdate = true
    },
  )

  let raf = 0
  let paused = false
  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (paused) return
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
  }

  const resize = () => {
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    labels.setSize(w, h)
  }
  resize()
  tick()

  const setData = ({ events, assets, showRadiusFor, acked }) => {
    while (overlay.children.length) {
      const child = overlay.children[0]
      overlay.remove(child)
      child.element?.remove()
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material?.dispose()
    }

    const seen = acked instanceof Set ? acked : new Set(acked || [])
    const fence = assets.find((a) => a.id === showRadiusFor)

    for (const a of assets) {
      overlay.add(htmlPin(a.coords[1], a.coords[0], assetMarkerHtml(a), () => getOnSelect()?.({ type: 'asset', id: a.id })))
    }
    if (fence) {
      overlay.add(fenceRing(fence.coords[1], fence.coords[0], fence.radiusKm, 0xc4a574))
    }
    for (const e of events) {
      const dim = seen.has(e.id)
      overlay.add(htmlPin(e.coords[1], e.coords[0], eventMarkerHtml(e), () => getOnSelect()?.({ type: 'event', id: e.id })))
      overlay.add(dot(e.coords[1], e.coords[0], colorFor(e), dim ? 0.28 : 1))
      if (!dim && (e.impact === 'high' || e.kind === 'fire' || e.kind === 'quake')) {
        overlay.add(ring(e.coords[1], e.coords[0], e.kind === 'quake' ? 10 : 5.5, colorFor(e)))
      }
      if (e.linked && !dim) {
        overlay.add(
          arc(
            e.coords[1],
            e.coords[0],
            e.primary.asset.coords[1],
            e.primary.asset.coords[0],
            e.impact === 'high' ? 0xff4d12 : 0x5c7d86,
          ),
        )
      }
    }
  }

  const pointOfView = () => {
    const p = camera.position
    const alt = p.length() / R
    const lat = 90 - (Math.acos(Math.min(1, Math.max(-1, p.y / p.length()))) * 180) / Math.PI
    const lng = ((Math.atan2(p.z, -p.x) * 180) / Math.PI) - 180
    return { lat, lng, alt }
  }

  const flyTo = (lat, lng, close = false) => {
    controls.autoRotate = false
    const dest = latLngToVec3(lat, lng, close ? 0.2 : 1.35)
    const start = camera.position.clone()
    const t0 = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 1400)
      const k = 1 - (1 - t) ** 3
      camera.position.lerpVectors(start, dest, k)
      camera.lookAt(0, 0, 0)
      if (t < 1) requestAnimationFrame(step)
    }
    step()
  }

  return {
    setData,
    resize,
    pointOfView,
    flyTo,
    setAutoRotate: (on) => {
      controls.autoRotate = on
    },
    setPaused: (on) => {
      paused = on
    },
    dispose: () => {
      cancelAnimationFrame(raf)
      controls.dispose()
      renderer.dispose()
      labels.domElement.remove()
      renderer.domElement.remove()
    },
  }
}

function latLngToVec3(lat, lng, alt = 0) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  const r = R * (1 + alt)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

function htmlPin(lat, lng, html, onClick) {
  const wrap = document.createElement('button')
  wrap.type = 'button'
  wrap.className = 'globe-pin'
  wrap.innerHTML = html
  wrap.onclick = (e) => {
    e.stopPropagation()
    onClick()
  }
  const obj = new CSS2DObject(wrap)
  obj.position.copy(latLngToVec3(lat, lng, 0.02))
  return obj
}

function dot(lat, lng, color, opacity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 10),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
  )
  mesh.position.copy(latLngToVec3(lat, lng, 0.01))
  return mesh
}

function ring(lat, lng, size, color) {
  const g = new THREE.RingGeometry(size * 0.55, size, 48)
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(g, m)
  const p = latLngToVec3(lat, lng, 0.012)
  mesh.position.copy(p)
  mesh.lookAt(0, 0, 0)
  return mesh
}

function arc(lat0, lng0, lat1, lng1, color) {
  const v0 = latLngToVec3(lat0, lng0, 0.01)
  const v1 = latLngToVec3(lat1, lng1, 0.01)
  const mid = v0.clone().add(v1).multiplyScalar(0.5)
  const lift = 12 + v0.distanceTo(v1) * 0.18
  mid.normalize().multiplyScalar(R + lift)
  const curve = new THREE.QuadraticBezierCurve3(v0, mid, v1)
  const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56))
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }))
}

function fenceRing(lat, lng, radiusKm, color) {
  const pts = []
  for (let i = 0; i <= 64; i++) {
    const [la, ln] = destPoint(lat, lng, radiusKm, (i / 64) * 360)
    pts.push(latLngToVec3(la, ln, 0.008))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({
      color,
      dashSize: 0.55,
      gapSize: 0.35,
      transparent: true,
      opacity: 0.9,
    }),
  )
  line.computeLineDistances()
  return line
}

function destPoint(lat, lng, km, bearingDeg) {
  const br = (bearingDeg * Math.PI) / 180
  const ang = km / 6371
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br))
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(br) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2))
  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI]
}

function makeStars() {
  const n = 600
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(700 + Math.random() * 400)
    pos[i * 3] = v.x
    pos[i * 3 + 1] = v.y
    pos[i * 3 + 2] = v.z
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8a9bb0, size: 1.15 }))
}

function paintFallbackEarth() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#0c1218'
  g.fillRect(0, 0, 1024, 512)
  g.fillStyle = '#2a241c'
  const blobs = [
    [280, 180, 160, 90],
    [520, 220, 90, 70],
    [780, 160, 140, 80],
    [350, 340, 70, 110],
    [820, 340, 100, 60],
  ]
  for (const [x, y, rx, ry] of blobs) {
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function colorFor(e) {
  if (e.kind === 'fire') return 0xff4d12
  if (e.kind === 'flood') return 0x3ce0c8
  if (e.kind === 'storm') return 0x9bb4ff
  if (e.kind === 'security') return 0xff4d78
  if (e.kind === 'protest') return 0xe8c36a
  return 0xc4a574
}
