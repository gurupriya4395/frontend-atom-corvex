import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { eventMarkerHtml, assetMarkerHtml } from './markers'
import { fmtLat, fmtLng } from './coords'

const R = 100

export default function GlobeMap({
  events,
  assets,
  mapEvents,
  mapAssets,
  selected,
  onSelect,
  showRadiusFor,
  timeMode,
  mapMode = 'globe',
  onMapMode,
  scene = {},
  pulseEventId,
  highlightAssetId,
  focusPoint = null,
  mapFocusNonce = 0,
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
  const dataRef = useRef({ events, assets, showRadiusFor, pulseEventId, highlightAssetId, selected })
  dataRef.current = { events, assets, showRadiusFor, pulseEventId, highlightAssetId, selected }

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
  }, [events, assets, showRadiusFor, pulseEventId, highlightAssetId, selected])

  useEffect(() => {
    const world = worldRef.current
    if (!world || mode !== 'globe') return
    world.setAutoRotate(false)
    if (pulseEventId && !selected) {
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
    if (mode === 'globe') {
      requestAnimationFrame(() => {
        worldRef.current?.resize()
      })
      const late = [80, 320].map((ms) =>
        setTimeout(() => worldRef.current?.resize(), ms),
      )
      return () => late.forEach(clearTimeout)
    }
  }, [mode, selected])

  useEffect(() => {
    import('./MapView.jsx').then((m) => setMapView(() => m.default))
  }, [])

  const zoomOutGlobe = () => {
    onSelectRef.current?.(null)
    worldRef.current?.zoomOut()
  }

  return (
    <div className={`map-wrap ${mode === 'map' ? 'is-imagery' : 'is-satellite'}`}>
      <div className="hud-frame" aria-hidden="true">
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
      </div>
      <div className={`globe-stage ${mode === 'globe' ? 'on' : 'off'}`} ref={hostRef} />
      <div className={`map-stage ${mode === 'map' ? 'on' : 'off'}`}>
        {MapView && (
          <MapView
            events={mapEvents || events}
            assets={mapAssets || assets}
            selected={selected}
            onSelect={onSelect}
            showRadiusFor={showRadiusFor}
            timeMode={timeMode}
            scene={scene}
            highlightAssetId={highlightAssetId}
            focusPoint={focusPoint}
            active={mode === 'map'}
            focusNonce={mapFocusNonce}
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
          Globe
        </button>
        <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>
          Map
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
            <span>Camera</span>
            {focusPoint ? (
              <>
                <b className="telemetry-target">{focusPoint.label}</b>
                <span className="telemetry-sub">
                  {fmtLat(hud.lat)} {fmtLng(hud.lng)} · alt {hud.alt.toFixed(1)}
                </span>
              </>
            ) : (
              <>
                <b>
                  {fmtLat(hud.lat)} {fmtLng(hud.lng)}
                </b>
                <span>Alt {hud.alt.toFixed(1)} · select a pin for details</span>
              </>
            )}
            <i />
          </div>

          <div className="hud">
            <div className="legend">
              <h4>Globe view</h4>
              <div className="lg">India events and global offices</div>
              <div className="lg">Select a pin for coordinates</div>
              <div className="lg">Drag to pan · scroll to zoom</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function createWorld(el, getOnSelect) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#070b10')

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
  camera.position.set(0, 60, 320)

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
  controls.minDistance = 150
  controls.maxDistance = 780
  controls.enablePan = false
  controls.enableRotate = true
  controls.enableZoom = true
  controls.target.set(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 1.35))
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.65)
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
    color: 0xe8eef4,
    emissive: 0x0a1018,
    emissiveIntensity: 0.12,
    shininess: 22,
    specular: 0x556677,
  })
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 80, 64), globeMat)
  scene.add(globe)

  new THREE.TextureLoader().load(
    'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    (remote) => {
      remote.colorSpace = THREE.SRGBColorSpace
      remote.anisotropy = 8
      globeMat.map = remote
      globeMat.needsUpdate = true
    },
    undefined,
    () => {
      new THREE.TextureLoader().load(
        'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-day.jpg',
        (fallback) => {
          fallback.colorSpace = THREE.SRGBColorSpace
          globeMat.map = fallback
          globeMat.needsUpdate = true
        },
      )
    },
  )

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.045, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x3d6a8a,
      transparent: true,
      opacity: 0.1,
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

  const setData = ({ events, assets, showRadiusFor, pulseEventId, highlightAssetId, selected }) => {
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
      overlay.add(surfaceDot(e.coords[1], e.coords[0], colorFor(e)))
      if (e.impact === 'high' || pulseEventId === e.id) {
        overlay.add(
          surfaceHalo(
            e.coords[1],
            e.coords[0],
            pulseEventId === e.id ? 4 : 3.6,
            colorFor(e),
            pulseEventId === e.id ? 0.48 : 0.3,
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

  let flyRaf = 0
  const cancelFly = () => {
    if (flyRaf) cancelAnimationFrame(flyRaf)
    flyRaf = 0
    controls.enabled = true
  }

  const animateCamera = (dest, duration = 1200, { lockControls = true } = {}) => {
    cancelFly()
    controls.autoRotate = false
    if (lockControls) controls.enabled = false
    else controls.enabled = true
    const start = camera.position.clone()
    const t0 = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / duration)
      const k = 1 - (1 - t) ** 3
      camera.position.lerpVectors(start, dest, k)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0)
      if (t < 1) {
        flyRaf = requestAnimationFrame(step)
      } else {
        flyRaf = 0
        controls.enabled = true
        controls.update()
      }
    }
    flyRaf = requestAnimationFrame(step)
  }

  renderer.domElement.addEventListener('pointerdown', () => {
    if (flyRaf) cancelFly()
  })

  const flyTo = (lat, lng, close = false) => {
    const alt = close ? 0.85 : 1.85
    animateCamera(latLngToVec3(lat, lng, alt), 1400)
  }

  const zoomOut = () => {
    cancelFly()
    controls.enabled = true
    controls.target.set(0, 0, 0)
    animateCamera(new THREE.Vector3(0, 90, 320), 900, { lockControls: false })
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
      cancelFly()
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

function surfaceDot(lat, lng, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 10),
    new THREE.MeshBasicMaterial({ color }),
  )
  mesh.position.copy(latLngToVec3(lat, lng, 0.01))
  return mesh
}

