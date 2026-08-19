import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { eventMarkerHtml, assetMarkerHtml } from './markers'
import { clock, relativeTime } from './scoring'

export default function MapView({ events, assets, selected, onSelect, showRadiusFor, timeMode = 'live' }) {
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const liveOrForecast = timeMode === 'live' || timeMode === 'forecast'

  useEffect(() => {
    const map = new maplibregl.Map({
      container: wrapRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [8.67, 50.11],
      zoom: 2.2,
      pitch: 0,
      bearing: 0,
      maxPitch: 80,
      canvasContextAttributes: { antialias: true },
      projection: { type: 'globe' },
    })
    mapRef.current = map

    map.on('load', () => {
      try {
        map.setProjection({ type: 'globe' })
      } catch {
        /* pitched mercator still reads as 3D */
      }
      try {
        map.setSky({
          'sky-color': '#02060c',
          'sky-horizon-blend': 0.85,
          'horizon-color': '#1a2430',
          'horizon-fog-blend': 0.85,
          'fog-color': '#05080c',
          'fog-ground-blend': 0.55,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 0.4, 8, 0],
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
          'heatmap-weight': 0.8,
          'heatmap-intensity': 1.15,
          'heatmap-radius': 28,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.2,
            'rgba(60,224,200,0.15)',
            0.5,
            'rgba(196,165,116,0.25)',
            0.85,
            'rgba(255,77,18,0.45)',
          ],
        },
      })

      map.addSource('db-fences', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'db-fences-fill',
        type: 'fill',
        source: 'db-fences',
        paint: { 'fill-color': '#3d7ea6', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: 'db-fences-line',
        type: 'line',
        source: 'db-fences',
        paint: { 'line-color': '#7eb6d4', 'line-width': 1.3, 'line-dasharray': [2, 2] },
      })

      map.addSource('hq-links', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'hq-links-line',
        type: 'line',
        source: 'hq-links',
        paint: { 'line-color': '#c4a574', 'line-width': 1.2, 'line-opacity': 0.75 },
      })

      map.addSource('radius', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: { 'fill-color': '#c4a574', 'fill-opacity': 0.1 },
      })
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: { 'line-color': '#c4a574', 'line-width': 1.4, 'line-dasharray': [2, 2] },
      })
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left')
    return () => {
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
      el.className = 'terrain-ev'
      el.innerHTML = eventMarkerHtml(event)
      if (liveOrForecast && event.db) {
        const chip = document.createElement('div')
        chip.className = `hq-time ${event.db.inside ? 'in' : 'out'}`
        chip.innerHTML = `<strong>DB ${escapeHtml(event.db.hq.city)}</strong><span>${relativeTime(event.eventAt)} · ${clock(event.eventAt)}</span><span>${escapeHtml(event.db.travel.label)} · ${event.db.km.toFixed(1)} km</span>${event.db.inside ? '<em>inside HQ fence</em>' : '<em>outside fence</em>'}`
        el.appendChild(chip)
      }
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
          features: liveOrForecast
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
          features: liveOrForecast
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
                  geometry: { type: 'Polygon', coordinates: [circlePoly(asset.coords, asset.radiusKm)] },
                },
              ]
            : [],
        })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [events, assets, showRadiusFor, liveOrForecast])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected) return
    const ev = events.find((e) => e.id === selected.id)
    const ast = assets.find((a) => a.id === selected.id)
    const target = ev || ast
    if (!target) return
    const zoom = ev ? 11.2 : 9.6
    try {
      map.setProjection({ type: zoom > 5 ? 'mercator' : 'globe' })
    } catch {
      /* keep current projection */
    }
    map.flyTo({
      center: target.coords,
      zoom,
      pitch: 62,
      bearing: ev ? -34 : -16,
      duration: 2200,
      essential: true,
    })
  }, [selected, events, assets])

  return <div className="map-el" ref={wrapRef} />
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
