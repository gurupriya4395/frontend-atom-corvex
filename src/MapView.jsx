import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { eventMarkerHtml, eventCalloutHtml, assetMarkerHtml } from './markers'
import { haversineKm } from './scoring'
import { DEMO, MUMBAI_FLOOD_ZONE } from './data'

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

  const liveOrForecast = timeMode === 'live' || timeMode === 'forecast'

  useEffect(() => {
    const map = new maplibregl.Map({
      container: wrapRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [78.0, 21.5],
      zoom: 3.8,
      pitch: 38,
      bearing: -12,
      maxPitch: 80,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    })
    mapRef.current = map

    const syncZoomClass = () => {
      wrapRef.current?.classList.toggle('is-close', map.getZoom() >= 5.2)
    }

    map.on('load', () => {
      try {
        map.setSky({
          'sky-color': '#d7e6f4',
          'sky-horizon-blend': 0.72,
          'horizon-color': '#f4f8fc',
          'horizon-fog-blend': 0.8,
          'fog-color': '#e4eef6',
          'fog-ground-blend': 0.35,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 5, 0.18, 8, 0],
        })
      } catch {
        /* sky optional */
      }

      map.addSource('pulses', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'pulses-heat',
        type: 'heatmap',
        source: 'pulses',
        paint: {
          'heatmap-weight': 0.75,
          'heatmap-intensity': 0.95,
          'heatmap-radius': 26,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.22,
            'rgba(90, 180, 210, 0.18)',
            0.5,
            'rgba(196, 165, 116, 0.32)',
            0.85,
            'rgba(212, 86, 42, 0.42)',
          ],
        },
      })

      map.addSource('db-fences', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'db-fences-fill',
        type: 'fill',
        source: 'db-fences',
        paint: { 'fill-color': '#5a9ec4', 'fill-opacity': 0.16 },
      })
      map.addLayer({
        id: 'db-fences-line',
        type: 'line',
        source: 'db-fences',
        paint: { 'line-color': '#2f6f90', 'line-width': 1.6, 'line-dasharray': [2, 2] },
      })

      map.addSource('hq-links', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'hq-links-line',
        type: 'line',
        source: 'hq-links',
        paint: { 'line-color': '#8a6f4a', 'line-width': 1.4, 'line-opacity': 0.7 },
      })

      map.addSource('flood', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'flood-fill',
        type: 'fill',
        source: 'flood',
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.38,
        },
      })
      map.addLayer({
        id: 'flood-line',
        type: 'line',
        source: 'flood',
        paint: {
          'line-color': '#0284c7',
          'line-width': 2.6,
          'line-dasharray': [1.4, 0.8],
        },
      })

      map.addSource('radius', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: {
          'fill-color': ['case', ['==', ['get', 'hot'], true], '#fb7185', '#fbbf24'],
          'fill-opacity': 0.22,
        },
      })
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: {
          'line-color': ['case', ['==', ['get', 'hot'], true], '#e11d48', '#d97706'],
          'line-width': ['case', ['==', ['get', 'hot'], true], 2.6, 2],
          'line-dasharray': [2, 2],
        },
      })

      map.addSource('asset-link', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'asset-link-line',
        type: 'line',
        source: 'asset-link',
        paint: {
          'line-color': '#ea580c',
          'line-width': 3.2,
          'line-dasharray': [2.2, 1],
        },
      })

      map.resize()
      syncZoomClass()
    })

    map.on('zoom', syncZoomClass)
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    const ro = new ResizeObserver(() => map.resize())
    if (wrapRef.current) ro.observe(wrapRef.current)

    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

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
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(asset.coords).addTo(map)
      markersRef.current.push(mk)
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
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(event.coords).addTo(map)
      markersRef.current.push(mk)
    })

    const apply = () => {
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
          features: liveOrForecast && !scene.flood && !scene.warehouse && !scene.distance
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
          features: liveOrForecast && !scene.flood && !scene.warehouse && !scene.distance
            ? events
                .filter((e) => e.db)
                .map((e) => ({
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: [e.db.hq.coords, e.coords],
                  },
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
      if (flood) {
        flood.setData({
          type: 'FeatureCollection',
          features: scene.flood ? [MUMBAI_FLOOD_ZONE] : [],
        })
      }

      const warehouse = assets.find((a) => a.id === (highlightAssetId || DEMO.assetId))
      const ev =
        selected?.type === 'event' ? events.find((e) => e.id === selected.id) : events.find((e) => e.id === DEMO.eventId)
      const link = map.getSource('asset-link')
      if (link) {
        link.setData({
          type: 'FeatureCollection',
          features:
            scene.distance && ev && warehouse
              ? [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: [ev.coords, warehouse.coords],
                    },
                  },
                ]
              : [],
        })
      }

      if (scene.distance && ev && warehouse) {
        const km = haversineKm(ev.coords, warehouse.coords)
        const mid = [(ev.coords[0] + warehouse.coords[0]) / 2, (ev.coords[1] + warehouse.coords[1]) / 2]
        const chip = document.createElement('div')
        chip.className = `dist-chip sev-${ev.severity || 'low'}`
        chip.innerHTML = `<em>Distance</em><b>${km.toFixed(1)} km</b><span>event → ${escapeHtml(warehouse.name)}</span>`
        const mk = new maplibregl.Marker({ element: chip, anchor: 'center' }).setLngLat(mid).addTo(map)
        markersRef.current.push(mk)
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
      selected.type === 'event'
        ? evs.find((e) => e.id === selected.id)
        : asts.find((a) => a.id === selected.id)
    if (!target) return
    const cinematic = scene.flood || scene.distance || scene.warehouse
    const zoom = cinematic ? (scene.distance ? 12.2 : 11.6) : selected.type === 'event' ? 11.2 : 9.6
    const fly = () =>
      map.flyTo({
        center: target.coords,
        zoom,
        pitch: cinematic ? 54 : 52,
        bearing: selected.type === 'event' ? -28 : -12,
        duration: cinematic ? 1100 : 1800,
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

  const zoomOut = () => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({
      center: [78.0, 21.5],
      zoom: 4.15,
      pitch: 28,
      bearing: -8,
      duration: 1200,
      essential: true,
    })
  }

  return (
    <div className="map-el terrain-map">
      <div className="terrain-canvas" ref={wrapRef} />
      <div className="terrain-chrome">
        <div className="terrain-tools">
          <button type="button" className="terrain-btn" onClick={zoomOut}>
            Zoom out
          </button>
        </div>
        {selectedEvent && (
          <article className={`terrain-readout sev-${selectedEvent.severity}`}>
            <header>
              <span className={`sev-badge ${selectedEvent.severity}`}>{selectedEvent.severity}</span>
              <span className="stamp">Severity · distance</span>
            </header>
            <h3>{selectedEvent.title}</h3>
            <div className="readout-metrics">
              <div>
                <span>Distance to site</span>
                <b>{selectedEvent.linked ? `${selectedEvent.primary.km.toFixed(1)} km` : '—'}</b>
              </div>
              <div>
                <span>Site</span>
                <b>{selectedEvent.linked ? selectedEvent.primary.asset.name : 'Unlinked'}</b>
              </div>
              <div>
                <span>Fence</span>
                <b>
                  {selectedEvent.linked
                    ? `${selectedEvent.primary.inside ? 'Inside' : 'Outside'} ${selectedEvent.primary.asset.radiusKm} km`
                    : 'No fence hit'}
                </b>
              </div>
            </div>
          </article>
        )}
        {!selectedEvent && selectedAsset && (
          <article className="terrain-readout">
            <header>
              <span className="sev-badge low">{selectedAsset.criticality}</span>
              <span className="stamp">Registered site</span>
            </header>
            <h3>{selectedAsset.name}</h3>
            <div className="readout-metrics">
              <div>
                <span>Fence</span>
                <b>{selectedAsset.radiusKm} km</b>
              </div>
              <div>
                <span>City</span>
                <b>{selectedAsset.city}</b>
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