function surfaceHalo(lat, lng, size, color, opacity = 0.35) {
  const geo = new THREE.RingGeometry(size * 0.84, size, 40)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  const p = latLngToVec3(lat, lng, 0.012)
  mesh.position.copy(p)
  mesh.lookAt(0, 0, 0)
  return mesh
}

function dashedArc(lat0, lng0, lat1, lng1, color) {
  const v0 = latLngToVec3(lat0, lng0, 0.01)
  const v1 = latLngToVec3(lat1, lng1, 0.01)
  const mid = v0.clone().add(v1).multiplyScalar(0.5)
  const lift = 12 + v0.distanceTo(v1) * 0.18
  mid.normalize().multiplyScalar(R + lift)
  const curve = new THREE.QuadraticBezierCurve3(v0, mid, v1)
  const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56))
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({
      color,
      dashSize: 1.35,
      gapSize: 0.85,
      transparent: true,
      opacity: 0.95,
    }),
  )
  line.computeLineDistances()
  return line
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
  if (e.kind === 'flood') return 0x22c55e
  if (e.kind === 'storm') return 0x38bdf8
  if (e.kind === 'security') return 0xec4899
  if (e.kind === 'protest') return 0x8b5cf6
  if (e.kind === 'quake') return 0xe8d27a
  if (e.kind === 'haze') return 0x94a3b8
  return 0x6366f1
}
