export type AqiLevel = { label: string; token: string; advice: string };

export function aqiLevel(v: number): AqiLevel {
  if (v <= 50) return { label: "Good", token: "aqi-good", advice: "Air is clean. Enjoy outdoor activity." };
  if (v <= 100) return { label: "Moderate", token: "aqi-moderate", advice: "Acceptable. Unusually sensitive people should limit long exertion." };
  if (v <= 150) return { label: "Unhealthy for sensitive groups", token: "aqi-usg", advice: "Children, older adults and people with heart or lung conditions should reduce long or intense outdoor activity." };
  if (v <= 200) return { label: "Unhealthy", token: "aqi-unhealthy", advice: "Everyone may feel effects. Limit outdoor exertion." };
  if (v <= 300) return { label: "Very unhealthy", token: "aqi-very", advice: "Health alert. Avoid outdoor activity." };
  return { label: "Hazardous", token: "aqi-hazard", advice: "Emergency conditions. Stay indoors." };
}

export const SCALE = [
  { from: 0, label: "Good", token: "aqi-good" },
  { from: 51, label: "Moderate", token: "aqi-moderate" },
  { from: 101, label: "Sensitive groups", token: "aqi-usg" },
  { from: 151, label: "Unhealthy", token: "aqi-unhealthy" },
  { from: 201, label: "Very unhealthy", token: "aqi-very" },
  { from: 301, label: "Hazardous", token: "aqi-hazard" },
];

/** Position (0-1) of an AQI value on the 6-band scale (each band equal width). */
export function scalePos(v: number) {
  const edges = [0, 50, 100, 150, 200, 300, 500];
  for (let i = 0; i < 6; i++) {
    if (v <= edges[i + 1]!) return (i + (v - edges[i]!) / (edges[i + 1]! - edges[i]!)) / 6;
  }
  return 1;
}

export type Place = { name: string; region?: string; lat: number; lon: number };

export type Forecast = {
  time: string[];
  aqi: number[];
  pm25: number[];
  pm10: number[];
  o3: number[];
  no2: number[];
  so2: number[];
  co: number[];
};

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide&forecast_days=5&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to load forecast");
  const h = (await r.json()).hourly;
  return { time: h.time, aqi: h.us_aqi, pm25: h.pm2_5, pm10: h.pm10, o3: h.ozone, no2: h.nitrogen_dioxide, so2: h.sulphur_dioxide, co: h.carbon_monoxide };
}

export type Weather = {
  temp: number; code: number; isDay: boolean; humidity: number; wind: number;
  hi: number; lo: number; uv: number; rain: number; localTime: string;
};

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to load weather");
  const j = await r.json();
  const c = j.current;
  return {
    temp: c.temperature_2m, code: c.weather_code, isDay: !!c.is_day, humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m, uv: c.uv_index ?? 0, hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0],
    rain: j.daily.precipitation_probability_max[0] ?? 0, localTime: c.time,
  };
}

export function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Thunderstorm";
}

export function uvLabel(uv: number) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

export async function searchPlaces(q: string): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6`);
  const j = await r.json();
  return (j.results ?? []).map((p: any) => ({ name: p.name, region: [p.admin1, p.country].filter(Boolean).join(", "), lat: p.latitude, lon: p.longitude }));
}

/** Approximate AQI sub-index for each pollutant (US EPA breakpoints, µg/m³). */
const BP: Record<string, number[]> = {
  pm25: [12, 35.4, 55.4, 150.4, 250.4],
  pm10: [54, 154, 254, 354, 424],
  o3: [108, 140, 170, 210, 400],
  no2: [100, 188, 677, 1221, 2349],
  so2: [92, 197, 485, 797, 1583],
  co: [5000, 10800, 14200, 17600, 34800],
};
export function pollutantAqi(key: string, v: number) {
  const b = BP[key]!;
  const lims = [50, 100, 150, 200, 300];
  let lo = 0, aLo = 0;
  for (let i = 0; i < b.length; i++) {
    if (v <= b[i]!) return aLo + ((v - lo) / (b[i]! - lo)) * (lims[i]! - aLo);
    lo = b[i]!; aLo = lims[i]!;
  }
  return 400;
}

export const CITIES: Place[] = [
  { name: "Delhi", region: "Delhi, India", lat: 28.61, lon: 77.21 },
  { name: "Mumbai", region: "Maharashtra, India", lat: 19.08, lon: 72.88 },
  { name: "Bangalore", region: "Karnataka, India", lat: 12.97, lon: 77.59 },
  { name: "Kolkata", region: "West Bengal, India", lat: 22.57, lon: 88.36 },
  { name: "Chennai", region: "Tamil Nadu, India", lat: 13.08, lon: 80.27 },
  { name: "Ludhiana", region: "Punjab, India", lat: 30.9, lon: 75.85 },
];
