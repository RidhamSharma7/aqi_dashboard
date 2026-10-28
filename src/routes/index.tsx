import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Droplets, Home, MapPin, Moon, Sun, SunMedium, Wind, CloudRain, Wind as Logo } from "lucide-react";
import {
  CITIES, SCALE, aqiLevel, fetchForecast, fetchWeather, pollutantAqi, scalePos, searchPlaces,
  uvLabel, weatherLabel, type Place,
} from "@/lib/aqi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Airwatch — Air Quality Index & Realtime Air Pollution" },
      { name: "description", content: "Live AQI, weather, pollutant levels and 5-day air quality forecast for any city." },
      { property: "og:title", content: "Airwatch — Air Quality Index & Realtime Air Pollution" },
      { property: "og:description", content: "Live AQI, weather and pollutant levels for any city." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const POLLUTANTS = [
  { key: "pm25", k: "PM2.5", name: "Fine particles", u: "µg/m³" },
  { key: "pm10", k: "PM10", name: "Coarse particles", u: "µg/m³" },
  { key: "o3", k: "O₃", name: "Ozone", u: "µg/m³" },
  { key: "no2", k: "NO₂", name: "Nitrogen dioxide", u: "µg/m³" },
  { key: "so2", k: "SO₂", name: "Sulphur dioxide", u: "µg/m³" },
  { key: "co", k: "CO", name: "Carbon monoxide", u: "µg/m³" },
] as const;

function Dashboard() {
  const [place, setPlace] = useState<Place>(CITIES[0]!);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);

  const results = useQuery({ queryKey: ["search", dq], queryFn: () => searchPlaces(dq), enabled: dq.length >= 2 });
  const aq = useQuery({ queryKey: ["aqi", place.lat, place.lon], queryFn: () => fetchForecast(place.lat, place.lon) });
  const wx = useQuery({ queryKey: ["wx", place.lat, place.lon], queryFn: () => fetchWeather(place.lat, place.lon) });
  const data = aq.data;

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    let idx = data.time.findIndex((t) => new Date(t).getTime() >= now - 3600e3);
    if (idx < 0) idx = 0;
    const hours = data.time.slice(idx, idx + 48).map((t, i) => ({ t, v: data.aqi[idx + i] ?? 0 }));
    const days: Record<string, number[]> = {};
    data.time.forEach((t, i) => { if (data.aqi[i] != null) (days[t.slice(0, 10)] ||= []).push(data.aqi[i]!); });
    const daily = Object.entries(days).map(([d, v]) => ({ d, max: Math.max(...v), min: Math.min(...v) }));
    return { idx, current: data.aqi[idx] ?? 0, hours, daily };
  }, [data]);

  const useMyLocation = () =>
    navigator.geolocation?.getCurrentPosition((p) =>
      setPlace({ name: "Your location", lat: p.coords.latitude, lon: p.coords.longitude }));

  const maxH = view ? Math.max(100, ...view.hours.map((h) => h.v)) : 100;
  const lvl = view ? aqiLevel(view.current) : null;
  const sub = place.region ? `${place.name}, ${place.region.split(",")[0]}` : place.name;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r bg-card px-4 py-5 md:block">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background"><Logo className="size-5" /></span>
          <div><p className="font-semibold leading-tight">Airwatch</p><p className="text-xs text-muted-foreground">Air Quality Index</p></div>
        </div>
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city or place"
            className="w-full rounded-xl border bg-background py-2.5 pl-3 pr-9 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={useMyLocation} aria-label="Use my location" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted">
            <Crosshair className="size-4" />
          </button>
          {q.length >= 2 && results.data && results.data.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
              {results.data.map((p) => (
                <li key={`${p.lat},${p.lon}`}>
                  <button onClick={() => { setPlace(p); setQ(""); }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {p.name}<span className="block text-xs text-muted-foreground">{p.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mb-2 mt-6 text-xs text-muted-foreground">Explore</p>
        <div className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2 font-semibold text-primary"><Home className="size-4" />Dashboard</div>
        <p className="mb-2 mt-6 text-xs text-muted-foreground">Popular cities</p>
        {CITIES.map((c) => (
          <button key={c.name} onClick={() => setPlace(c)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted ${c.name === place.name ? "font-semibold text-primary" : ""}`}>
            <MapPin className="size-4 text-muted-foreground" />{c.name}
          </button>
        ))}
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 md:px-10">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Air Quality Index &amp; Realtime Air Pollution</h1>
        <p className="mt-1 text-muted-foreground">Live air quality and weather for {sub}</p>

        <div className="mt-4 flex gap-2 overflow-x-auto md:hidden">
          {CITIES.map((c) => (
            <button key={c.name} onClick={() => setPlace(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${c.name === place.name ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{c.name}</button>
          ))}
        </div>

        {aq.isLoading && <p className="mt-6 text-muted-foreground">Loading air quality…</p>}
        {aq.error && <p className="mt-6 text-destructive">Couldn't load air quality. Try again.</p>}

        {view && lvl && data && (
          <>
            <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
              <section className="panel relative overflow-hidden" style={{ ["--lvl" as string]: `var(--${lvl.token})` }}>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--lvl),transparent_60%)] opacity-10" />
                <div className="relative">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p>Live AQI in {place.name}</p>
                    {wx.data && (
                      <p className="flex items-center gap-2 text-sm text-[color:var(--aqi-good)]">
                        <span className="size-2 rounded-full bg-[color:var(--aqi-good)]" />Updated {wx.data.localTime.slice(11, 16)} local time
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-8xl font-bold leading-none tracking-tight text-[color:var(--lvl)]">{Math.round(view.current)}</span>
                        <span className="text-muted-foreground">US AQI</span>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_oklab,var(--lvl)_15%,transparent)] px-4 py-1.5 font-semibold text-[color:var(--lvl)]">
                        <span className="size-2 rounded-full bg-[color:var(--lvl)]" />{lvl.label}
                      </span>
                      <p className="mt-4 max-w-lg text-muted-foreground">{lvl.advice}</p>
                    </div>
                    <div className="flex gap-3">
                      {(["pm25", "pm10"] as const).map((k) => (
                        <div key={k} className="rounded-xl border bg-card px-5 py-3">
                          <p className="text-sm text-muted-foreground">{k === "pm25" ? "PM2.5" : "PM10"}</p>
                          <p className="text-2xl font-semibold">{Math.round(data[k][view.idx] ?? 0)} <span className="text-xs font-normal text-muted-foreground">µg/m³</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="relative mt-8">
                    <div className="flex gap-0.5">
                      {SCALE.map((s) => <div key={s.from} className="h-2 flex-1 rounded-full" style={{ background: `var(--${s.token})` }} />)}
                    </div>
                    <span className="absolute top-1 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[color:var(--lvl)] shadow"
                      style={{ left: `${scalePos(view.current) * 100}%` }} />
                    <div className="mt-3 grid grid-cols-6 text-xs text-muted-foreground">
                      {SCALE.map((s) => <div key={s.from}><p>{s.from}</p><p className="hidden sm:block">{s.label}</p></div>)}
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <h2 className="text-xl font-semibold">Weather in {place.name}</h2>
                {wx.data ? (
                  <>
                    <div className="mt-5 flex items-center gap-4">
                      {wx.data.isDay ? <Sun className="size-12 text-[color:var(--aqi-moderate)]" /> : <Moon className="size-12 text-[color:var(--aqi-moderate)]" />}
                      <div>
                        <p className="text-5xl font-bold">{Math.round(wx.data.temp)}°<span className="text-xl font-normal">C</span></p>
                        <p className="text-muted-foreground">{weatherLabel(wx.data.code)} · H {Math.round(wx.data.hi)}° L {Math.round(wx.data.lo)}°</p>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-5 border-t pt-5">
                      <Stat icon={<Droplets className="size-4" />} label="Humidity" value={`${wx.data.humidity}%`} />
                      <Stat icon={<Wind className="size-4" />} label="Wind" value={`${Math.round(wx.data.wind)} km/h`} />
                      <Stat icon={<SunMedium className="size-4" />} label="UV index" value={`${Math.round(wx.data.uv)} · ${uvLabel(wx.data.uv)}`} />
                      <Stat icon={<CloudRain className="size-4" />} label="Rain chance" value={`${wx.data.rain}%`} />
                    </div>
                  </>
                ) : <p className="mt-4 text-muted-foreground">Loading weather…</p>}
              </section>
            </div>

            <section className="panel mt-5">
              <h2 className="text-xl font-semibold">Air pollutants in {place.name}</h2>
              <p className="text-muted-foreground">Current concentrations. Colour shows each pollutant's AQI level.</p>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
                {POLLUTANTS.map((p) => {
                  const v = data[p.key][view.idx];
                  const l = aqiLevel(v != null ? pollutantAqi(p.key, v) : 0);
                  return (
                    <div key={p.key} className="rounded-xl border border-t-4 p-4" style={{ borderTopColor: `var(--${l.token})` }}>
                      <p className="font-semibold">{p.k}</p>
                      <p className="text-sm text-muted-foreground">{p.name}</p>
                      <p className="mt-3 text-2xl font-semibold">{v != null ? Math.round(v) : "—"} <span className="text-xs font-normal text-muted-foreground">{p.u}</span></p>
                      <p className="mt-1 text-xs" style={{ color: `var(--${l.token})` }}>{l.label}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <section className="panel">
                <h2 className="text-xl font-semibold">Next 48 hours</h2>
                <div className="mt-6 flex h-40 items-end gap-[3px]">
                  {view.hours.map((h) => (
                    <div key={h.t} title={`${new Date(h.t).toLocaleString([], { weekday: "short", hour: "numeric" })}: ${Math.round(h.v)}`}
                      className="flex-1 rounded-t-sm opacity-90 hover:opacity-100"
                      style={{ height: `${(h.v / maxH) * 100}%`, background: `var(--${aqiLevel(h.v).token})` }} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Now</span><span>+24h</span><span>+48h</span></div>
              </section>
              <section className="panel">
                <h2 className="text-xl font-semibold">Daily outlook</h2>
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {view.daily.map((d) => {
                    const l = aqiLevel(d.max);
                    return (
                      <div key={d.d} className="rounded-xl border p-3">
                        <p className="text-xs text-muted-foreground">{new Date(d.d + "T12:00").toLocaleDateString([], { weekday: "short", day: "numeric" })}</p>
                        <p className="mt-1 text-3xl font-semibold" style={{ color: `var(--${l.token})` }}>{Math.round(d.max)}</p>
                        <p className="text-xs text-muted-foreground">low {Math.round(d.min)}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
        <footer className="mt-10 text-xs text-muted-foreground">Data: Open-Meteo / CAMS air quality model</footer>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>
    </div>
  );
}
