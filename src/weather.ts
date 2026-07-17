import { Coordinate } from "./domain";

export interface LiveWeather {
  source: "open-meteo" | "fallback";
  fetchedAt: string;
  location: Coordinate;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  precipitation: number;
  weatherCode: number;
  fireWeatherHint: "niedrig" | "beobachten" | "erhoeht";
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
  };
}

export async function fetchLiveWeather(location: Coordinate, signal?: AbortSignal): Promise<LiveWeather> {
  const params = new URLSearchParams({
    latitude: location.lat.toFixed(5),
    longitude: location.lng.toFixed(5),
    current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
    timezone: "Europe/Berlin",
    wind_speed_unit: "kmh",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Open-Meteo failed: ${response.status}`);
  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;
  if (!current) throw new Error("Open-Meteo response has no current weather");

  const temperature = finiteOr(current.temperature_2m, 22);
  const humidity = finiteOr(current.relative_humidity_2m, 55);
  const windSpeed = finiteOr(current.wind_speed_10m, 8);
  const windGusts = finiteOr(current.wind_gusts_10m, windSpeed);
  const precipitation = finiteOr(current.precipitation, 0);

  return {
    source: "open-meteo",
    fetchedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    location,
    temperature,
    humidity,
    windSpeed,
    windGusts,
    precipitation,
    weatherCode: finiteOr(current.weather_code, 0),
    fireWeatherHint: calculateFireWeatherHint(temperature, humidity, windGusts, precipitation),
  };
}

export function buildFallbackWeather(location: Coordinate): LiveWeather {
  const temperature = 25.8;
  const humidity = 47;
  const windGusts = 24;
  const precipitation = 0;
  return {
    source: "fallback",
    fetchedAt: new Date().toISOString(),
    location,
    temperature,
    humidity,
    windSpeed: 12,
    windGusts,
    precipitation,
    weatherCode: 2,
    fireWeatherHint: calculateFireWeatherHint(temperature, humidity, windGusts, precipitation),
  };
}

export function describeWeatherCode(code: number): string {
  if (code === 0) return "klar";
  if ([1, 2, 3].includes(code)) return "bewoelkt";
  if ([45, 48].includes(code)) return "Nebel";
  if ([51, 53, 55, 56, 57].includes(code)) return "Nieselregen";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wetterlage";
}

function calculateFireWeatherHint(temperature: number, humidity: number, windGusts: number, precipitation: number): LiveWeather["fireWeatherHint"] {
  const score = (temperature >= 28 ? 0.34 : temperature >= 24 ? 0.18 : 0) + (humidity <= 35 ? 0.38 : humidity <= 50 ? 0.2 : 0) + (windGusts >= 35 ? 0.22 : windGusts >= 22 ? 0.12 : 0) - (precipitation > 0 ? 0.28 : 0);
  if (score >= 0.52) return "erhoeht";
  if (score >= 0.22) return "beobachten";
  return "niedrig";
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
