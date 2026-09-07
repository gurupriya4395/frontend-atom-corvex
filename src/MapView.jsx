import { useEffect, useRef, useState } from 'react'
import { AttributionControl, LngLatBounds, Map, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { eventMarkerHtml, eventBriefHtml, assetMarkerHtml } from './markers'
import { fmtLat, fmtLng } from './coords'
import { MUMBAI_FLOOD_ZONE } from './data'

/** Esri World Imagery — satellite basemap (ArcGIS Mission / TAK-style). */
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri',
      maxzoom: 19,
    },
    labels: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap',
    },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery', minzoom: 0, maxzoom: 22 },
    { id: 'labels', type: 'raster', source: 'labels', minzoom: 0, maxzoom: 22, paint: { 'raster-opacity': 0.88 } },
  ],
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
  focusPoint = null,
  active = true,
}) {
  const wrapRef = useRef(null)
  const hudRef = useRef(null)
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
    if (!el) return
    let map
    let cancelled = false

    const boot = () => {
      if (cancelled || map) return
      if (el.clientWidth < 40 || el.clientHeight < 40) return
      try {
        map = new Map({
          container: el,
          style: SATELLITE_STYLE,
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
  }, [tick])

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
      el.innerHTML = eventMarkerHtml(event)
      el.style.cursor = 'pointer'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current?.({ type: 'event', id: event.id })
      })
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

    const focusEvent = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : null
    const pairs = (focusEvent?.linked && focusEvent.primary?.asset
      ? [focusEvent]
      : events.filter((e) => e.linked && e.primary?.asset && Array.isArray(e.coords)))
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

    paintDeskHud(map, hudRef.current, events, selected)
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
      paintDeskHud(map, hudRef.current, evs, sel)
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
    if (!map || !ready || !active || !selected?.id) return
    const focus = () => focusSelection(map, dataRef.current)
    focus()
    const later = [80, 240, 480].map((ms) => setTimeout(focus, ms))
    return () => later.forEach(clearTimeout)
  }, [selected?.id, selected?.type, scene.flood, scene.distance, scene.warehouse, ready, active])

  useEffect(() => {
    if (!active) return
    const map = mapRef.current
    const t = [40, 160, 400].map((ms) =>
      setTimeout(() => {
        map?.resize()
        if (ready) focusSelection(map, dataRef.current)
      }, ms),
    )
    return () => t.forEach(clearTimeout)
  }, [active, ready])

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
      <div className="desk-hud" ref={hudRef} />
      {!ready && !fail && <div className="terrain-loading">Loading satellite imagery…</div>}
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
        {focusPoint && (
          <div className="map-coord-readout" aria-live="polite">
            <span className="map-coord-label">{focusPoint.label}</span>
            <span className="map-coord-val">
              <em>Lat</em> {fmtLat(focusPoint.lat)}
            </span>
            <span className="map-coord-val">
              <em>Long</em> {fmtLng(focusPoint.lng)}
            </span>
          </div>
        )}
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

function focusSelection(map, { events, assets, selected }) {
  if (!map || !selected?.id) return
  const target =
    selected.type === 'event' ? events.find((e) => e.id === selected.id) : assets.find((a) => a.id === selected.id)
  if (!target?.coords) return
  const extra = selected.type === 'event' ? target.primary?.asset?.coords : null
  const bounds = new LngLatBounds(target.coords, target.coords)
  if (extra) bounds.extend(extra)
  else {
    bounds.extend([target.coords[0] - 0.04, target.coords[1] - 0.04])
    bounds.extend([target.coords[0] + 0.04, target.coords[1] + 0.04])
  }
  map.fitBounds(bounds, {
    padding: { top: 96, bottom: 100, left: 300, right: 360 },
    maxZoom: 13,
    duration: 900,
    essential: true,
  })
}

function paintDeskHud(map, host, events, selected) {
  if (!map || !host) return
  const pairs = (events || []).filter((e) => e.linked && e.primary?.asset && Array.isArray(e.coords))
  let focus = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : null
  if (!focus) focus = pairs[0] || null

  const w = host.clientWidth || map.getContainer().clientWidth
  const h = host.clientHeight || map.getContainer().clientHeight
  const lines = pairs
    .map((e) => {
      const p1 = map.project(e.coords)
      const p2 = map.project(e.primary.asset.coords)
      const on = focus && e.id === focus.id
      return `<g class="${on ? 'is-on' : ''}">
        <line class="link-halo" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />
        <line class="link-dash" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />
      </g>`
    })
    .join('')

  const chips = pairs
    .map((e) => {
      const p1 = map.project(e.coords)
      const p2 = map.project(e.primary.asset.coords)
      const mx = (p1.x + p2.x) / 2
      const my = (p1.y + p2.y) / 2
      if (mx < -40 || my < -20 || mx > w + 40 || my > h + 20) return ''
      const on = focus && e.id === focus.id
      return `<div class="dist-chip${on ? ' is-on' : ''}" style="left:${mx}px;top:${my}px">${Number(e.primary.km).toFixed(1)} km</div>`
    })
    .join('')

  let card = ''
  if (focus) {
    const p = map.project(focus.coords)
    const left = Math.max(12, Math.min(w - 308, p.x + 36))
    const top = Math.max(12, Math.min(h - 220, p.y - 28))
    card = `<div class="ev-brief-wrap" style="left:${left}px;top:${top}px">${eventBriefHtml(focus)}</div>`
  }

  host.innerHTML = `<svg class="desk-links" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${lines}</svg>${chips}${card}`
  host.querySelectorAll('a').forEach((a) => a.addEventListener('click', (ev) => ev.stopPropagation()))
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
