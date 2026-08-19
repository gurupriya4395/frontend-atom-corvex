import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { eventMarkerHtml, assetMarkerHtml } from './markers'

const R = 100
const GLOBE_HOME = { lat: 20, lng: 78, alt: 3.1 }

export default function GlobeMap({
  events,
  assets,
  selected,
  onSelect,
  showRadiusFor,
  timeMode,
  mapMode = 'globe',
  onMapMode,
  scene = {},
  pulseEventId,
  highlightAssetId,
}) {
  const mode = mapMode
  const setMode = (m) => onMapMode?.(m)
  const [MapView, setMapView] = useState(null)
  const [hud, setHud] = useState({ lat: 20.5, lng: 78.9, alt: 2.4 })
  const [status, setStatus] = useState('booting')
  const hostRef = useRef(null)
  const worldRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const dataRef = useRef({ events, assets, showRadiusFor, pulseEventId, highlightAssetId })
  dataRef.current = { events, assets, showRadiusFor, pulseEventId, highlightAssetId }

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
  }, [events, assets, showRadiusFor, pulseEventId, highlightAssetId])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    world.setAutoRotate(false)
    if (pulseEventId && mode === 'globe' && !selected) {
      const ev = events.find((e) => e.id === pulseEventId)
      if (ev) world.flyTo(ev.coords[1], ev.coords[0], false)
      return
    }
    if (!selected) return
    const target =
      selected.type === 'event'
        ? events.find((e) => e.id === selected.id)
        : assets.find((a) => a.id === selected.id)
    if (!target) return
    const close = selected.type === 'asset' || Boolean(showRadiusFor)
    world.flyTo(target.coords[1], target.coords[0], close)
  }, [selected, events, assets, mode, showRadiusFor, pulseEventId])

  useEffect(() => {
    worldRef.current?.setAutoRotate(false)
    worldRef.current?.setPaused(mode !== 'globe')
  }, [mode, selected])

  useEffect(() => {
    import('./MapView.jsx').then((m) => setMapView(() => m.default))
  }, [])

  const zoomOutGlobe = () => {
    worldRef.current?.zoomOut()
  }

  return (
    <div className={`map-wrap ${mode === 'map' ? 'is-streets' : ''}`}>
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
            scene={scene}
            highlightAssetId={highlightAssetId}
            active={mode === 'map'}
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
            }}
          >
            Open Streets
          </button>
        </div>
      )}

      <div className="view-toggle">
        <button className={mode === 'globe' ? 'active' : ''} onClick={() => setMode('globe')}>
          World
        </button>
        <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>
          Streets
        </button>
      </div>

      {mode === 'globe' && status === 'live' && (
        <div className="globe-tools">
          <button type="button" className="terrain-btn" onClick={zoomOutGlobe}>
            Zoom out
          </button>
        </div>
      )}

      {mode === 'globe' && (
        <>
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
              <h4>World</h4>
              <div className="lg">Arc = event → site</div>
              <div className="lg">Dashed ring = fence</div>
              <div className="lg">Drag to look around</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function createWorld(el, getOnSelect) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e8eef6')

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
  controls.autoRotate = false
  controls.minDistance = 130
  controls.maxDistance = 520
  controls.enablePan = false

  scene.add(new THREE.AmbientLight(0xffffff, 1.15))
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.45)
  sun.position.set(-70, 120, 100)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.42)
  fill.position.set(110, -30, -80)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xd8c4ff, 0.28)
  rim.position.set(-130, 30, -110)
  scene.add(rim)

  const earthTex = paintLightEarth()
  const globeMat = new THREE.MeshPhongMaterial({
    map: earthTex,
    color: 0xffffff,
    emissive: 0x0a0c10,
    emissiveIntensity: 0.04,
    shininess: 22,
    specular: 0x666677,
  })
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 80, 64), globeMat)
  scene.add(globe)

  new THREE.TextureLoader().load(
    'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-day.jpg',
    (remote) => {
      remote.colorSpace = THREE.SRGBColorSpace
      remote.anisotropy = 8
      globeMat.map = remote
      globeMat.needsUpdate = true
    },
  )

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.045, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x8bafd4,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
    }),
  )
  scene.add(atmos)

  const overlay = new THREE.Group()
  globe.add(overlay)

  let raf = 0
  let paused = false
  const _pinWorld = new THREE.Vector3()
  const _camDir = new THREE.Vector3()
  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (paused) return
    controls.update()
    _camDir.copy(camera.position).normalize()
    overlay.traverse((obj) => {
      if (!obj.element) return
      obj.getWorldPosition(_pinWorld)
      const facing = _pinWorld.normalize().dot(_camDir)
      const show = facing > 0.12
      obj.element.style.visibility = show ? 'visible' : 'hidden'
      obj.element.style.pointerEvents = show ? 'auto' : 'none'
    })
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

  const setData = ({ events, assets, showRadiusFor, pulseEventId, highlightAssetId }) => {
    while (overlay.children.length) {
      const child = overlay.children[0]
      overlay.remove(child)
      child.element?.remove()
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material?.dispose()
    }

    const fence = assets.find((a) => a.id === showRadiusFor)

    for (const a of assets) {
      overlay.add(
        htmlPin(
          a.coords[1],
          a.coords[0],
          assetMarkerHtml(a),
          () => getOnSelect()?.({ type: 'asset', id: a.id }),
          highlightAssetId === a.id ? 'is-hot' : '',
        ),
      )
    }
    if (fence) {
      overlay.add(fenceRing(fence.coords[1], fence.coords[0], fence.radiusKm, 0xc4a574))
    }
    for (const e of events) {
      overlay.add(
        htmlPin(
          e.coords[1],
          e.coords[0],
          eventMarkerHtml(e),
          () => getOnSelect()?.({ type: 'event', id: e.id }),
          pulseEventId === e.id ? 'is-pulse' : '',
        ),
      )
      overlay.add(dot(e.coords[1], e.coords[0], colorFor(e), 1))
      if (e.impact === 'high' || e.kind === 'fire' || e.kind === 'quake' || pulseEventId === e.id) {
        overlay.add(ring(e.coords[1], e.coords[0], pulseEventId === e.id ? 14 : e.kind === 'quake' ? 10 : 5.5, colorFor(e)))
      }
      if (e.linked) {
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

  const animateCamera = (dest, duration = 1200) => {
    controls.autoRotate = false
    const start = camera.position.clone()
    const t0 = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / duration)
      const k = 1 - (1 - t) ** 3
      camera.position.lerpVectors(start, dest, k)
      camera.lookAt(0, 0, 0)
      if (t < 1) requestAnimationFrame(step)
    }
    step()
  }

  const flyTo = (lat, lng, close = false) => {
    animateCamera(latLngToVec3(lat, lng, close ? 0.38 : 1.35), 1400)
  }

  const zoomOut = () => {
    animateCamera(latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, GLOBE_HOME.alt))
  }

  return {
    setData,
    resize,
    pointOfView,
    flyTo,
    zoomOut,
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

function htmlPin(lat, lng, html, onClick, extraClass = '') {
  const wrap = document.createElement('button')
  wrap.type = 'button'
  wrap.className = `globe-pin ${extraClass}`.trim()
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

function paintLightEarth() {
  const w = 2048
  const h = 1024
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')

  const ocean = g.createLinearGradient(0, 0, 0, h)
  ocean.addColorStop(0, '#8ec0de')
  ocean.addColorStop(0.5, '#6ba8cc')
  ocean.addColorStop(1, '#5a96bc')
  g.fillStyle = ocean
  g.fillRect(0, 0, w, h)

  const land = [
    [420, 360, 200, 110, '#c4b48a'],
    [980, 320, 240, 130, '#b8a078'],
    [1480, 300, 220, 100, '#c9b896'],
    [560, 620, 120, 150, '#a8c090'],
    [1180, 580, 180, 120, '#b0a070'],
    [1680, 520, 160, 90, '#9aab72'],
    [300, 480, 90, 70, '#b8a078'],
    [820, 440, 70, 55, '#c4b48a'],
    [640, 280, 55, 40, '#8faa6e'],
    [1320, 420, 80, 50, '#a69068'],
  ]
  for (const [x, y, rx, ry, base] of land) {
    const shade = g.createRadialGradient(x - rx * 0.25, y - ry * 0.3, rx * 0.08, x, y, rx * 1.15)
    shade.addColorStop(0, lighten(base, 28))
    shade.addColorStop(0.45, base)
    shade.addColorStop(0.82, darken(base, 22))
    shade.addColorStop(1, darken(base, 38))
    g.fillStyle = shade
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = darken(base, 45)
    g.lineWidth = 3
    g.stroke()
  }

  for (let i = 0; i < 48; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = 24 + Math.random() * 70
    const dent = g.createRadialGradient(x, y, 0, x, y, r)
    dent.addColorStop(0, 'rgba(42, 58, 72, 0.14)')
    dent.addColorStop(1, 'rgba(42, 58, 72, 0)')
    g.fillStyle = dent
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, ((n >> 16) & 255) + amt)
  const g = Math.min(255, ((n >> 8) & 255) + amt)
  const b = Math.min(255, (n & 255) + amt)
  return `rgb(${r}, ${g}, ${b})`
}

function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 255) - amt)
  const g = Math.max(0, ((n >> 8) & 255) - amt)
  const b = Math.max(0, (n & 255) - amt)
  return `rgb(${r}, ${g}, ${b})`
}

function colorFor(e) {
  if (e.kind === 'fire') return 0xff4d12
  if (e.kind === 'flood') return 0x3ce0c8
  if (e.kind === 'storm') return 0x9bb4ff
  if (e.kind === 'security') return 0xff4d78
  if (e.kind === 'protest') return 0xe8c36a
  return 0xc4a574
}
