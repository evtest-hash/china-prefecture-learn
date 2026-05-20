import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { MapChart } from "echarts/charts";
import { GeoComponent, TooltipComponent } from "echarts/components";
import { readChartTheme } from "./theme.js";
import { PROVINCE_NAMES } from "../data/divisions.js";

const PROVINCE_ADCODES = new Set(Object.keys(PROVINCE_NAMES));

echarts.use([CanvasRenderer, GeoComponent, TooltipComponent, MapChart]);

let chart = null;
let chartReady = false;
let mapLoaded = false;
let mapInitInFlight = false;
let resizeFrame = 0;
let onToggleCallback = null;

const nameToAdcode = new Map();
const provinceBounds = new Map(); // provinceAdcode → { minLng, maxLng, minLat, maxLat, center }

export function setToggleCallback(fn) {
  onToggleCallback = fn;
}

export async function loadMap(mapElement) {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}china-prefecture.json`);
    if (!response.ok) throw new Error(`Map response failed: ${response.status}`);
    const geoJson = await response.json();

    nameToAdcode.clear();
    const provFeatures = new Map();

    for (const feature of geoJson.features) {
      const props = feature.properties;
      if (props.name) {
        nameToAdcode.set(props.name, String(props.adcode));
      }

      // For municipalities/SARs, parent.adcode is 100000 — use their own adcode instead
      const rawParent = String(props.parent?.adcode ?? "");
      const provAdcode = rawParent !== "100000" && PROVINCE_ADCODES.has(rawParent)
        ? rawParent
        : PROVINCE_ADCODES.has(String(props.adcode))
          ? String(props.adcode)
          : rawParent;
      if (!provFeatures.has(provAdcode)) {
        provFeatures.set(provAdcode, []);
      }
      provFeatures.get(provAdcode).push(feature);
    }

    // Compute bounding boxes
    for (const [provAdcode, features] of provFeatures) {
      let minLng = Infinity, maxLng = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;
      for (const f of features) {
        const coords = extractCoords(f.geometry);
        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
      provinceBounds.set(provAdcode, {
        minLng, maxLng, minLat, maxLat,
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      });
    }

    echarts.registerMap("china-prefecture", geoJson);
    mapLoaded = true;
    initChart(mapElement);
  } catch (error) {
    mapElement.innerHTML = `
      <div class="map-error">
        <strong>地图加载失败</strong>
        <span>请刷新页面重试。</span>
      </div>
    `;
    console.error(error);
  }
}

function extractCoords(geometry) {
  const points = [];
  if (!geometry) return points;

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const coord of ring) points.push(coord);
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) points.push(coord);
      }
    }
  }
  return points;
}

async function initChart(mapElement) {
  if (chartReady || mapInitInFlight) return;
  mapInitInFlight = true;

  try {
    await waitForContainer(mapElement);
    chart = echarts.init(mapElement, null, { renderer: "canvas" });
    chartReady = true;

    if (onChartReadyCallback) onChartReadyCallback();
  } catch {
    setTimeout(() => {
      mapInitInFlight = false;
      initChart(mapElement);
    }, 200);
    return;
  }

  mapInitInFlight = false;
}

let onChartReadyCallback = null;

export function onChartReady(fn) {
  onChartReadyCallback = fn;
  if (chartReady) fn();
}

async function waitForContainer(mapElement) {
  for (let i = 0; i < 120; i++) {
    const { width, height } = mapElement.getBoundingClientRect();
    if (width >= 10 && height >= 10) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Map container size is not ready.");
}

export function setupResize(mapElement) {
  window.addEventListener("resize", () => {
    if (!chartReady || !chart) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const { width, height } = mapElement.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      chart.resize({ width, height });
    });
  });
}

// China spans roughly 73–135° lng, 18–53° lat
const CHINA_LNG_SPAN = 62;
const CHINA_LAT_SPAN = 35;

function getDefaultLayout() {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const isTablet = !isMobile && window.matchMedia("(max-width: 1100px)").matches;

  return isMobile
    ? { zoom: 1.05, layoutCenter: ["50%", "52%"], layoutSize: "100%" }
    : isTablet
      ? { zoom: 1.08, layoutCenter: ["48%", "52%"], layoutSize: "92%" }
      : { zoom: 1.12, layoutCenter: ["48%", "51%"], layoutSize: "88%" };
}

function getProvinceZoom(provinceAdcode) {
  const bounds = provinceBounds.get(provinceAdcode);
  if (!bounds) return null;

  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;

  // Tight fit: show ~1.05x the province size so it fills most of the viewport
  const padFactor = 1.05;
  const zoomByLng = CHINA_LNG_SPAN / (lngSpan * padFactor);
  const zoomByLat = CHINA_LAT_SPAN / (latSpan * padFactor);
  const zoom = Math.min(zoomByLng, zoomByLat) * 0.95;

  return {
    center: bounds.center,
    zoom: Math.max(3, Math.min(zoom, 20)),
  };
}

export function renderMap(learnedSet, quizHighlight = null) {
  if (!chart) return;

  const theme = readChartTheme();
  const defaultLayout = getDefaultLayout();

  // Determine if we should zoom to a province
  let geoCenter = defaultLayout.layoutCenter;
  let geoZoom = defaultLayout.zoom;

  if (quizHighlight && quizHighlight.provinceAdcode) {
    const provZoom = getProvinceZoom(quizHighlight.provinceAdcode);
    if (provZoom) {
      geoCenter = provZoom.center;
      geoZoom = provZoom.zoom;
    }
  }

  const regions = [];
  for (const [name, adcode] of nameToAdcode) {
    const isQuizTarget = quizHighlight && quizHighlight.adcode === adcode;
    const isLearned = learnedSet.has(adcode);

    if (isQuizTarget) {
      regions.push({
        name,
        itemStyle: {
          areaColor: theme.quizHighlight,
          borderColor: theme.quizGlow,
          borderWidth: 3,
        },
        emphasis: { itemStyle: { areaColor: theme.quizHighlight } },
      });
    } else if (quizHighlight && quizHighlight.provinceAdcode) {
      // In quiz mode: dim regions outside the target province
      const feature = findFeature(name);
      const regionProvAdcode = feature ? getFeatureProvinceAdcode(feature) : "";
      const inTargetProvince = regionProvAdcode === quizHighlight.provinceAdcode;

      if (inTargetProvince) {
        // Same province but not the target: use default base color
      } else {
        // Outside province: dim it
        regions.push({
          name,
          itemStyle: { areaColor: theme.mapBase, opacity: 0.35 },
          emphasis: { itemStyle: { areaColor: theme.mapBase } },
        });
      }
    } else if (isLearned) {
      regions.push({
        name,
        itemStyle: { areaColor: theme.mapActive },
        emphasis: { itemStyle: { areaColor: theme.mapActive } },
      });
    }
  }

  // Click handler
  chart.off("click");
  chart.on("click", (params) => {
    if (quizHighlight) return;
    if (params.componentType !== "geo") return;
    const adcode = nameToAdcode.get(params.name);
    if (adcode && onToggleCallback) {
      onToggleCallback(adcode, params.name);
    }
  });

  const option = {
    backgroundColor: "transparent",
    tooltip: quizHighlight
      ? { show: false }
      : {
          trigger: "item",
          triggerOn: "mousemove|click",
          backgroundColor: theme.tooltipBackground,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: [8, 12],
          textStyle: { color: theme.tooltipText, fontSize: 13 },
          extraCssText: "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:10px;",
          formatter: (params) => {
            const adcode = nameToAdcode.get(params.name) || "";
            const learned = learnedSet.has(adcode);
            const status = learned ? "✓ 已学习" : "未学习";
            const statusColor = learned ? theme.mapActive : theme.tooltipText;
            return `<strong>${params.name}</strong><br/><span style="color:${statusColor}">${status}</span>`;
          },
        },
    geo: {
      map: "china-prefecture",
      roam: true,
      center: Array.isArray(geoCenter) && typeof geoCenter[0] === "number"
        ? geoCenter
        : undefined,
      zoom: geoZoom,
      layoutCenter: Array.isArray(geoCenter) && typeof geoCenter[0] === "string"
        ? geoCenter
        : undefined,
      layoutSize: Array.isArray(geoCenter) && typeof geoCenter[0] === "string"
        ? defaultLayout.layoutSize
        : undefined,
      scaleLimit: { min: 0.8, max: 20 },
      selectedMode: false,
      itemStyle: {
        areaColor: theme.mapBase,
        borderColor: theme.mapBorder,
        borderWidth: 0.8,
      },
      emphasis: quizHighlight
        ? {
            itemStyle: { areaColor: theme.mapBase },
            label: { show: false },
          }
        : {
            itemStyle: { areaColor: theme.mapHover },
            label: {
              show: true,
              color: theme.tooltipText,
              fontSize: 12,
              fontWeight: 500,
            },
          },
      regions,
    },
    series: [],
  };

  chart.setOption(option, true);
}

// Cache for feature lookups by name
const featureByName = new Map();

function findFeature(name) {
  if (featureByName.size === 0) {
    const mapData = echarts.getMap("china-prefecture");
    if (mapData) {
      for (const f of mapData.geoJson.features) {
        if (f.properties.name) featureByName.set(f.properties.name, f);
      }
    }
  }
  return featureByName.get(name);
}

function getFeatureProvinceAdcode(feature) {
  const rawParent = String(feature.properties.parent?.adcode ?? "");
  if (rawParent !== "100000" && PROVINCE_ADCODES.has(rawParent)) return rawParent;
  const ownAdcode = String(feature.properties.adcode);
  if (PROVINCE_ADCODES.has(ownAdcode)) return ownAdcode;
  return rawParent;
}

export function resizeChart() {
  if (chart) chart.resize();
}
