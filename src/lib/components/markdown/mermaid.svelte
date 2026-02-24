<script lang="ts">
	import { mode } from 'mode-watcher';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import { onDestroy, tick } from 'svelte';
	import { t } from 'svelte-i18n';
	import * as Empty from '$lib/components/ui/empty';
	import { logger } from '$lib/utils/logger';
	import { randomId } from '$lib/utils/misc';
	import type { MermaidConfig } from 'mermaid';

	let { code }: { code: string } = $props();

	type MermaidApi = {
		initialize: (config: MermaidConfig) => void;
		parse: (text: string) => unknown | Promise<unknown>;
		render: (id: string, text: string) => Promise<{ svg: string }>;
	};

	let mermaidInstance = $state<MermaidApi | null>(null);
	let svg = $state('');
	let dimensions = $state<{ width: number; height: number } | null>(null);
	let containerHeight = $state<number | null>(null);
	let error = $state<string | null>(null);

	let scale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let isDragging = $state(false);
	let startX = $state(0);
	let startY = $state(0);

	let viewerEl = $state<HTMLDivElement | null>(null);
	let wrapperEl = $state<HTMLDivElement | null>(null);

	const id = `mermaid-${randomId().slice(0, 9)}`;

	function getSvgDimensions(rawSvg: string): { width: number; height: number } | null {
		const match = rawSvg.match(/viewBox="([^"]*)"/);
		if (!match) return null;
		const viewBoxValue = match[1];
		if (!viewBoxValue) return null;
		const parts = viewBoxValue.trim().split(/\s+/);
		if (parts.length !== 4) return null;
		const width = Number(parts[2]);
		const height = Number(parts[3]);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			return null;
		}
		return { width, height };
	}

	function sanitizeSvgViewBox(rawSvg: string): string {
		const dimensions = getSvgDimensions(rawSvg);
		if (!dimensions) {
			const safeViewBox = `viewBox="0 0 1000 1000"`;
			return rawSvg.replace(/viewBox="[^"]*"/, safeViewBox);
		}
		return rawSvg;
	}

	function sanitizeMermaidSvg(rawSvg: string): string {
		if (typeof DOMParser === 'undefined') return rawSvg;
		const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
		const svgEl = doc.documentElement;
		if (!svgEl || svgEl.nodeName.toLowerCase() !== 'svg') return rawSvg;

		for (const el of Array.from(svgEl.querySelectorAll('script, iframe, object, embed'))) {
			el.remove();
		}

		const walker = doc.createTreeWalker(svgEl, NodeFilter.SHOW_ELEMENT);
		let current = walker.currentNode as Element | null;
		while (current) {
			for (const attr of Array.from(current.attributes)) {
				const name = attr.name.toLowerCase();
				const value = attr.value.trim().toLowerCase();

				if (name.startsWith('on')) {
					current.removeAttribute(attr.name);
					continue;
				}

				if (name === 'href' || name === 'xlink:href') {
					if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
						current.removeAttribute(attr.name);
					}
					continue;
				}

				if (name === 'style' && value.includes('url(')) {
					current.removeAttribute(attr.name);
				}
			}

			current = walker.nextNode() as Element | null;
		}

		return svgEl.outerHTML;
	}

	function downloadBlob(blob: Blob, filename: string) {
		if (typeof document === 'undefined') return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.rel = 'noopener';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function getExportSvg() {
		if (!svg || typeof DOMParser === 'undefined') return null;
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const svgEl = doc.documentElement;
		if (!svgEl || svgEl.nodeName.toLowerCase() !== 'svg') return null;

		const fallback = { width: 1000, height: 1000 };
		const rawDimensions = dimensions ?? getSvgDimensions(svg) ?? fallback;
		const width = Math.max(1, Math.round(rawDimensions.width));
		const height = Math.max(1, Math.round(rawDimensions.height));

		if (!svgEl.getAttribute('xmlns')) {
			svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		}
		if (!svgEl.getAttribute('width')) {
			svgEl.setAttribute('width', String(width));
		}
		if (!svgEl.getAttribute('height')) {
			svgEl.setAttribute('height', String(height));
		}
		if (!svgEl.getAttribute('viewBox')) {
			svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
		}

		return { svg: svgEl.outerHTML, width, height };
	}

	export function downloadSvg(filename = 'diagram.svg') {
		const payload = getExportSvg();
		if (!payload) return;
		const blob = new Blob([payload.svg], { type: 'image/svg+xml;charset=utf-8' });
		downloadBlob(blob, filename);
	}

	export async function downloadPng(filename = 'diagram.png', minScale = 3) {
		if (typeof window === 'undefined') return;
		const payload = getExportSvg();
		if (!payload) return;

		const { svg: svgString, width, height } = payload;
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);
		const img = new Image();
		img.decoding = 'async';

		const loaded = new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('Failed to load SVG'));
		});

		img.src = url;
		try {
			await loaded;
		} catch {
			URL.revokeObjectURL(url);
			return;
		}

		const ratio = Math.max(window.devicePixelRatio || 1, minScale);
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			URL.revokeObjectURL(url);
			return;
		}

		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.drawImage(img, 0, 0, width, height);
		URL.revokeObjectURL(url);

		canvas.toBlob((pngBlob) => {
			if (pngBlob) {
				downloadBlob(pngBlob, filename);
				return;
			}
			const dataUrl = canvas.toDataURL('image/png');
			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = filename;
			a.rel = 'noopener';
			a.click();
		}, 'image/png');
	}

	export function zoomIn() {
		scale = Math.min(scale + 0.2, 5);
	}

	export function zoomOut() {
		scale = Math.max(scale - 0.2, 0.1);
		if (scale >= 0.9 && scale <= 1.1) {
			scale = 1;
			translateX = 0;
			translateY = 0;
		}
	}

	export function resetZoom() {
		scale = 1;
		translateX = 0;
		translateY = 0;
	}

	function handleMouseDown(e: MouseEvent | TouchEvent) {
		isDragging = true;
		let clientX: number;
		let clientY: number;
		if ('touches' in e) {
			const touch = e.touches.item(0);
			if (!touch) return;
			clientX = touch.clientX;
			clientY = touch.clientY;
		} else {
			clientX = e.clientX;
			clientY = e.clientY;
		}
		startX = clientX - translateX;
		startY = clientY - translateY;

		if (!('touches' in e)) {
			window.addEventListener('mousemove', handleMouseMove as (ev: MouseEvent) => void);
			window.addEventListener('mouseup', handleMouseUp as (ev: MouseEvent) => void);
		} else {
			window.addEventListener('touchmove', handleMouseMove as (ev: TouchEvent) => void, {
				passive: false
			});
			window.addEventListener('touchend', handleMouseUp as (ev: TouchEvent) => void);
		}
	}

	function handleMouseMove(e: MouseEvent | TouchEvent) {
		if (!isDragging || !viewerEl || !wrapperEl) return;
		let clientX: number;
		let clientY: number;
		if ('touches' in e) {
			if (e.cancelable) e.preventDefault();
			const touch = e.touches.item(0);
			if (!touch) return;
			clientX = touch.clientX;
			clientY = touch.clientY;
		} else {
			clientX = e.clientX;
			clientY = e.clientY;
		}

		let nextX = clientX - startX;
		let nextY = clientY - startY;

		const viewerRect = viewerEl.getBoundingClientRect();
		const wrapperRect = wrapperEl.getBoundingClientRect();

		const contentWidth = wrapperRect.width;
		const contentHeight = wrapperRect.height;
		const viewerWidth = viewerRect.width;
		const viewerHeight = viewerRect.height;

		if (contentWidth <= viewerWidth) {
			const maxOffsetX = (viewerWidth - contentWidth) / 2;
			nextX = Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX));
		} else {
			const maxOffsetX = (contentWidth - viewerWidth) / 2;
			nextX = Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX));
		}

		if (contentHeight <= viewerHeight) {
			const maxOffsetY = (viewerHeight - contentHeight) / 2;
			nextY = Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY));
		} else {
			const maxOffsetY = (contentHeight - viewerHeight) / 2;
			nextY = Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY));
		}

		translateX = nextX;
		translateY = nextY;
	}

	function handleMouseUp() {
		isDragging = false;

		window.removeEventListener('mousemove', handleMouseMove as (ev: MouseEvent) => void);
		window.removeEventListener('mouseup', handleMouseUp as (ev: MouseEvent) => void);
		window.removeEventListener('touchmove', handleMouseMove as (ev: TouchEvent) => void);
		window.removeEventListener('touchend', handleMouseUp as (ev: TouchEvent) => void);
	}

	function handleDragStart(e: DragEvent) {
		e.preventDefault();
	}

	onDestroy(() => {
		if (debounceHandle) clearTimeout(debounceHandle);
		if (retryHandle) clearTimeout(retryHandle);
		if (loadHandle) clearTimeout(loadHandle);
		handleMouseUp();
	});

	let renderCount = 0;
	let lastTheme: 'dark' | 'default' | null = null;
	let debounceHandle: ReturnType<typeof setTimeout> | null = null;
	let loadHandle: ReturnType<typeof setTimeout> | null = null;
	let loadAttempt = 0;
	let isLoadingMermaid = false;

	async function loadMermaid() {
		if (mermaidInstance || isLoadingMermaid) return;
		isLoadingMermaid = true;
		try {
			const m = await import('mermaid');
			mermaidInstance = m.default ?? m;
			error = null;
			loadAttempt = 0;
		} catch (e) {
			loadAttempt += 1;
			if (loadAttempt >= 6) {
				logger.error('Failed to load mermaid', e);
				error = e instanceof Error ? e.message : String(e);
			} else {
				const delayMs = 200 * loadAttempt;
				loadHandle = setTimeout(() => {
					isLoadingMermaid = false;
					loadMermaid();
				}, delayMs);
				return;
			}
		} finally {
			isLoadingMermaid = false;
		}
	}

	$effect(() => {
		if (!mermaidInstance) {
			loadMermaid();
			return;
		}
		const isDark = mode.current === 'dark';
		const theme: 'dark' | 'default' = isDark ? 'dark' : 'default';
		if (lastTheme !== theme) {
			mermaidInstance.initialize({
				startOnLoad: false,
				theme,
				securityLevel: 'strict',
				fontFamily: 'inherit',
				flowchart: { useMaxWidth: false, htmlLabels: false },
				sequence: { useMaxWidth: false },
				gantt: { useMaxWidth: false },
				journey: { useMaxWidth: false },
				timeline: { useMaxWidth: false },
				class: { useMaxWidth: false },
				state: { useMaxWidth: false },
				er: { useMaxWidth: false }
			});
			lastTheme = theme;
		}
		if (debounceHandle) clearTimeout(debounceHandle);
		if (code?.trim()) {
			error = null;
		}
		debounceHandle = setTimeout(() => renderDiagram(code, theme), 150);
	});

	let isRendering = false;
	let pending: { content: string; theme: 'dark' | 'default' } | null = null;
	let lastContent: string | null = null;
	let lastRenderKey: string | null = null;
	let retryHandle: ReturnType<typeof setTimeout> | null = null;
	let lastAttemptKey: string | null = null;
	let attemptCount = 0;

	async function renderDiagram(content: string, theme: 'dark' | 'default') {
		if (!content?.trim() || !mermaidInstance) return;
		const renderKey = `${theme}::${content}`;
		if (lastRenderKey === renderKey) return;
		if (retryHandle) {
			clearTimeout(retryHandle);
			retryHandle = null;
		}
		if (isRendering) {
			pending = { content, theme };
			return;
		}
		if (lastAttemptKey !== renderKey) {
			lastAttemptKey = renderKey;
			attemptCount = 0;
		}

		const previousContent = lastContent;
		isRendering = true;
		let retryAfterMs: number | null = null;
		try {
			if (!svg) {
				await tick();
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			await mermaidInstance.parse(content);

			const renderId = `${id}-${++renderCount}`;
			const { svg: renderedSvg } = await mermaidInstance.render(renderId, content);
			dimensions = getSvgDimensions(renderedSvg);
			svg = sanitizeSvgViewBox(sanitizeMermaidSvg(renderedSvg));
			await tick();
			error = null;
			lastContent = content;
			lastRenderKey = renderKey;

			if (previousContent !== content) {
				if (dimensions && viewerEl) {
					const viewerRect = viewerEl.getBoundingClientRect();
					const viewerWidth = viewerRect.width || 800;
					const viewerHeight = 600; // Max height from max-h-150

					const padding = 32;
					const availableWidth = Math.max(viewerWidth - padding, 100);
					const availableHeight = Math.max(viewerHeight - padding, 100);

					const scaleX = availableWidth / dimensions.width;
					const scaleY = availableHeight / dimensions.height;

					// Fit to container, but don't exceed 1.0 (natural size)
					// and don't make it too tiny
					let initialScale = Math.min(scaleX, scaleY);
					initialScale = Math.min(Math.max(initialScale, 0.2), 1.0);

					scale = initialScale;
					containerHeight = Math.min(600, dimensions.height * initialScale + 40);
				} else {
					scale = 1;
					containerHeight = 600;
				}
				translateX = 0;
				translateY = 0;
			}
		} catch (e) {
			attemptCount += 1;
			if (attemptCount <= 3) {
				error = null;
				retryAfterMs = attemptCount === 1 ? 120 : attemptCount === 2 ? 300 : 700;
			} else if (!svg) {
				error = e instanceof Error ? e.message : String(e);
			}
		} finally {
			isRendering = false;
			if (pending) {
				const next = pending;
				pending = null;
				renderDiagram(next.content, next.theme);
			} else if (retryAfterMs != null) {
				retryHandle = setTimeout(() => {
					renderDiagram(content, theme);
				}, retryAfterMs);
			}
		}
	}
</script>

<div class="mermaid-container flex min-h-10 w-full justify-center overflow-hidden select-none">
	{#if error}
		<Empty.State class="min-h-75" title={$t('chat.render_failed')} icon={ImageOffIcon} />
	{:else if svg}
		<div
			bind:this={viewerEl}
			class="mermaid-viewer relative flex max-h-150 w-full touch-none items-center justify-center overflow-hidden"
			class:cursor-grabbing={isDragging}
			class:cursor-grab={!isDragging}
			style:height={containerHeight ? `${containerHeight}px` : 'auto'}
			onmousedown={handleMouseDown}
			ontouchstart={handleMouseDown}
			ondragstart={handleDragStart}
			role="presentation"
		>
			<div
				bind:this={wrapperEl}
				class="mermaid-transform-wrapper origin-center"
				style:transform="translate({translateX}px, {translateY}px) scale({scale})"
				style:transition={isDragging ? 'none' : 'transform 0.2s ease-out'}
			>
				{@html svg}
			</div>
		</div>
	{:else}
		<div class="flex-center p-8">
			<div
				class="border-primary rounded-pill h-8 w-8 animate-spin border-4 border-t-transparent"
			></div>
		</div>
	{/if}
</div>

<style>
	:global(.mermaid-container svg) {
		max-width: 100%;
		height: auto;
		background: transparent !important;
		color: var(--foreground);
	}

	.mermaid-transform-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
