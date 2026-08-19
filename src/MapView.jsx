import { useEffect, useRef, useState } from 'react'
import { AttributionControl, Map, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { eventMarkerHtml, eventCalloutHtml, assetMarkerHtml } from './markers'
import { haversineKm } from './scoring'
import { DEMO, MUMBAI_FLOOD_ZONE } from './data'

const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const FALLBACK_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© CARTO © OSM',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

export default function MapView({
  events,
  assets,
  selected,
  onSelect,
  showRadiusFor,
  timeMode = 'live',
  scene = {},
  highlightAssetId,
  active = true,
}) {
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const dataRef = useRef({ events, assets })
  dataRef.current = { events, assets }
  const [fail, setFail] = useState(null)
  const [tick, setTick] = useState(0)

  const liveOrForecast = timeMode === 'live' || timeMode === 'forecast'

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let map
    let cancelled = false
    let usedFallback = false

    const boot = () => {
      if (cancelled || map) return
      if (el.clientWidth < 40 || el.clientHeight < 40) return
      try {
        map = new Map({
          container: el,
          style: LIGHT_STYLE,
          center: [78.0, 21.5],
          zoom: 3.8,
          pitch: 32,
          bearing: -8,
          maxPitch: 80,
          attributionControl: false,
        })
      } catch (err) {
        setFail(err?.message || 'Streets map did not start')
        return
      }
      mapRef.current = map
      setFail(null)

      map.on('error', (e) => {
        const msg = String(e?.error?.message || e?.error || '')
        if (!usedFallback && /style|fetch|ajax|network|failed/i.test(msg)) {
          usedFallback = true
          try {
            map.setStyle(FALLBACK_STYLE)
          } catch {
            setFail('Map tiles could not load')
          }
        }
      })

      const onReady = () => {
        addDeskLayers(map)
        map.resize()
      }
      map.on('load', onReady)
      map.on('style.load', onReady)
      map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    }

    const ro = new ResizeObserver(() => {
      if (!map) boot()
      else map.resize()
    })
    ro.observe(el)
    boot()
    const late = [80, 240, 800].map((ms) => setTimeout(boot, ms))

    return () => {
      cancelled = true
      late.forEach(clearTimeout)
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map?.remove()
      mapRef.current = null
    }
  }, [tick])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    assets.forEach((asset) => {
      const el = document.createElement('div')
      const hot = highlightAssetId === asset.id && scene.warehouse
      el.className = 'terrain-pin' + (hot ? ' is-hot' : '')
      el.innerHTML = assetMarkerHtml(asset)
      el.style.cursor = 'pointer'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current?.({ type: 'asset', id: asset.id })
      })
      markersRef.current.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat(asset.coords).addTo(map))
    })

    events.forEach((event) => {
      const el = document.createElement('div')
      el.className = `terrain-ev${selected?.type === 'event' && selected.id === event.id ? ' is-selected' : ''}`
      el.innerHTML = eventMarkerHtml(event) + eventCalloutHtml(event)
      el.style.cursor = 'pointer'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current?.({ type: 'event', id: event.id })
      })
      markersRef.current.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat(event.coords).addTo(map))
    })

    const apply = () => {
      addDeskLayers(map)
      const pulses = map.getSource('pulses')
      if (pulses) {
        pulses.setData({
          type: 'FeatureCollection',
          features: events.map((e) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: e.coords },
            properties: { impact: e.impact || 'none' },
          })),
        })
      }

      const hqs = assets.filter((a) => a.org === 'deutsche-bank')
      const cinematic = scene.flood || scene.warehouse || scene.distance
      const fences = map.getSource('db-fences')
      if (fences) {
        fences.setData({
          type: 'FeatureCollection',
          features:
            liveOrForecast && !cinematic
              ? hqs.map((hq) => ({
                  type: 'Feature',
                  geometry: { type: 'Polygon', coordinates: [circlePoly(hq.coords, hq.radiusKm)] },
                  properties: { id: hq.id },
                }))
              : [],
        })
      }

      const links = map.getSource('hq-links')
      if (links) {
        links.setData({
          type: 'FeatureCollection',
          features:
            liveOrForecast && !cinematic
              ? events
                  .filter((e) => e.db)
                  .map((e) => ({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [e.db.hq.coords, e.coords] },
                    properties: { id: e.id },
                  }))
              : [],
        })
      }

      const radius = map.getSource('radius')
      if (radius) {
        const asset = assets.find((a) => a.id === showRadiusFor)
        radius.setData({
          type: 'FeatureCollection',
          features: asset
            ? [
                {
                  type: 'Feature',
                  properties: { hot: Boolean(highlightAssetId && asset.id === highlightAssetId) },
                  geometry: { type: 'Polygon', coordinates: [circlePoly(asset.coords, asset.radiusKm)] },
                },
              ]
            : [],
        })
      }

      const flood = map.getSource('flood')
      if (flood) flood.setData({ type: 'FeatureCollection', features: scene.flood ? [MUMBAI_FLOOD_ZONE] : [] })

      const warehouse = assets.find((a) => a.id === (highlightAssetId || DEMO.assetId))
      const ev =
        selected?.type === 'event' ? events.find((e) => e.id === selected.id) : events.find((e) => e.id === DEMO.eventId)
      const link = map.getSource('asset-link')
      if (link) {
        link.setData({
          type: 'FeatureCollection',
          features:
            scene.distance && ev && warehouse
              ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [ev.coords, warehouse.coords] } }]
              : [],
        })
      }

      if (scene.distance && ev && warehouse) {
        const km = haversineKm(ev.coords, warehouse.coords)
        const mid = [(ev.coords[0] + warehouse.coords[0]) / 2, (ev.coords[1] + warehouse.coords[1]) / 2]
        const chip = document.createElement('div')
        chip.className = `dist-chip sev-${ev.severity || 'low'}`
        chip.innerHTML = `<em>Distance</em><b>${km.toFixed(1)} km</b><span>event → ${escapeHtml(warehouse.name)}</span>`
        markersRef.current.push(new Marker({ element: chip, anchor: 'center' }).setLngLat(mid).addTo(map))
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [
    events,
    assets,
    showRadiusFor,
    liveOrForecast,
    selected?.id,
    selected?.type,
    scene.flood,
    scene.warehouse,
    scene.distance,
    highlightAssetId,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected?.id) return
    const { events: evs, assets: asts } = dataRef.current
    const target =
      selected.type === 'event' ? evs.find((e) => e.id === selected.id) : asts.find((a) => a.id === selected.id)
    if (!target) return
    const cinematic = scene.flood || scene.distance || scene.warehouse
    const zoom = cinematic ? (scene.distance ? 12.2 : 11.6) : selected.type === 'event' ? 11.2 : 9.6
    const fly = () =>
      map.flyTo({
        center: target.coords,
        zoom,
        pitch: cinematic ? 48 : 42,
        bearing: selected.type === 'event' ? -22 : -8,
        duration: cinematic ? 1100 : 1400,
        essential: true,
      })
    if (map.isStyleLoaded()) fly()
    else map.once('load', fly)
  }, [selected?.id, selected?.type, scene.flood, scene.distance, scene.warehouse])

  useEffect(() => {
    if (!active) return
    mapRef.current?.resize()
  }, [active])

  const selectedEvent = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : null
  const selectedAsset = selected?.type === 'asset' ? assets.find((a) => a.id === selected.id) : null
  const cardEvent = selectedEvent || events.find((e) => e.linked) || events[0] || null

  const zoomOut = () => {
    mapRef.current?.flyTo({
      center: [78.0, 21.5],
      zoom: 4.15,
      pitch: 22,
      bearing: -8,
      duration: 1200,
      essential: true,
    })
  }

  return (
    <div className="map-el terrain-map">
      <div className="terrain-canvas" ref={wrapRef} />
      {fail && (
        <div className="terrain-fail">
          <p>Streets did not load.</p>
          <span>{fail}</span>
          <button type="button" className="terrain-btn" onClick={() => setTick((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      <div className="terrain-chrome">
        <div className="terrain-tools">
          <button type="button" className="terrain-btn" onClick={zoomOut}>
            Zoom out
          </button>
        </div>
        {cardEvent && <ParamCard event={cardEvent} pinned={Boolean(selectedEvent)} />}
        {!cardEvent && selectedAsset && (
          <article className="param-card">
            <header>
              <span className="param-icon green" />
              <div>
                <em>Registered site</em>
                <h3>{selectedAsset.name}</h3>
              </div>
            </header>
            <div className="param-tiles">
              <div className="pt indigo">
                <b>{selectedAsset.radiusKm} km</b>
                <span>Fence</span>
              </div>
              <div className="pt purple">
                <b>{selectedAsset.city}</b>
                <span>City</span>
              </div>
            </div>
          </article>
        )}
        <div className="terrain-key" aria-label="Severity key">
          <span className="k high">High</span>
          <span className="k medium">Medium</span>
          <span className="k low">Low</span>
        </div>
      </div>
    </div>
  )
}

function ParamCard({ event, pinned }) {
  const km = event.linked ? event.primary.km.toFixed(1) : '—'
  const site = event.linked ? event.primary.asset.name : 'Unlinked'
  const fence = event.linked
    ? event.primary.inside
      ? `Inside ${event.primary.asset.radiusKm} km`
      : `Outside ${event.primary.asset.radiusKm} km`
    : 'No fence'
  const impact = (event.impact || 'none').toUpperCase()
  return (
    <article className={`param-card sev-${event.severity}${pinned ? ' is-pinned' : ''}`}>
      <header>
        <span className={`param-icon ${event.severity}`} />
        <div>
          <em>{pinned ? 'Selected event' : 'Nearest hit'}</em>
          <h3>{event.title}</h3>
        </div>
      </header>
      <div className="param-tiles">
        <div className={`pt ${event.severity === 'high' ? 'orange' : event.severity === 'medium' ? 'pink' : 'green'}`}>
          <b>{event.severity.toUpperCase()}</b>
          <span>Severity</span>
        </div>
        <div className="pt indigo">
          <b>{km === '—' ? '—' : `${km} km`}</b>
          <span>Distance</span>
        </div>
        <div className="pt purple">
          <b>{impact}</b>
          <span>Impact</span>
        </div>
        <div className="pt green">
          <b>{fence}</b>
          <span>Fence</span>
        </div>
      </div>
      <footer>
        <span>{site}</span>
        <span>{event.kind}</span>
        {event.db && (
          <span>
            DB {event.db.hq.city} · {event.db.km.toFixed(1)} km
          </span>
        )}
      </footer>
    </article>
  )
}

function addDeskLayers(map) {
  if (!map.getSource('pulses')) {
    map.addSource('pulses', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'pulses-heat',
      type: 'heatmap',
      source: 'pulses',
      paint: {
        'heatmap-weight': 0.7,
        'heatmap-intensity': 0.85,
        'heatmap-radius': 28,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0,0,0,0)',
          0.2,
          'rgba(99, 102, 241, 0.18)',
          0.5,
          'rgba(139, 92, 246, 0.28)',
          0.85,
          'rgba(249, 115, 22, 0.42)',
        ],
      },
    })
  }
  if (!map.getSource('db-fences')) {
    map.addSource('db-fences', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'db-fences-fill',
      type: 'fill',
      source: 'db-fences',
      paint: { 'fill-color': '#6366F1', 'fill-opacity': 0.12 },
    })
    map.addLayer({
      id: 'db-fences-line',
      type: 'line',
      source: 'db-fences',
      paint: { 'line-color': '#6366F1', 'line-width': 1.6, 'line-dasharray': [2, 2] },
    })
  }
  if (!map.getSource('hq-links')) {
    map.addSource('hq-links', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'hq-links-line',
      type: 'line',
      source: 'hq-links',
      paint: { 'line-color': '#8B5CF6', 'line-width': 2, 'line-opacity': 0.75 },
    })
  }
  if (!map.getSource('flood')) {
    map.addSource('flood', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'flood-fill',
      type: 'fill',
      source: 'flood',
      paint: { 'fill-color': '#6366F1', 'fill-opacity': 0.28 },
    })
    map.addLayer({
      id: 'flood-line',
      type: 'line',
      source: 'flood',
      paint: { 'line-color': '#8B5CF6', 'line-width': 2.4, 'line-dasharray': [1.4, 0.8] },
    })
  }
  if (!map.getSource('radius')) {
    map.addSource('radius', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'radius-fill',
      type: 'fill',
      source: 'radius',
      paint: {
        'fill-color': ['case', ['==', ['get', 'hot'], true], '#F97316', '#8B5CF6'],
        'fill-opacity': 0.18,
      },
    })
    map.addLayer({
      id: 'radius-line',
      type: 'line',
      source: 'radius',
      paint: {
        'line-color': ['case', ['==', ['get', 'hot'], true], '#F97316', '#6366F1'],
        'line-width': ['case', ['==', ['get', 'hot'], true], 2.6, 2],
        'line-dasharray': [2, 2],
      },
    })
  }
  if (!map.getSource('asset-link')) {
    map.addSource('asset-link', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'asset-link-line',
      type: 'line',
      source: 'asset-link',
      paint: { 'line-color': '#EC4899', 'line-width': 3.2, 'line-dasharray': [2.4, 1] },
    })
  }
}

function emptyFc() {
  return { type: 'FeatureCollection', features: [] }
}

function circlePoly([lng, lat], km, steps = 64) {
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const dx = ((km / 111.32) * Math.cos(a)) / Math.cos((lat * Math.PI) / 180)
    const dy = (km / 110.57) * Math.sin(a)
    coords.push([lng + dx, lat + dy])
  }
  return coords
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}
