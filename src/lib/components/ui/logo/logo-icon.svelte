<script lang="ts">
	import { onMount } from 'svelte';

	type Rgba = {
		r: number;
		g: number;
		b: number;
		a: number;
	};
	type BackgroundResolution = {
		color: Rgba;
		hasSignal: boolean;
	};

	const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
	const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

	let {
		size = 24,
		color,
		class: className,
		...restProps
	}: {
		size?: number;
		color?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();

	let containerEl = $state<SVGSVGElement | null>(null);
	let autoResolvedColor = $state('rgb(255 255 255)');
	const resolvedColor = $derived.by(() => color?.trim() || autoResolvedColor);
	let colorProbeEl: HTMLSpanElement | null = null;

	function parseColorString(value: string): Rgba | null {
		const normalized = value.trim().toLowerCase();
		if (!normalized || normalized === 'transparent') return null;

		const match = normalized.match(/^rgba?\((.+)\)$/);
		if (!match) return null;
		const payload = match[1];
		if (!payload) return null;

		const source = payload.replace(/\//g, ' ');
		const parts = source.includes(',') ? source.split(',') : source.split(/\s+/);
		if (parts.length < 3) return null;
		const [rValue, gValue, bValue, aValue] = parts;
		if (!rValue || !gValue || !bValue) return null;

		const r = Number.parseFloat(rValue.trim());
		const g = Number.parseFloat(gValue.trim());
		const b = Number.parseFloat(bValue.trim());
		const a = aValue ? Number.parseFloat(aValue.trim()) : 1;
		if ([r, g, b, a].some((item) => Number.isNaN(item))) return null;

		return {
			r: Math.max(0, Math.min(255, r)),
			g: Math.max(0, Math.min(255, g)),
			b: Math.max(0, Math.min(255, b)),
			a: Math.max(0, Math.min(1, a))
		};
	}

	function ensureColorProbe(): HTMLSpanElement | null {
		if (typeof document === 'undefined') return null;
		if (colorProbeEl?.isConnected) return colorProbeEl;

		colorProbeEl = document.createElement('span');
		colorProbeEl.style.position = 'fixed';
		colorProbeEl.style.opacity = '0';
		colorProbeEl.style.pointerEvents = 'none';
		colorProbeEl.style.inset = '0';
		colorProbeEl.style.fontSize = '0';
		colorProbeEl.style.lineHeight = '0';
		document.body.appendChild(colorProbeEl);
		return colorProbeEl;
	}

	function resolveCssColor(input: string): Rgba | null {
		if (!input.trim()) return null;
		const probe = ensureColorProbe();
		if (!probe) return null;

		probe.style.color = '';
		probe.style.color = input;
		const computed = getComputedStyle(probe).color;
		return parseColorString(computed);
	}

	function alphaComposite(fg: Rgba, bg: Rgba): Rgba {
		const alpha = fg.a + bg.a * (1 - fg.a);
		if (alpha <= 0) {
			return { r: 0, g: 0, b: 0, a: 0 };
		}

		return {
			r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha,
			g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha,
			b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha,
			a: alpha
		};
	}

	function toLinear(channel: number): number {
		const value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	}

	function relativeLuminance(colorValue: Rgba): number {
		return (
			0.2126 * toLinear(colorValue.r) +
			0.7152 * toLinear(colorValue.g) +
			0.0722 * toLinear(colorValue.b)
		);
	}

	function contrastRatio(a: Rgba, b: Rgba): number {
		const l1 = relativeLuminance(a);
		const l2 = relativeLuminance(b);
		const light = Math.max(l1, l2);
		const dark = Math.min(l1, l2);
		return (light + 0.05) / (dark + 0.05);
	}

	function getDocumentBackground(): BackgroundResolution {
		if (typeof document === 'undefined') {
			return { color: WHITE, hasSignal: false };
		}

		const root = document.documentElement;
		const body = document.body;
		const rootColor = resolveCssColor(getComputedStyle(root).backgroundColor);
		const bodyColor = body ? resolveCssColor(getComputedStyle(body).backgroundColor) : null;

		if (bodyColor && bodyColor.a > 0) {
			return {
				color: rootColor ? alphaComposite(bodyColor, rootColor) : bodyColor,
				hasSignal: true
			};
		}
		if (rootColor && rootColor.a > 0) {
			return { color: rootColor, hasSignal: true };
		}
		return { color: WHITE, hasSignal: false };
	}

	function getEffectiveBackground(from: SVGSVGElement): BackgroundResolution {
		const layers: Rgba[] = [];
		let hasSignal = false;
		let node: Element | null = from.parentElement;
		while (node) {
			const parsed = resolveCssColor(getComputedStyle(node).backgroundColor);
			if (parsed && parsed.a > 0) {
				layers.push(parsed);
				hasSignal = true;
			}
			node = node.parentElement;
		}

		const documentBg = getDocumentBackground();
		if (documentBg.hasSignal) {
			hasSignal = true;
		}
		let resolved = documentBg.color;
		for (let index = layers.length - 1; index >= 0; index -= 1) {
			const layer = layers[index];
			if (!layer) continue;
			resolved = alphaComposite(layer, resolved);
		}
		return { color: resolved, hasSignal };
	}

	function pickAutoColor(from: SVGSVGElement): string {
		const { color: bg, hasSignal } = getEffectiveBackground(from);
		if (!hasSignal) {
			return document.documentElement.classList.contains('dark')
				? 'rgb(255 255 255)'
				: 'rgb(0 0 0)';
		}
		const whiteContrast = contrastRatio(WHITE, bg);
		const blackContrast = contrastRatio(BLACK, bg);
		return whiteContrast >= blackContrast ? 'rgb(255 255 255)' : 'rgb(0 0 0)';
	}

	function recomputeColor() {
		if (color?.trim()) return;
		if (!containerEl || typeof document === 'undefined') return;
		autoResolvedColor = pickAutoColor(containerEl);
	}

	function observeColorSources(observer: MutationObserver, from: SVGSVGElement) {
		let node: Element | null = from;
		while (node) {
			observer.observe(node, {
				attributes: true,
				attributeFilter: ['class', 'data-theme', 'style']
			});
			node = node.parentElement;
		}
	}

	$effect(() => {
		recomputeColor();
	});

	onMount(() => {
		recomputeColor();

		const observer = new MutationObserver(() => {
			recomputeColor();
		});
		if (containerEl) {
			observeColorSources(observer, containerEl);
		}

		const onResize = () => recomputeColor();
		window.addEventListener('resize', onResize);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', onResize);
			colorProbeEl?.remove();
			colorProbeEl = null;
		};
	});
</script>

<svg
	bind:this={containerEl}
	role="img"
	viewBox="0 0 24 24"
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	class={className}
	{...restProps}
>
	<path
		fill={resolvedColor}
		d="M11.994 3.43a3.372 3.372 0 0 1 3.37 3.369v2.199L9.628 5.689a4.261 4.261 0 0 0-.688-.32 3.351 3.351 0 0 1 3.053-1.94zm-4.498 2.6c.588 0 1.17.156 1.684.452l5.734 3.311-2.91 1.678-3.6-2.076a.46.46 0 0 0-.459 0L5.35 10.893c-.22.126-.428.27-.621.433a3.349 3.349 0 0 1-.155-3.61A3.385 3.385 0 0 1 7.496 6.03zm8.723.015a3.383 3.383 0 0 1 3.205 1.672 3.37 3.37 0 0 1-1.235 4.6l-5.736 3.308v-3.357l3.602-2.077a.459.459 0 0 0 .228-.398V6.799c0-.253-.021-.506-.064-.754zm-8.504 4.543v6.617c0 .254.021.505.066.754a3.4 3.4 0 0 1-.285.012 3.383 3.383 0 0 1-2.92-1.684 3.343 3.343 0 0 1-.338-2.555 3.342 3.342 0 0 1 1.57-2.044l1.907-1.1zm.908 0 2.912 1.68v4.152a.46.46 0 0 0 .23.396l2.594 1.498h.002c.22.127.45.235.688.32a3.35 3.35 0 0 1-3.055 1.938 3.373 3.373 0 0 1-3.371-3.367v-6.617zm10.647 2.088a3.347 3.347 0 0 1 .154 3.611 3.372 3.372 0 0 1-4.604 1.233l-1.908-1.1 5.738-3.309a4.31 4.31 0 0 0 .62-.435z"
	/>
</svg>
