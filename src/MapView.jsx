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
  const dataRef = useRef({ events, assets })
  dataRef.current = { events, assets }
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
          center: [78.0, 21.5],
          zoom: 4.2,
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

    const focus = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : null
    const pair = focus?.primary?.asset
    const link = map.getSource('asset-link')
    if (link) {
      link.setData({
        type: 'FeatureCollection',
        features:
          focus && pair
            ? [
                {
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: [focus.coords, pair.coords] },
                },
              ]
            : [],
      })
    }

    if (focus && pair) {
      const km = focus.primary.km
      const mid = [(focus.coords[0] + pair.coords[0]) / 2, (focus.coords[1] + pair.coords[1]) / 2]
      const chip = document.createElement('div')
      chip.className = 'dist-chip'
      chip.textContent = `${km.toFixed(1)} km`
      markersRef.current.push(new Marker({ element: chip, anchor: 'center' }).setLngLat(mid).addTo(map))
    }
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
    if (!map || !ready || !selected?.id) return
    const { events: evs, assets: asts } = dataRef.current
    const target =
      selected.type === 'event' ? evs.find((e) => e.id === selected.id) : asts.find((a) => a.id === selected.id)
    if (!target) return
    const asset = selected.type === 'event' ? target.primary?.asset : null
    if (asset) {
      map.fitBounds([target.coords, asset.coords], { padding: 100, maxZoom: 13, duration: 1100 })
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
      center: [78.0, 21.5],
      zoom: 4.2,
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
        'heatmap-opacity': 0.45,
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
      id: 'asset-link-line',
      type: 'line',
      source: 'asset-link',
      paint: {
        'line-color': '#0f172a',
        'line-width': 2.4,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1.4],
      },
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
