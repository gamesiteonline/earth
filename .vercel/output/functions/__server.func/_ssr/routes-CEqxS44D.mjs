import { i as __toESM } from "../_runtime.mjs";
import { _ as require_jsx_runtime, a as useThree, c as CanvasTexture, d as Object3D, f as Quaternion, h as Vector3, i as useFrame, l as Color, m as SRGBColorSpace, n as useTexture, p as RepeatWrapping, r as Canvas, s as BufferGeometry, t as OrbitControls, u as Float32BufferAttribute, v as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { a as RotateCcw, c as MapPin, i as Satellite, l as Flame, o as Radio, r as Search, s as Plane, t as X, u as ChevronRight } from "../_libs/lucide-react.mjs";
import { n as QueryClientProvider, t as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { a as propagate, i as gstime, n as degreesLong, o as twoline2satrec, r as eciToGeodetic, t as degreesLat } from "../_libs/satellite.js.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CEqxS44D.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EARTH_RADIUS_KM = 6371;
var DEG = Math.PI / 180;
/** Convert geographic lat/lon (degrees) onto a Y-up unit sphere matching SphereGeometry UVs. */
function latLonToVec3(lat, lon, radius = 1, target = new Vector3()) {
	const phi = (90 - lat) * DEG;
	const theta = (lon + 180) * DEG;
	const s = Math.sin(phi);
	return target.set(-radius * s * Math.cos(theta), radius * Math.cos(phi), radius * s * Math.sin(theta));
}
function vec3ToLatLon(x, y, z) {
	const lat = Math.asin(Math.max(-1, Math.min(1, y / (Math.hypot(x, y, z) || 1)))) * (180 / Math.PI);
	let lon = Math.atan2(z, -x) * (180 / Math.PI) - 180;
	lon = ((lon + 180) % 360 + 360) % 360 - 180;
	return {
		lat,
		lon
	};
}
/** Approximate solar subpoint → unit direction in globe space. */
function sunDirection(date = /* @__PURE__ */ new Date(), target = new Vector3()) {
	const start = Date.UTC(date.getUTCFullYear(), 0, 0);
	const day = (date.getTime() - start) / 864e5;
	return latLonToVec3(-23.44 * Math.cos(360 / 365 * (day + 10) * DEG), -15 * (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 - 12), 1, target);
}
/** Compress orbital altitude so LEO sits just above the surface and GEO stays in frame. */
function altitudeToRadius(altKm) {
	const real = Math.max(0, altKm) / EARTH_RADIUS_KM;
	return 1.012 + .48 * (1 - Math.exp(-real / .42));
}
function formatCoord(lat, lon) {
	const ns = lat >= 0 ? "N" : "S";
	const ew = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(2)}° ${ns}  ${Math.abs(lon).toFixed(2)}° ${ew}`;
}
var lookRaf = 0;
var useGlobeStore = create((set) => ({
	layers: {
		places: true,
		fires: true,
		aircraft: true,
		satellites: true
	},
	autoRotate: true,
	interacting: false,
	focusing: false,
	listOpen: false,
	search: "",
	selection: null,
	focus: null,
	look: {
		lat: 18,
		lon: 12
	},
	toggleLayer: (id) => set((s) => ({ layers: {
		...s.layers,
		[id]: !s.layers[id]
	} })),
	setAutoRotate: (v) => set({ autoRotate: v }),
	setInteracting: (v) => set({ interacting: v }),
	setFocusing: (v) => set({ focusing: v }),
	setListOpen: (v) => set({ listOpen: v }),
	setSearch: (v) => set({ search: v }),
	setLook: (lat, lon) => {
		if (lookRaf) return;
		lookRaf = requestAnimationFrame(() => {
			lookRaf = 0;
			set({ look: {
				lat,
				lon
			} });
		});
	},
	selectPlace: (loc) => set((s) => ({
		selection: {
			type: "place",
			id: loc.id,
			name: loc.name,
			lat: loc.lat,
			lon: loc.lon,
			region: loc.region,
			detail: loc.blurb
		},
		focus: {
			lat: loc.lat,
			lon: loc.lon,
			nonce: (s.focus?.nonce ?? 0) + 1
		},
		listOpen: typeof window !== "undefined" && window.innerWidth >= 900
	})),
	selectMarker: (sel, fly = true) => set((s) => ({
		selection: sel,
		focus: fly ? {
			lat: sel.lat,
			lon: sel.lon,
			nonce: (s.focus?.nonce ?? 0) + 1
		} : s.focus
	})),
	clearSelection: () => set({ selection: null })
}));
var sun = new Vector3(1, 0, 0);
var EARTH_VERT = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
var EARTH_FRAG = `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D bumpMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 l = normalize(sunDirection);
    float ndl = dot(n, l);
    float dayAmt = smoothstep(-0.05, 0.22, ndl);
    float twilight = 1.0 - smoothstep(0.0, 0.38, abs(ndl - 0.04));
    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float h = texture2D(bumpMap, vUv).r;
    dayCol *= 0.86 + h * 0.22;
    vec3 nightGlow = nightCol * nightCol * 1.85 + nightCol * 0.25;
    vec3 color = mix(nightGlow, dayCol, dayAmt);
    color += vec3(0.42, 0.18, 0.07) * twilight * 0.28;
    float fres = pow(1.0 - max(dot(n, normalize(vViewW)), 0.0), 2.4);
    color += vec3(0.28, 0.48, 0.78) * fres * 0.22;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
var ATM_VERT = `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
var ATM_FRAG = `
  uniform vec3 glowColor;
  uniform float power;
  uniform float intensity;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewW))), power);
    gl_FragColor = vec4(glowColor * f * intensity, f * 0.85);
    #include <colorspace_fragment>
  }
