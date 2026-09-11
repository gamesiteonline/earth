import { i as __toESM, n as __exportAll } from "../_runtime.mjs";
import { _ as require_jsx_runtime, v as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { _ as useRouter, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DMnSResl.js
var router_DMnSResl_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-CtWUcG0L.css";
var APP_NAME = "Orbital";
var Route$4 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#05060a"
			},
			{
				name: "description",
				content: "Live 3D Earth observatory — glowing markers, NASA fires, OpenSky flights, and N2YO satellites."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter = () => import("./routes-CEqxS44D.mjs");
var Route$3 = createFileRoute("/")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
async function fetchWithTimeout(url, ms = 16e3, init = {}) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		return await fetch(url, {
			...init,
			signal: ctrl.signal,
			headers: {
				Accept: "application/json, text/csv, text/plain;q=0.9, */*;q=0.8",
				"User-Agent": "OrbitalEarth/1.0",
				...init.headers
			}
		});
	} finally {
		clearTimeout(timer);
	}
}
function parseCsv(text) {
	const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
	if (lines.length < 2) return [];
	const headers = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());
	const rows = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const cols = splitCsvLine(line);
		const row = {};
		for (let j = 0; j < headers.length; j++) {
			const key = headers[j];
			if (key) row[key] = (cols[j] ?? "").trim();
		}
		rows.push(row);
	}
	return rows;
}
function splitCsvLine(line) {
	const out = [];
	let cur = "";
	let q = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === "\"") {
			q = !q;
			continue;
		}
		if (ch === "," && !q) {
			out.push(cur);
			cur = "";
			continue;
		}
		cur += ch;
	}
	out.push(cur);
	return out;
}
function num(v, fallback = 0) {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}
var TTL_MS$1 = 25e3;
var MAX_POINTS$1 = 1600;
var cache$1 = null;
var Route$2 = createFileRoute("/api/aircraft")({ server: { handlers: { GET: async () => {
	if (cache$1 && Date.now() - cache$1.at < TTL_MS$1) return Response.json(cache$1.payload);
	try {
		const payload = await loadAircraft();
		cache$1 = {
			at: Date.now(),
			payload
		};
		return Response.json(payload, { headers: { "Cache-Control": "public, max-age=15" } });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Aircraft feed unavailable";
		const fallback = cache$1?.payload ?? {
			meta: {
				source: "OpenSky Network",
				at: Date.now(),
				count: 0,
				status: "offline",
				message
			},
			points: []
		};
		fallback.meta = {
			...fallback.meta,
			status: "offline",
			message
		};
		return Response.json(fallback, { status: 200 });
	}
} } } });
async function loadAircraft() {
	const opensky = await tryOpenSky();
	if (opensky && opensky.length > 40) {
		const sampled = stride(opensky, MAX_POINTS$1);
		return {
			meta: {
				source: "OpenSky Network",
				at: Date.now(),
				count: sampled.length,
				status: "ok"
			},
			points: sampled
		};
	}
	const sampled = stride(await loadAdsb(), MAX_POINTS$1);
	return {
		meta: {
			source: "ADS-B (OpenSky unreachable)",
			at: Date.now(),
			count: sampled.length,
			status: sampled.length ? "degraded" : "offline",
			message: opensky ? "OpenSky returned a thin sample" : "OpenSky timed out"
		},
		points: sampled
	};
}
async function tryOpenSky() {
	try {
		const res = await fetchWithTimeout("https://opensky-network.org/api/states/all", 7e3);
		if (!res.ok) return null;
		return parseOpenSky((await res.json()).states ?? []);
	} catch {
		return null;
	}
}
function parseOpenSky(states) {
	const points = [];
	for (const s of states) {
		const lat = Number(s[6]);
		const lon = Number(s[5]);
		if (Boolean(s[8]) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
		const callsign = String(s[1] ?? "").trim();
		points.push({
			icao: String(s[0] ?? ""),
			callsign: callsign || String(s[0] ?? "aircraft"),
			country: String(s[2] ?? ""),
			lat,
			lon,
			alt: Number(s[13] ?? s[7] ?? 0) || 0,
			heading: Number(s[10] ?? 0) || 0,
			velocity: Number(s[9] ?? 0) || 0
		});
	}
	return points;
}
var HUBS = [
	[40.64, -73.78],
	[33.94, -118.41],
	[51.47, -.45],
	[50.03, 8.57],
	[25.25, 55.36],
	[1.36, 103.99],
	[35.55, 139.78],
	[-33.95, 151.18],
	[41.98, -87.9],
	[22.31, 113.91],
	[-23.43, -46.47],
	[52.31, 4.76]
];
async function loadAdsb() {
	const urls = ["https://api.adsb.lol/v2/mil", ...HUBS.map(([lat, lon]) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`)];
	const batches = await Promise.all(urls.map(async (url) => {
		try {
			const res = await fetchWithTimeout(url, 9e3);
			if (!res.ok) return [];
			return (await res.json()).ac ?? [];
		} catch {
			return [];
		}
	}));
	const seen = /* @__PURE__ */ new Set();
	const points = [];
	for (const ac of batches.flat()) {
		const lat = Number(ac.lat);
		const lon = Number(ac.lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		const key = (ac.hex || `${lat},${lon}`).toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		if (ac.alt_baro === "ground") continue;
		const alt = typeof ac.alt_baro === "number" ? ac.alt_baro * .3048 : typeof ac.alt_geom === "number" ? ac.alt_geom * .3048 : 1e4;
		const callsign = (ac.flight || ac.r || ac.hex || "traffic").trim();
		points.push({
			icao: ac.hex || key,
			callsign,
			country: "",
			lat,
			lon,
			alt,
			heading: Number(ac.track) || 0,
			velocity: (Number(ac.gs) || 0) / 1.94384
		});
	}
	return points;
}
function stride(arr, max) {
	if (arr.length <= max) return arr;
	const out = [];
	const step = arr.length / max;
	for (let i = 0; i < max; i++) {
		const v = arr[Math.floor(i * step)];
		if (v) out.push(v);
	}
	return out;
}
/** Server-only credentials. Imported exclusively from API route handlers. */
var FIRMS_MAP_KEY = process.env.NASA_FIRMS_MAP_KEY?.trim() || "23c6edfb7bc796a4fdecfb67b0d17775";
var N2YO_API_KEY = process.env.N2YO_API_KEY?.trim() || "LEFGSV-Z8Q45Y-UDKAXK-5UBO";
process.env.OPENSKY_CLIENT_ID?.trim();
var TTL_MS = 48e4;
var MAX_POINTS = 2200;
var SOURCE = "VIIRS_NOAA20_NRT";
var cache = null;
var Route$1 = createFileRoute("/api/firms")({ server: { handlers: { GET: async () => {
	if (cache && Date.now() - cache.at < TTL_MS) return Response.json(cache.payload);
	try {
		const payload = await loadFires();
		cache = {
			at: Date.now(),
			payload
		};
		return Response.json(payload, { headers: { "Cache-Control": "public, max-age=120" } });
	} catch (err) {
		const message = err instanceof Error ? err.message : "FIRMS unavailable";
		const fallback = cache?.payload ?? {
			meta: {
				source: "NASA FIRMS VIIRS",
				at: Date.now(),
				count: 0,
				status: "offline",
				message
			},
			points: []
		};
		fallback.meta = {
			...fallback.meta,
			status: "offline",
			message
		};
		return Response.json(fallback, { status: 200 });
	}
} } } });
async function latestDate() {
	const max = parseCsv(await (await fetchWithTimeout(`https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${FIRMS_MAP_KEY}/${SOURCE}`, 1e4)).text())[0]?.max_date?.trim();
	if (max && /^\d{4}-\d{2}-\d{2}$/.test(max)) return max;
	const d = /* @__PURE__ */ new Date();
	d.setUTCDate(d.getUTCDate() - 1);
	return d.toISOString().slice(0, 10);
}
async function loadFires() {
	const date = await latestDate();
	const res = await fetchWithTimeout(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${SOURCE}/world/1/${date}`, 28e3);
	const text = await res.text();
	if (!res.ok || !/latitude/i.test(text.split(/\r?\n/, 1)[0] ?? "")) throw new Error(text.slice(0, 180) || `FIRMS ${res.status}`);
	const rows = parseCsv(text);
	const points = [];
	for (const row of rows) {
		const lat = num(row.latitude);
		const lon = num(row.longitude);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
		points.push({
			lat,
			lon,
			frp: num(row.frp),
			brightness: num(row.bright_ti4 || row.brightness),
			date: row.acq_date ?? date
		});
	}
	points.sort((a, b) => b.frp - a.frp);
	const sampled = sample(points, MAX_POINTS);
	return {
		meta: {
			source: `NASA FIRMS · VIIRS NOAA-20 · ${date}`,
			at: Date.now(),
			count: sampled.length,
			status: sampled.length ? "ok" : "degraded"
		},
		points: sampled
	};
}
function sample(points, max) {
	if (points.length <= max) return points;
	const out = [];
	const step = points.length / max;
	for (let i = 0; i < max; i++) {
		const p = points[Math.floor(i * step)];
		if (p) out.push(p);
	}
	return out;
}
var TLE_TTL = 108e5;
var SNAP_TTL = 7e4;
var CATALOG = [
	{
		id: 25544,
		name: "ISS",
		kind: "station"
	},
	{
		id: 48274,
		name: "Tiangong",
		kind: "station"
	},
	{
		id: 20580,
		name: "Hubble",
		kind: "science"
	},
	{
		id: 25994,
		name: "Terra",
		kind: "earth"
	},
	{
		id: 27424,
		name: "Aqua",
		kind: "earth"
	},
	{
		id: 43013,
		name: "NOAA-20",
		kind: "weather"
	},
	{
		id: 42063,
		name: "Sentinel-2B",
		kind: "earth"
	},
	{
		id: 49260,
		name: "Landsat 9",
		kind: "earth"
	},
	{
		id: 39084,
		name: "Landsat 8",
		kind: "earth"
	},
	{
		id: 40697,
		name: "Sentinel-2A",
		kind: "earth"
	}
];
var tleCache = null;
var snapCache = null;
var Route = createFileRoute("/api/satellites")({ server: { handlers: { GET: async () => {
	try {
		const [tles, overhead] = await Promise.all([loadTles(), loadOverhead()]);
		const payload = {
			meta: {
				source: "N2YO / Celestrak",
				at: Date.now(),
				count: Math.max(tles.length, overhead.length),
				status: tles.length ? "ok" : overhead.length ? "degraded" : "offline"
			},
			tles,
			overhead
		};
		return Response.json(payload, { headers: { "Cache-Control": "public, max-age=30" } });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Satellite feed unavailable";
		const payload = {
			meta: {
				source: "N2YO",
				at: Date.now(),
				count: tleCache?.tles.length ?? 0,
				status: "offline",
				message
			},
			tles: tleCache?.tles ?? [],
			overhead: snapCache?.overhead ?? []
		};
		return Response.json(payload, { status: 200 });
	}
} } } });
async function loadTles() {
	if (tleCache && Date.now() - tleCache.at < TLE_TTL) return tleCache.tles;
	const tles = [];
	for (const sat of CATALOG) {
		const tle = await fetchOneTle(sat);
		if (tle) tles.push(tle);
	}
	if (tles.length) tleCache = {
		at: Date.now(),
		tles
	};
	return tles;
}
async function fetchOneTle(sat) {
	const n2yo = `https://api.n2yo.com/rest/v1/satellite/tle/${sat.id}?apiKey=${N2YO_API_KEY}`;
	try {
		const res = await fetchWithTimeout(n2yo, 8e3);
		if (res.ok) {
			const json = await res.json();
			const parsed = splitTle(json.tle ?? "");
			if (parsed) return {
				id: sat.id,
				name: json.info?.satname || sat.name,
				kind: sat.kind,
				...parsed
			};
		}
	} catch {}
	try {
		const res = await fetchWithTimeout(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${sat.id}&FORMAT=tle`, 8e3);
		if (!res.ok) return null;
		const lines = (await res.text()).trim().split(/\r?\n/);
		const l1 = lines.find((l) => l.startsWith("1 "));
		const l2 = lines.find((l) => l.startsWith("2 "));
		if (!l1 || !l2) return null;
		return {
			id: sat.id,
			name: sat.name,
			kind: sat.kind,
			line1: l1.trim(),
			line2: l2.trim()
		};
	} catch {
		return null;
	}
}
function splitTle(raw) {
	const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	const line1 = lines.find((l) => l.startsWith("1 "));
	const line2 = lines.find((l) => l.startsWith("2 "));
	if (!line1 || !line2) return null;
	return {
		line1,
		line2
	};
}
async function loadOverhead() {
	if (snapCache && Date.now() - snapCache.at < SNAP_TTL) return snapCache.overhead;
	const url = `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/90/15/?apiKey=${N2YO_API_KEY}`;
	try {
		const res = await fetchWithTimeout(url, 1e4);
		if (!res.ok) return snapCache?.overhead ?? [];
		const overhead = ((await res.json()).above ?? []).map((s) => ({
			id: s.satid,
			name: s.satname,
			lat: s.satlat,
			lon: s.satlng,
			alt: s.satalt
		}));
		snapCache = {
			at: Date.now(),
			overhead
		};
		return overhead;
	} catch {
		return snapCache?.overhead ?? [];
	}
}
var rootRouteChildren = {
	IndexRoute: Route$3.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$4
	}),
	ApiAircraftRoute: Route$2.update({
		id: "/api/aircraft",
		path: "/api/aircraft",
		getParentRoute: () => Route$4
	}),
	ApiFirmsRoute: Route$1.update({
		id: "/api/firms",
		path: "/api/firms",
		getParentRoute: () => Route$4
	}),
	ApiSatellitesRoute: Route.update({
		id: "/api/satellites",
		path: "/api/satellites",
		getParentRoute: () => Route$4
	})
};
var routeTree = Route$4._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getRouter, router_DMnSResl_exports as t };
