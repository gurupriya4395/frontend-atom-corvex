import { useEffect, useRef, useState } from 'react'
import { AttributionControl, Map, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { eventMarkerHtml, eventBriefHtml, assetMarkerHtml } from './markers'
import { MUMBAI_FLOOD_ZONE } from './data'

/** Carto Voyager raster — reliable roads/labels on a light basemap. */
const STREET_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 22 }],
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
  const dataRef = useRef({ events, assets, selected })
  dataRef.current = { events, assets, selected }
  const [fail, setFail] = useState(null)
  const [ready, setReady] = useState(false)
  const [tick, setTick] = useState(0)

  const liveOrForecast = timeMode === 'live' || timeMode === 'forecast'

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !active) return
    let map
    let cancelled = false

    const boot = () => {
      if (cancelled || map) return
      if (el.clientWidth < 40 || el.clientHeight < 40) return
      try {
        map = new Map({
          container: el,
          style: STREET_STYLE,
          center: [72.8777, 19.076],
          zoom: 12,
          pitch: 0,
          bearing: 0,
          maxPitch: 60,
          attributionControl: false,
        })
      } catch (err) {
        setFail(err?.message || 'Streets map did not start')
        return
      }
      mapRef.current = map
      setFail(null)

      const onReady = () => {
        if (cancelled) return
        addDeskLayers(map)
        map.resize()
        setReady(true)
      }
      map.once('load', onReady)
      map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    }

    const ro = new ResizeObserver(() => {
      if (!map) boot()
      else map.resize()
    })
    ro.observe(el)
    requestAnimationFrame(() => {
      boot()
      requestAnimationFrame(boot)
    })
    const late = [120, 400, 1000].map((ms) => setTimeout(boot, ms))

    return () => {
      cancelled = true
      late.forEach(clearTimeout)
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [tick, active])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

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
      const isSelected = selected?.type === 'event' && selected.id === event.id
      const el = document.createElement('div')
      el.className = `terrain-ev${isSelected ? ' is-selected' : ''}`
      el.innerHTML = eventMarkerHtml(event) + (isSelected ? eventBriefHtml(event) : '')
      el.style.cursor = 'pointer'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current?.({ type: 'event', id: event.id })
      })
      el.querySelector('a')?.addEventListener('click', (e) => e.stopPropagation())
      markersRef.current.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat(event.coords).addTo(map))
    })

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
    const fences = map.getSource('db-fences')
    if (fences) {
      fences.setData({
        type: 'FeatureCollection',
        features:
          liveOrForecast && !scene.flood
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
      links.setData({ type: 'FeatureCollection', features: [] })
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

    const pairs = events.filter((e) => e.linked && e.primary?.asset && Array.isArray(e.coords))
    const link = map.getSource('asset-link')
    if (link) {
      link.setData({
        type: 'FeatureCollection',
        features: pairs.map((e) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [e.coords, e.primary.asset.coords] },
        })),
      })
    }

    paintLinkOverlay(map, pairs, selected?.type === 'event' ? selected.id : null)
  }, [
    events,
    assets,
    showRadiusFor,
    liveOrForecast,
    selected?.id,
    selected?.type,
    scene.flood,
    scene.warehouse,
    highlightAssetId,
    ready,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const onPaint = () => {
      const { events: evs, selected: sel } = dataRef.current
      const pairs = evs.filter((e) => e.linked && e.primary?.asset && Array.isArray(e.coords))
      paintLinkOverlay(map, pairs, sel?.type === 'event' ? sel.id : null)
    }
    map.on('move', onPaint)
    map.on('zoom', onPaint)
    map.on('pitch', onPaint)
    map.on('rotate', onPaint)
    return () => {
      map.off('move', onPaint)
      map.off('zoom', onPaint)
      map.off('pitch', onPaint)
      map.off('rotate', onPaint)
    }
  }, [ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selected?.id) return
    const { events: evs, assets: asts } = dataRef.current
    const target =
      selected.type === 'event' ? evs.find((e) => e.id === selected.id) : asts.find((a) => a.id === selected.id)
    if (!target) return
    const asset = selected.type === 'event' ? target.primary?.asset : null
    if (asset) {
      map.fitBounds([target.coords, asset.coords], {
        padding: { top: 120, bottom: 140, left: 80, right: 320 },
        maxZoom: 14,
        duration: 1100,
      })
      return
    }
    map.flyTo({
      center: target.coords,
      zoom: 12,
      pitch: 0,
      bearing: 0,
      duration: 1100,
      essential: true,
    })
  }, [selected?.id, selected?.type, scene.flood, scene.distance, scene.warehouse, ready])

  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => mapRef.current?.resize(), 50)
    return () => clearTimeout(t)
  }, [active])

  const zoomOut = () => {
    mapRef.current?.flyTo({
      center: [72.8777, 19.076],
      zoom: 12,
      pitch: 0,
      bearing: 0,
      duration: 1200,
      essential: true,
    })
  }

  return (
    <div className="map-el terrain-map">
      <div className="terrain-canvas" ref={wrapRef} />
      {!ready && !fail && <div className="terrain-loading">Loading streets…</div>}
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
        <div className="terrain-key" aria-label="Severity key">
          <span className="k high">High</span>
          <span className="k medium">Medium</span>
          <span className="k low">Low</span>
        </div>
      </div>
    </div>
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
        'heatmap-weight': 0.65,
        'heatmap-intensity': 0.75,
        'heatmap-radius': 24,
        'heatmap-opacity': 0.22,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0,0,0,0)',
          0.25,
          'rgba(99, 102, 241, 0.2)',
          0.6,
          'rgba(236, 72, 153, 0.35)',
          0.9,
          'rgba(249, 115, 22, 0.45)',
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
      paint: { 'fill-color': '#6366F1', 'fill-opacity': 0.1 },
    })
    map.addLayer({
      id: 'db-fences-line',
      type: 'line',
      source: 'db-fences',
      paint: { 'line-color': '#6366F1', 'line-width': 2, 'line-dasharray': [2, 2] },
    })
  }
  if (!map.getSource('hq-links')) {
    map.addSource('hq-links', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'hq-links-line',
      type: 'line',
      source: 'hq-links',
      paint: { 'line-color': '#8B5CF6', 'line-width': 2, 'line-opacity': 0.7 },
    })
  }
  if (!map.getSource('flood')) {
    map.addSource('flood', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'flood-fill',
      type: 'fill',
      source: 'flood',
      paint: { 'fill-color': '#6366F1', 'fill-opacity': 0.35 },
    })
    map.addLayer({
      id: 'flood-line',
      type: 'line',
      source: 'flood',
      paint: { 'line-color': '#4F46E5', 'line-width': 2.5, 'line-dasharray': [1.4, 0.8] },
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
        'fill-opacity': 0.2,
      },
    })
    map.addLayer({
      id: 'radius-line',
      type: 'line',
      source: 'radius',
      paint: {
        'line-color': ['case', ['==', ['get', 'hot'], true], '#F97316', '#6366F1'],
        'line-width': ['case', ['==', ['get', 'hot'], true], 2.8, 2.2],
        'line-dasharray': [2, 2],
      },
    })
  }
  if (!map.getSource('asset-link')) {
    map.addSource('asset-link', { type: 'geojson', data: emptyFc() })
    map.addLayer({
      id: 'asset-link-halo',
      type: 'line',
      source: 'asset-link',
      paint: {
        'line-color': '#ffffff',
        'line-width': 8,
        'line-opacity': 0.95,
        'line-cap': 'round',
      },
    })
    map.addLayer({
      id: 'asset-link-line',
      type: 'line',
      source: 'asset-link',
      paint: {
        'line-color': '#0f172a',
        'line-width': 3.6,
        'line-opacity': 1,
        'line-dasharray': [2.2, 1.6],
        'line-cap': 'round',
      },
    })
  }
}

function paintLinkOverlay(map, pairs, selectedId) {
  if (!map) return
  const host = map.getCanvasContainer()
  let svg = host.querySelector('svg.asset-link-svg')
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'asset-link-svg')
    host.appendChild(svg)
  }
  const w = host.clientWidth
  const h = host.clientHeight
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))

  const body = (pairs || [])
    .filter((e) => e.primary?.asset && Array.isArray(e.coords))
    .map((e) => {
      const a = e.primary.asset
      const p1 = map.project(e.coords)
      const p2 = map.project(a.coords)
      const km = Number(e.primary.km).toFixed(1)
      const mx = (p1.x + p2.x) / 2
      const my = (p1.y + p2.y) / 2
      const on = !selectedId || e.id === selectedId
      return `<g class="${on ? 'is-on' : ''}">
        <line class="link-halo" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />
        <line class="link-dash" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />
        <foreignObject x="${mx - 46}" y="${my - 16}" width="92" height="32">
          <div xmlns="http://www.w3.org/1999/xhtml" class="dist-chip">${km} km</div>
        </foreignObject>
      </g>`
    })
    .join('')
  svg.innerHTML = body
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