`;
function Earth() {
	const earthMat = (0, import_react.useRef)(null);
	const clearSelection = useGlobeStore((s) => s.clearSelection);
	const [dayMap, nightMap, bumpMap, cloudMap] = useTexture([
		"/textures/earth-day.jpg",
		"/textures/earth-night.jpg",
		"/textures/earth-bump.jpg",
		"/textures/earth-clouds.png"
	]);
	dayMap.colorSpace = SRGBColorSpace;
	nightMap.colorSpace = SRGBColorSpace;
	cloudMap.colorSpace = SRGBColorSpace;
	cloudMap.wrapS = cloudMap.wrapT = RepeatWrapping;
	dayMap.anisotropy = 8;
	nightMap.anisotropy = 8;
	const uniforms = (0, import_react.useMemo)(() => ({
		dayMap: { value: dayMap },
		nightMap: { value: nightMap },
		bumpMap: { value: bumpMap },
		sunDirection: { value: sunDirection(/* @__PURE__ */ new Date(), sun) }
	}), [
		dayMap,
		nightMap,
		bumpMap
	]);
	useFrame(({ clock }) => {
		const mat = earthMat.current;
		if (mat) mat.uniforms.sunDirection.value = sunDirection(/* @__PURE__ */ new Date(), sun);
		const clouds = clock.elapsedTime * .004;
		if (cloudMap) cloudMap.offset.x = clouds;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			onClick: (e) => {
				e.stopPropagation();
				clearSelection();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				1,
				96,
				64
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("shaderMaterial", {
				ref: earthMat,
				vertexShader: EARTH_VERT,
				fragmentShader: EARTH_FRAG,
				uniforms
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			1.008,
			64,
			48
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
			map: cloudMap,
			transparent: true,
			opacity: .38,
			depthWrite: false,
			blending: 2
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			1.045,
			64,
			48
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("shaderMaterial", {
			vertexShader: ATM_VERT,
			fragmentShader: ATM_FRAG,
			uniforms: {
				glowColor: { value: new Color("#7ea8d4") },
				power: { value: 4.2 },
				intensity: { value: 1.05 }
			},
			side: 1,
			transparent: true,
			depthWrite: false,
			blending: 2
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			1.018,
			64,
			48
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("shaderMaterial", {
			vertexShader: ATM_VERT,
			fragmentShader: ATM_FRAG,
			uniforms: {
				glowColor: { value: new Color("#9ec4e6") },
				power: { value: 3.4 },
				intensity: { value: .42 }
			},
			side: 0,
			transparent: true,
			depthWrite: false,
			blending: 2
		})] })
	] });
}
function Starfield({ count = 2800 }) {
	const geom = (0, import_react.useMemo)(() => {
		const g = new BufferGeometry();
		const pos = new Float32Array(count * 3);
		const col = new Float32Array(count * 3);
		const c = new Color();
		for (let i = 0; i < count; i++) {
			const r = 28 + Math.random() * 70;
			const u = Math.random();
			const v = Math.random();
			const theta = 2 * Math.PI * u;
			const phi = Math.acos(2 * v - 1);
			pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
			pos[i * 3 + 2] = r * Math.cos(phi);
			const t = Math.random();
			if (t > .86) c.set("#c9dcff");
			else if (t > .6) c.set("#f2f4f8");
			else c.set("#9aa3b5");
			col[i * 3] = c.r;
			col[i * 3 + 1] = c.g;
			col[i * 3 + 2] = c.b;
		}
		g.setAttribute("position", new Float32BufferAttribute(pos, 3));
		g.setAttribute("color", new Float32BufferAttribute(col, 3));
		return g;
	}, [count]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("points", {
		geometry: geom,
		frustumCulled: false,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointsMaterial", {
			vertexColors: true,
			size: .09,
			sizeAttenuation: true,
			transparent: true,
			opacity: .9,
			depthWrite: false,
			blending: 2
		})
	});
}
var FOCUS_RADIUS = 2.12;
var _from = new Vector3();
var _to = new Vector3();
var _cur = new Vector3();
function CameraRig() {
	const controls = (0, import_react.useRef)(null);
	const camera = useThree((s) => s.camera);
	const focus = useGlobeStore((s) => s.focus);
	const autoRotate = useGlobeStore((s) => s.autoRotate);
	const interacting = useGlobeStore((s) => s.interacting);
	const selection = useGlobeStore((s) => s.selection);
	const setInteracting = useGlobeStore((s) => s.setInteracting);
	const setFocusing = useGlobeStore((s) => s.setFocusing);
	const setLook = useGlobeStore((s) => s.setLook);
	const anim = (0, import_react.useRef)({
		active: false,
		t: 0,
		duration: 1.15
	});
	const idle = (0, import_react.useRef)(0);
	const idleLook = (0, import_react.useRef)(0);
	const reduced = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}, []);
	(0, import_react.useEffect)(() => {
		if (!focus) return;
		_from.copy(camera.position);
		latLonToVec3(focus.lat, focus.lon, FOCUS_RADIUS, _to);
		anim.current = {
			active: true,
			t: 0,
			duration: 1.15
		};
		setFocusing(true);
		if (controls.current) controls.current.enabled = false;
	}, [
		focus,
		camera,
		setFocusing
	]);
	useFrame((_, dt) => {
		const d = Math.min(dt, .08);
		const c = controls.current;
		if (anim.current.active) {
			anim.current.t += d;
			const u = Math.min(1, anim.current.t / anim.current.duration);
			const e = 1 - Math.pow(1 - u, 3);
			_cur.lerpVectors(_from, _to, e);
			camera.position.copy(_cur);
			camera.lookAt(0, 0, 0);
			if (c) {
				c.target.set(0, 0, 0);
				c.update();
			}
			if (u >= 1) {
				anim.current.active = false;
				setFocusing(false);
				if (c) c.enabled = true;
			}
		}
		if (interacting) idle.current = 0;
		else idle.current += d;
		if (c) c.autoRotate = autoRotate && !interacting && !selection && !anim.current.active && !reduced.current && idle.current > 2.4;
		const pos = camera.position;
		idleLook.current += d;
		if (idleLook.current > .16) {
			idleLook.current = 0;
			const ll = vec3ToLatLon(pos.x, pos.y, pos.z);
			setLook(ll.lat, ll.lon);
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrbitControls, {
		ref: controls,
		makeDefault: true,
		enablePan: false,
		enableDamping: true,
		dampingFactor: .08,
		rotateSpeed: .55,
		zoomSpeed: .7,
		minDistance: 1.38,
		maxDistance: 4.6,
		autoRotate: false,
		autoRotateSpeed: .28,
		onStart: () => setInteracting(true),
		onEnd: () => setInteracting(false)
	});
}
var FEATURED_LOCATIONS = [
	{
		id: "nyc",
		name: "New York",
		region: "United States",
		lat: 40.7128,
		lon: -74.006,
		kind: "city",
		blurb: "The Atlantic seaboard stacked into glass and grid — still the loudest city lights on the night side."
	},
	{
		id: "london",
		name: "London",
		region: "United Kingdom",
		lat: 51.5074,
		lon: -.1278,
		kind: "city",
		blurb: "A river city at the hinge of Europe, older than the maps that still refuse to let it go."
	},
	{
		id: "tokyo",
		name: "Tokyo",
		region: "Japan",
		lat: 35.6762,
		lon: 139.6503,
		kind: "city",
		blurb: "The largest metropolitan glow on Earth — a continuous city from the bay to the mountains."
	},
	{
		id: "paris",
		name: "Paris",
		region: "France",
		lat: 48.8566,
		lon: 2.3522,
		kind: "city",
		blurb: "The Seine’s tight curve, a radial boulevard plan, and a nightscape that still reads from orbit."
	},
	{
		id: "cairo",
		name: "Giza Plateau",
		region: "Egypt",
		lat: 29.9792,
		lon: 31.1342,
		kind: "landmark",
		blurb: "Where the Nile’s green ribbon meets the Western Desert — and four-thousand-year-old geometry still holds."
	},
	{
		id: "dubai",
		name: "Dubai",
		region: "United Arab Emirates",
		lat: 25.2048,
		lon: 55.2708,
		kind: "city",
		blurb: "A city drawn on sand in a single generation, lit hard enough to read from the terminator."
	},
	{
		id: "singapore",
		name: "Singapore",
		region: "Singapore",
		lat: 1.3521,
		lon: 103.8198,
		kind: "city",
		blurb: "A port-state on the Strait of Malacca, sitting on one of the planet’s busiest shipping seams."
	},
	{
		id: "sydney",
		name: "Sydney",
		region: "Australia",
		lat: -33.8688,
		lon: 151.2093,
		kind: "city",
		blurb: "Harbour and sandstone, facing the Pacific, with a night signature that pins the Australian east coast."
	},
	{
		id: "rio",
		name: "Rio de Janeiro",
		region: "Brazil",
		lat: -22.9068,
		lon: -43.1729,
		kind: "city",
		blurb: "Granite peaks, Guanabara Bay, and a city pressed between forest and Atlantic swell."
	},
	{
		id: "cape-town",
		name: "Cape Town",
		region: "South Africa",
		lat: -33.9249,
		lon: 18.4241,
		kind: "city",
		blurb: "Table Mountain at the meeting of two oceans — the southern hinge of the African continent."
	},
	{
		id: "ksc",
		name: "Kennedy Space Center",
		region: "Florida, USA",
		lat: 28.5729,
		lon: -80.649,
		kind: "science",
		blurb: "The coastal range that threw Apollo at the Moon. Pads still light up the marsh on launch nights."
	},
	{
		id: "baikonur",
		name: "Baikonur",
		region: "Kazakhstan",
		lat: 45.965,
		lon: 63.305,
		kind: "science",
		blurb: "The oldest operating launch complex on Earth — steppe, rail, and a corridor to low orbit."
	},
	{
		id: "everest",
		name: "Mount Everest",
		region: "Nepal / China",
		lat: 27.9881,
		lon: 86.925,
		kind: "wild",
		blurb: "The planet’s highest point, 8,849 m above the geoid — a white knot in the Himalayan chain."
	},
	{
		id: "machu",
		name: "Machu Picchu",
		region: "Peru",
		lat: -13.1631,
		lon: -72.545,
		kind: "landmark",
		blurb: "A fifteenth-century citadel on a knife-edge ridge of the Andes, above the Urubamba loop."
	},
	{
		id: "grand-canyon",
		name: "Grand Canyon",
		region: "Arizona, USA",
		lat: 36.1069,
		lon: -112.1129,
		kind: "wild",
		blurb: "Two billion years of rock opened by the Colorado — a wound you can still pick out from LEO."
	},
	{
		id: "reef",
		name: "Great Barrier Reef",
		region: "Queensland, Australia",
		lat: -18.2871,
		lon: 147.6992,
		kind: "wild",
		blurb: "The largest living structure on the planet, a two-thousand-kilometre pale shallows off Queensland."
	},
	{
		id: "reykjavik",
		name: "Reykjavík",
		region: "Iceland",
		lat: 64.1466,
		lon: -21.9426,
		kind: "city",
		blurb: "The world’s northernmost capital, sitting on a mid-ocean ridge that is still pulling apart."
	},
	{
		id: "mcmurdo",
		name: "McMurdo Station",
		region: "Antarctica",
		lat: -77.8419,
		lon: 166.6863,
		kind: "science",
		blurb: "The logistical heart of the Antarctic program, on Ross Island under six months of night or day."
	},
	{
		id: "mauna-kea",
		name: "Mauna Kea",
		region: "Hawaiʻi, USA",
		lat: 19.8207,
		lon: -155.4681,
		kind: "science",
		blurb: "A shield volcano that is also one of the darkest, driest observatory sites on Earth."
	},
	{
		id: "petra",
		name: "Petra",
		region: "Jordan",
		lat: 30.3285,
		lon: 35.4444,
		kind: "landmark",
		blurb: "A Nabataean capital carved from red sandstone at the edge of Wadi Araba."
	},
	{
		id: "venice",
		name: "Venice",
		region: "Italy",
		lat: 45.4408,
		lon: 12.3155,
		kind: "landmark",
		blurb: "A city poured into a lagoon — canals as streets, and a tide that keeps rewriting the plan."
	},
	{
		id: "serengeti",
		name: "Serengeti",
		region: "Tanzania",
		lat: -2.3333,
		lon: 34.8333,
		kind: "wild",
		blurb: "An open savanna on the south-east of the Nile basin, still a corridor for the great migration."
	}
];
var KIND_LABEL = {
	city: "City",
	landmark: "Landmark",
	science: "Science",
	wild: "Terrain"
};
var _v = new Vector3();
var _o = new Object3D();
var _up = new Vector3(0, 1, 0);
var _q = new Quaternion();
var fireBase = new Color("#d9895f");
var fireHot = new Color("#f0c4a0");
var fireTmp = new Color();
var airColor = new Color("#7eb8a4");
var satColor = new Color("#d5dce8");
function glowTexture() {
	const c = document.createElement("canvas");
	c.width = c.height = 64;
	const g = c.getContext("2d");
	if (!g) return new CanvasTexture(c);
	const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grd.addColorStop(0, "rgba(255,255,255,1)");
	grd.addColorStop(.22, "rgba(255,255,255,0.45)");
	grd.addColorStop(.55, "rgba(255,255,255,0.08)");
	grd.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = grd;
	g.fillRect(0, 0, 64, 64);
	const tex = new CanvasTexture(c);
	tex.needsUpdate = true;
	return tex;
}
function PlaceMarker({ loc, glow }) {
	const active = useGlobeStore((s) => s.selection?.id === loc.id);
	const selectPlace = useGlobeStore((s) => s.selectPlace);
	const pos = (0, import_react.useMemo)(() => {
		const p = latLonToVec3(loc.lat, loc.lon, 1.014);
		return [
			p.x,
			p.y,
			p.z
		];
	}, [loc.lat, loc.lon]);
	const look = (0, import_react.useMemo)(() => {
		const p = latLonToVec3(loc.lat, loc.lon, 1.4);
		return [
			p.x,
			p.y,
			p.z
		];
	}, [loc.lat, loc.lon]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: pos,
			onClick: (e) => {
				e.stopPropagation();
				selectPlace(loc);
			},
			onPointerOver: (e) => {
				e.stopPropagation();
				document.body.style.cursor = "pointer";
			},
			onPointerOut: () => {
				document.body.style.cursor = "";
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				active ? .013 : .009,
				16,
				16
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: active ? "#f4f6fa" : "#8eb4c9",
				toneMapped: false
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sprite", {
			position: pos,
			scale: active ? .09 : .055,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("spriteMaterial", {
				map: glow,
				color: active ? "#f4f6fa" : "#8eb4c9",
				blending: 2,
				depthWrite: false,
				transparent: true,
				opacity: active ? .95 : .7,
				toneMapped: false
			})
		}),
		active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: pos,
			lookAt: look,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
				.018,
				.023,
				32
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: "#e8eaef",
				side: 2,
				transparent: true,
				opacity: .85,
				toneMapped: false
			})]
		}) : null
	] });
}
function PlaceMarkers() {
	const visible = useGlobeStore((s) => s.layers.places);
	const glow = (0, import_react.useMemo)(() => glowTexture(), []);
	if (!visible) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", { children: FEATURED_LOCATIONS.map((loc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceMarker, {
		loc,
		glow
	}, loc.id)) });
}
function FireLayer({ points }) {
	const visible = useGlobeStore((s) => s.layers.fires);
	const mesh = (0, import_react.useRef)(null);
	const selectMarker = useGlobeStore((s) => s.selectMarker);
	const count = points.length;
	(0, import_react.useEffect)(() => {
		const m = mesh.current;
		if (!m || !count) return;
		for (let i = 0; i < count; i++) {
			const p = points[i];
			if (!p) continue;
			const s = .0032 + Math.min(p.frp, 80) / 9e3;
			latLonToVec3(p.lat, p.lon, 1.006, _v);
			_o.position.copy(_v);
			_q.setFromUnitVectors(_up, _v.normalize());
			_o.quaternion.copy(_q);
			_o.scale.setScalar(s);
			_o.updateMatrix();
			m.setMatrixAt(i, _o.matrix);
			const t = Math.min(p.frp / 60, 1);
			fireTmp.lerpColors(fireBase, fireHot, t);
			m.setColorAt(i, fireTmp);
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [points, count]);
	if (!visible || count === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
		ref: mesh,
		args: [
			void 0,
			void 0,
			count
		],
		onClick: (e) => {
			e.stopPropagation();
			const i = e.instanceId ?? -1;
			const p = points[i];
			if (!p) return;
			selectMarker({
				type: "fire",
				id: `fire-${i}`,
				name: "Thermal anomaly",
				lat: p.lat,
				lon: p.lon,
				detail: `VIIRS hotspot · FRP ${p.frp.toFixed(1)} MW${p.date ? ` · ${p.date}` : ""}`
			});
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			1,
			6,
			6
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
			color: "#d9895f",
			toneMapped: false,
			transparent: true,
			opacity: .92
		})]
	});
}
function AircraftLayer({ points }) {
	const visible = useGlobeStore((s) => s.layers.aircraft);
	const mesh = (0, import_react.useRef)(null);
	const selectMarker = useGlobeStore((s) => s.selectMarker);
	const count = points.length;
	(0, import_react.useEffect)(() => {
		const m = mesh.current;
		if (!m || !count) return;
		for (let i = 0; i < count; i++) {
			const p = points[i];
			if (!p) continue;
			const r = altitudeToRadius((p.alt || 1e4) / 1e3);
			latLonToVec3(p.lat, p.lon, r, _v);
			_o.position.copy(_v);
			_q.setFromUnitVectors(_up, _v.normalize());
			_o.quaternion.copy(_q);
			_o.scale.set(.0042, .0095, .0042);
			_o.updateMatrix();
			m.setMatrixAt(i, _o.matrix);
		}
		m.instanceMatrix.needsUpdate = true;
	}, [points, count]);
	if (!visible || count === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
		ref: mesh,
		args: [
			void 0,
			void 0,
			count
		],
		onClick: (e) => {
			e.stopPropagation();
			const i = e.instanceId ?? -1;
			const p = points[i];
			if (!p) return;
			const alt = p.alt ? `${Math.round(p.alt)} m` : "alt unknown";
			const spd = p.velocity ? `${Math.round(p.velocity * 1.94384)} kt` : "";
			selectMarker({
				type: "aircraft",
				id: p.icao || `ac-${i}`,
				name: p.callsign || p.icao || "Aircraft",
				lat: p.lat,
				lon: p.lon,
				detail: [
					p.country,
					alt,
					spd
				].filter(Boolean).join(" · ")
			});
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("coneGeometry", { args: [
			1,
			1,
			5
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
			color: airColor,
			toneMapped: false
		})]
	});
}
function SatelliteLayer({ tles }) {
	const visible = useGlobeStore((s) => s.layers.satellites);
	const mesh = (0, import_react.useRef)(null);
	const selectMarker = useGlobeStore((s) => s.selectMarker);
	const tracked = (0, import_react.useMemo)(() => {
		const out = [];
		for (const t of tles) try {
			out.push({
				id: t.id,
				name: t.name,
				kind: t.kind,
				rec: twoline2satrec(t.line1, t.line2)
			});
		} catch {}
		return out;
	}, [tles]);
	const positions = (0, import_react.useRef)([]);
	useFrame(() => {
		if (!visible || !mesh.current || tracked.length === 0) return;
		const now = /* @__PURE__ */ new Date();
		const gmst = gstime(now);
		for (let i = 0; i < tracked.length; i++) {
			const sat = tracked[i];
			if (!sat) continue;
			const position = propagate(sat.rec, now)?.position;
			if (!position || typeof position === "boolean") continue;
			const gd = eciToGeodetic(position, gmst);
			const lat = degreesLat(gd.latitude);
			const lon = degreesLong(gd.longitude);
			const alt = gd.height;
			positions.current[i] = {
				lat,
				lon,
				alt
			};
			latLonToVec3(lat, lon, altitudeToRadius(alt), _v);
			_o.position.copy(_v);
			_o.scale.setScalar(.011);
			_o.quaternion.identity();
			_o.updateMatrix();
			mesh.current.setMatrixAt(i, _o.matrix);
		}
		mesh.current.instanceMatrix.needsUpdate = true;
	});
	if (!visible || tracked.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
		ref: mesh,
		args: [
			void 0,
			void 0,
			tracked.length
		],
		onClick: (e) => {
			e.stopPropagation();
			const i = e.instanceId ?? -1;
			const sat = tracked[i];
			const p = positions.current[i];
			if (!sat || !p) return;
			selectMarker({
				type: "satellite",
				id: String(sat.id),
				name: sat.name,
				lat: p.lat,
				lon: p.lon,
				detail: `${sat.kind} · NORAD ${sat.id} · ${Math.round(p.alt)} km`
			});
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			1,
			12,
			12
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
			color: satColor,
			toneMapped: false
		})]
	});
}
async function getJson(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url} ${res.status}`);
	return await res.json();
}
function useFires() {
	return useQuery({
		queryKey: ["firms"],
		queryFn: () => getJson("/api/firms"),
		refetchInterval: 48e4,
		staleTime: 3e5
	});
}
function useAircraft() {
	return useQuery({
		queryKey: ["aircraft"],
		queryFn: () => getJson("/api/aircraft"),
		refetchInterval: 3e4,
		staleTime: 2e4
	});
}
function useSatellites() {
	return useQuery({
		queryKey: ["satellites"],
		queryFn: () => getJson("/api/satellites"),
		refetchInterval: 9e4,
		staleTime: 6e4
	});
}
function Lights() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			intensity: .18,
			color: "#9aa6bb"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hemisphereLight", { args: [
			"#8aa4c4",
			"#07080c",
			.38
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				6,
				2.2,
				3
			],
			intensity: 1.35,
			color: "#fff4e8"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				-4,
				-1.4,
				-3
			],
			intensity: .18,
			color: "#6e88aa"
		})
	] });
}
function LiveLayers() {
	const fires = useFires();
	const aircraft = useAircraft();
	const sats = useSatellites();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FireLayer, { points: fires.data?.points ?? [] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AircraftLayer, { points: aircraft.data?.points ?? [] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SatelliteLayer, { tles: sats.data?.tles ?? [] })
	] });
}
function GlobeCanvas() {
	const clearSelection = useGlobeStore((s) => s.clearSelection);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Canvas, {
		className: "h-full w-full touch-none",
		camera: {
			position: [
				.35,
				.55,
				2.55
			],
			fov: 42,
			near: .1,
			far: 160
		},
		dpr: [1, 1.6],
		gl: {
			antialias: true,
			alpha: false,
			powerPreference: "high-performance",
			toneMapping: 4,
			toneMappingExposure: 1.08
		},
		onCreated: ({ gl }) => {
			gl.setClearColor(new Color("#05060a"));
		},
		onPointerMissed: () => clearSelection(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Suspense, {
			fallback: null,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lights, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceMarkers, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveLayers, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Starfield, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraRig, {})
			]
		})
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var LAYERS = [
	{
		id: "places",
		label: "Places",
		icon: MapPin,
		swatch: "bg-accent"
	},
	{
		id: "fires",
		label: "Fires",
		icon: Flame,
		swatch: "bg-fire"
	},
	{
		id: "aircraft",
		label: "Flights",
		icon: Plane,
		swatch: "bg-air"
	},
	{
		id: "satellites",
		label: "Sats",
		icon: Satellite,
		swatch: "bg-sat"
	}
];
function Hud() {
	const look = useGlobeStore((s) => s.look);
	const layers = useGlobeStore((s) => s.layers);
	const toggleLayer = useGlobeStore((s) => s.toggleLayer);
	const autoRotate = useGlobeStore((s) => s.autoRotate);
	const setAutoRotate = useGlobeStore((s) => s.setAutoRotate);
	const listOpen = useGlobeStore((s) => s.listOpen);
	const setListOpen = useGlobeStore((s) => s.setListOpen);
	const search = useGlobeStore((s) => s.search);
	const setSearch = useGlobeStore((s) => s.setSearch);
	const selection = useGlobeStore((s) => s.selection);
	const selectPlace = useGlobeStore((s) => s.selectPlace);
	const clearSelection = useGlobeStore((s) => s.clearSelection);
	const fires = useFires();
	const aircraft = useAircraft();
	const sats = useSatellites();
	const [clock, setClock] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
	(0, import_react.useEffect)(() => {
		const t = window.setInterval(() => setClock(/* @__PURE__ */ new Date()), 1e3);
		return () => window.clearInterval(t);
	}, []);
	(0, import_react.useEffect)(() => {
		setListOpen(window.innerWidth >= 900);
		const onKey = (e) => {
			if (e.key === "Escape") {
				clearSelection();
				if (window.innerWidth < 900) setListOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [clearSelection, setListOpen]);
	const filtered = (0, import_react.useMemo)(() => {
		const q = search.trim().toLowerCase();
		if (!q) return FEATURED_LOCATIONS;
		return FEATURED_LOCATIONS.filter((l) => l.name.toLowerCase().includes(q) || l.region.toLowerCase().includes(q) || l.kind.toLowerCase().includes(q));
	}, [search]);
	const counts = {
		places: FEATURED_LOCATIONS.length,
		fires: fires.data?.meta.count ?? 0,
		aircraft: aircraft.data?.meta.count ?? 0,
		satellites: sats.data?.meta.count ?? 0
	};
	const utc = clock.toISOString().slice(11, 19);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-10 text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgb(5_6_10_/_0.55)_100%)]" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-auto absolute top-0 left-0 right-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs tracking-[0.28em] text-muted uppercase",
							children: "Live observatory"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-sans text-2xl font-medium tracking-tight text-fg text-balance sm:text-3xl",
							children: "Orbital"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 font-mono text-xs tabular-nums text-faint",
							children: [
								utc,
								" UTC · ",
								formatCoord(look.lat, look.lon)
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap justify-end gap-1.5",
						children: LAYERS.map((layer) => {
							const on = layers[layer.id];
							const Icon = layer.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => toggleLayer(layer.id),
								"aria-pressed": on,
								className: cn("flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-medium", "border shadow-[var(--shadow-border)]", "transition-[opacity,background-color,border-color,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)]", "active:scale-[0.96]", on ? "border-border-strong bg-surface-2 text-fg" : "border-transparent bg-surface/70 text-muted"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", layer.swatch, !on && "opacity-40") }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
										className: "size-3.5",
										strokeWidth: 1.75
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "hidden sm:inline",
										children: layer.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono tabular-nums text-faint",
										children: counts[layer.id]
									})
								]
							}, layer.id);
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setAutoRotate(!autoRotate),
						"aria-pressed": autoRotate,
						className: cn("flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-medium", "border shadow-[var(--shadow-border)] bg-surface/80", "transition-[opacity,background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)]", autoRotate ? "border-border-strong text-fg" : "border-transparent text-muted"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
								className: "size-3.5",
								strokeWidth: 1.75
							}),
							"Auto-rotate ",
							autoRotate ? "on" : "off"
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setListOpen(!listOpen),
				className: cn("pointer-events-auto absolute right-4 top-auto min-h-11 rounded-full border bg-surface/90 px-4 text-sm font-medium shadow-[var(--shadow-border)]", "bottom-[max(5.5rem,env(safe-area-inset-bottom))]", "transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] active:scale-[0.96]", "sm:hidden", listOpen && "opacity-0 pointer-events-none"),
				children: "Locations"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: cn("pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-[22rem] flex-col p-4 pt-28 sm:p-5 sm:pt-28", "transition-[transform,opacity] duration-[var(--motion-slow)] ease-[var(--ease-smooth-out)]", listOpen ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0 pointer-events-none"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-1 flex-col rounded-xl bg-surface/90 p-2 shadow-[var(--shadow-border)] backdrop-blur-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2 px-3 pt-3 pb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-[0.6875rem] tracking-[0.22em] text-muted uppercase",
								children: "Featured"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium text-fg",
								children: "Locations"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setListOpen(false),
								className: "flex size-11 items-center justify-center rounded-lg text-muted hover:text-fg sm:hidden",
								"aria-label": "Close locations",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mx-2 mb-2 flex min-h-11 items-center gap-2 rounded-lg bg-bg px-3 shadow-[var(--shadow-border)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
								className: "size-3.5 text-faint",
								strokeWidth: 1.75
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: search,
								onChange: (e) => setSearch(e.target.value),
								placeholder: "Search the Earth",
								className: "w-full bg-transparent text-sm text-fg outline-none placeholder:text-faint"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 pb-2",
							children: [filtered.map((loc) => {
								const active = selection?.id === loc.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => selectPlace(loc),
									className: cn("flex w-full min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left", "transition-[background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)]", active ? "bg-surface-2" : "hover:bg-surface-2/60"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 shrink-0 rounded-full", active ? "bg-accent" : "bg-faint") }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block truncate text-sm text-fg",
												children: loc.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "block truncate font-mono text-[0.6875rem] text-muted",
												children: [
													KIND_LABEL[loc.kind],
													" · ",
													loc.region
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-faint" })
									]
								}) }, loc.id);
							}), filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "px-3 py-6 text-center text-sm text-muted",
								children: "No matching places."
							}) : null]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none flex flex-wrap items-end justify-between gap-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedStatus, {
						fires: fires.data?.meta.status,
						flights: aircraft.data?.meta.status,
						sats: sats.data?.meta.status
					})
				}), selection ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: cn("pointer-events-auto mx-auto w-full max-w-lg rounded-xl bg-surface/92 p-4 shadow-[var(--shadow-border)] backdrop-blur-sm", "sm:mr-[min(22rem,32vw)] sm:ml-0 sm:max-w-md"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-mono text-[0.6875rem] tracking-[0.2em] text-muted uppercase",
										children: selection.type
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "mt-0.5 text-lg font-medium tracking-tight text-fg text-balance",
										children: selection.name
									}),
									"region" in selection && selection.region ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: selection.region
									}) : null
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: clearSelection,
								className: "flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-fg",
								"aria-label": "Clear selection",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-pretty text-muted",
							children: selection.detail
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 font-mono text-xs tabular-nums text-faint",
							children: formatCoord(selection.lat, selection.lon)
						})
					]
				}) : null]
			})
		]
	});
}
function FeedStatus({ fires, flights, sats }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-auto flex items-center gap-3 rounded-full bg-surface/80 px-3 py-2 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
				className: "size-3.5 text-muted",
				strokeWidth: 1.75
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
				label: "FIRMS",
				status: fires
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
				label: "OpenSky",
				status: flights
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
				label: "N2YO",
				status: sats
			})
		]
	});
}
function StatusDot({ label, status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-wide text-muted",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", status === "ok" ? "bg-air" : status === "degraded" ? "bg-fire" : status ? "bg-faint" : "bg-faint/50") }), label]
	});
}
var queryClient = new QueryClient({ defaultOptions: { queries: {
	refetchOnWindowFocus: false,
	retry: 1,
	staleTime: 2e4
} } });
function Home() {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setReady(true), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "relative h-dvh w-full overflow-hidden bg-bg text-fg",
			children: [
				ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlobeCanvas, {}) : null,
				!ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BootScreen, {}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {})
			]
		})
	});
}
function BootScreen() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-20 flex items-center justify-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs tracking-[0.28em] text-muted uppercase",
					children: "Acquiring lock"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 font-sans text-xl font-medium tracking-tight text-fg",
					children: "Orbital"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto mt-5 h-px w-28 overflow-hidden bg-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full w-1/2 bg-accent animate-pulse" })
				})
			]
		})
	});
}
//#endregion
export { Home as component };
