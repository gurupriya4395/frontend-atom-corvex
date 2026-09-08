import { Map, Marker, NavigationControl, AttributionControl, LngLatBounds } from 'maplibre-gl'
import { eventMarkerHtml, eventBriefHtml, assetMarkerHtml } from './markers.js'
import { fmtLat, fmtLng } from './coords.js'
import { MUMBAI_FLOOD_ZONE } from './data.js'

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
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
    },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery', minzoom: 0, maxzoom: 22 },
    { id: 'labels', type: 'raster', source: 'labels', minzoom: 0, maxzoom: 22, paint: { 'raster-opacity': 0.88 } },
  ],
}

export class DeskMap {
  constructor(wrapEl, hudEl, onSelect) {
    this.wrapEl = wrapEl
    this.hudEl = hudEl
    this.onSelect = onSelect
    this.markers = []
    this.map = null
    this.ready = false
    this.active = false
    this.data = { events: [], assets: [], selected: null, showRadiusFor: null, scene: {}, highlightAssetId: null, timeMode: 'live', focusPoint: null }
  }

  boot() {
    if (this.map || this.wrapEl.clientWidth < 40) return
    try {
      this.map = new Map({
        container: this.wrapEl,
        style: SATELLITE_STYLE,
        center: [72.8777, 19.076],
        zoom: 12,
        attributionControl: false,
      })
      this.map.once('load', () => {
        addDeskLayers(this.map)
        this.map.resize()
        this.ready = true
        this.sync()
        ;['move', 'zoom', 'pitch', 'rotate'].forEach((ev) => this.map.on(ev, () => this.paintHud()))
      })
      this.map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
      this.map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    } catch (err) {
      console.error('Map failed', err)
    }
  }

  resize() {
    this.map?.resize()
  }

  setActive(on) {
    const turningOn = on && !this.active
    this.active = on
    if (!on) return
    if (!this.map) this.boot()
    if (turningOn) {
      const focus = () => {
        this.resize()
        if (this.ready) this.focusSelection()
      }
      focus()
      ;[80, 240, 480].forEach((ms) => setTimeout(focus, ms))
    }
  }

  update(payload) {
    this.data = { ...this.data, ...payload }
    if (!this.map) this.boot()
    if (this.ready) this.sync()
  }

  sync() {
    const map = this.map
    if (!map) return
    const { events, assets, selected, showRadiusFor, scene, highlightAssetId, timeMode, focusPoint } = this.data
    const liveOrForecast = timeMode === 'live' || timeMode === 'forecast'

    this.markers.forEach((m) => m.remove())
    this.markers = []

    assets.forEach((asset) => {
      const el = document.createElement('div')
      const hot = highlightAssetId === asset.id && scene.warehouse
      el.className = 'terrain-pin' + (hot ? ' is-hot' : '')
      el.innerHTML = assetMarkerHtml(asset)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.onSelect?.({ type: 'asset', id: asset.id })
      })
      this.markers.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat(asset.coords).addTo(map))
    })

    events.forEach((event) => {
      const isSelected = selected?.type === 'event' && selected.id === event.id
      const el = document.createElement('div')
      el.className = `terrain-ev${isSelected ? ' is-selected' : ''}`
      el.innerHTML = eventMarkerHtml(event)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.onSelect?.({ type: 'event', id: event.id })
      })
      this.markers.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat(event.coords).addTo(map))
    })

    map.getSource('pulses')?.setData({
      type: 'FeatureCollection',
      features: events.map((e) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: e.coords }, properties: { impact: e.impact || 'none' } })),
    })

    const hqs = assets.filter((a) => a.org === 'deutsche-bank')
    map.getSource('db-fences')?.setData({
      type: 'FeatureCollection',
      features:
        liveOrForecast && !scene.flood
          ? hqs.map((hq) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePoly(hq.coords, hq.radiusKm)] }, properties: { id: hq.id } }))
          : [],
    })

    const asset = assets.find((a) => a.id === showRadiusFor)
    map.getSource('radius')?.setData({
      type: 'FeatureCollection',
      features: asset
        ? [{ type: 'Feature', properties: { hot: Boolean(highlightAssetId && asset.id === highlightAssetId) }, geometry: { type: 'Polygon', coordinates: [circlePoly(asset.coords, asset.radiusKm)] } }]
        : [],
    })

    map.getSource('flood')?.setData({ type: 'FeatureCollection', features: scene.flood ? [MUMBAI_FLOOD_ZONE] : [] })

    const focusEvent = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : null
    const pairs = focusEvent?.linked && focusEvent.primary?.asset ? [focusEvent] : events.filter((e) => e.linked && e.primary?.asset)
    map.getSource('asset-link')?.setData({
      type: 'FeatureCollection',
      features: pairs.map((e) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [e.coords, e.primary.asset.coords] } })),
    })

    this.paintHud()
    if (this.active && selected?.id) this.focusSelection()

    const readout = document.getElementById('map-coord-readout')
    if (readout) {
      if (focusPoint) {
        readout.hidden = false
        readout.innerHTML = `<span class="map-coord-label">${focusPoint.label}</span><span class="map-coord-val"><em>Lat</em> ${fmtLat(focusPoint.lat)}</span><span class="map-coord-val"><em>Long</em> ${fmtLng(focusPoint.lng)}</span>`
      } else readout.hidden = true
    }
  }

  paintHud() {
    const map = this.map
    if (!map || !this.hudEl) return
    const { events, selected } = this.data
    const pairs = (events || []).filter((e) => e.linked && e.primary?.asset)
    let focus = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : null
    if (!focus) focus = pairs[0] || null
    const w = this.hudEl.clientWidth || map.getContainer().clientWidth
    const h = this.hudEl.clientHeight || map.getContainer().clientHeight
    const lines = pairs
      .map((e) => {
        const p1 = map.project(e.coords)
        const p2 = map.project(e.primary.asset.coords)
        const on = focus && e.id === focus.id
        return `<g class="${on ? 'is-on' : ''}"><line class="link-halo" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" /><line class="link-dash" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" /></g>`
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
    this.hudEl.innerHTML = `<svg class="desk-links" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${lines}</svg>${chips}${card}`
    this.hudEl.querySelectorAll('a').forEach((a) => a.addEventListener('click', (ev) => ev.stopPropagation()))
  }

  focusSelection() {
    const map = this.map
    const { events, assets, selected } = this.data
    if (!map || !selected?.id) return
    const target = selected.type === 'event' ? events.find((e) => e.id === selected.id) : assets.find((a) => a.id === selected.id)
    if (!target?.coords) return
    const bounds = new LngLatBounds(target.coords, target.coords)
    const extra = selected.type === 'event' ? target.primary?.asset?.coords : null
    if (extra) bounds.extend(extra)
    else {
      bounds.extend([target.coords[0] - 0.04, target.coords[1] - 0.04])
      bounds.extend([target.coords[0] + 0.04, target.coords[1] + 0.04])
    }
    map.fitBounds(bounds, { padding: { top: 96, bottom: 100, left: 300, right: 360 }, maxZoom: 13, duration: 900 })
  }

  zoomOut() {
    this.map?.flyTo({ center: [72.8777, 19.076], zoom: 12, pitch: 0, bearing: 0, duration: 1200 })
  }
}

function addDeskLayers(map) {
  const empty = { type: 'FeatureCollection', features: [] }
  if (!map.getSource('pulses')) {
    map.addSource('pulses', { type: 'geojson', data: empty })
    map.addLayer({
      id: 'pulses-heat',
      type: 'heatmap',
      source: 'pulses',
      paint: {
        'heatmap-weight': 0.65,
        'heatmap-intensity': 0.75,
        'heatmap-radius': 24,
        'heatmap-opacity': 0.22,
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.9, 'rgba(249, 115, 22, 0.45)'],
      },
    })
  }
  if (!map.getSource('db-fences')) {
    map.addSource('db-fences', { type: 'geojson', data: empty })
    map.addLayer({ id: 'db-fences-fill', type: 'fill', source: 'db-fences', paint: { 'fill-color': '#6366F1', 'fill-opacity': 0.1 } })
    map.addLayer({ id: 'db-fences-line', type: 'line', source: 'db-fences', paint: { 'line-color': '#6366F1', 'line-width': 2, 'line-dasharray': [2, 2] } })
  }
  if (!map.getSource('flood')) {
    map.addSource('flood', { type: 'geojson', data: empty })
    map.addLayer({ id: 'flood-fill', type: 'fill', source: 'flood', paint: { 'fill-color': '#6366F1', 'fill-opacity': 0.35 } })
    map.addLayer({ id: 'flood-line', type: 'line', source: 'flood', paint: { 'line-color': '#4F46E5', 'line-width': 2.5, 'line-dasharray': [1.4, 0.8] } })
  }
  if (!map.getSource('radius')) {
    map.addSource('radius', { type: 'geojson', data: empty })
    map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': ['case', ['==', ['get', 'hot'], true], '#F97316', '#8B5CF6'], 'fill-opacity': 0.2 } })
    map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': ['case', ['==', ['get', 'hot'], true], '#F97316', '#6366F1'], 'line-width': 2.2, 'line-dasharray': [2, 2] } })
  }
  if (!map.getSource('asset-link')) {
    map.addSource('asset-link', { type: 'geojson', data: empty })
    map.addLayer({ id: 'asset-link-halo', type: 'line', source: 'asset-link', paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.95 } })
    map.addLayer({ id: 'asset-link-line', type: 'line', source: 'asset-link', paint: { 'line-color': '#0f172a', 'line-width': 3.6, 'line-dasharray': [2.2, 1.6] } })
  }
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
