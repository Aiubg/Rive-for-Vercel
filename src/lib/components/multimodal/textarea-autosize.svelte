<script lang="ts">
	import * as InputGroup from '$lib/components/ui/input-group';
	import { innerHeight } from 'svelte/reactivity/window';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils/shadcn';
	import type { ComponentProps } from 'svelte';
	import { computeTextareaAutosizeLayout } from '$lib/components/multimodal/textarea-autosize-layout';

	type TextareaProps = ComponentProps<typeof InputGroup.Textarea>;
	let {
		value = $bindable(''),
		class: c,
		ref = $bindable(null),
		placeholder,
		autofocus = false,
		maxHeight = 400,
		minHeight = 60,
		minLines,
		...restProps
	}: TextareaProps & { maxHeight?: number; minHeight?: number; minLines?: number } = $props();

	let rafId: number | null = null;
	let resolvedMinHeight = $state(60);

	$effect(() => {
		if (!(ref instanceof HTMLTextAreaElement)) {
			resolvedMinHeight = minHeight;
		}
	});

	function resolveLineHeight(style: CSSStyleDeclaration) {
		const lineHeight = Number.parseFloat(style.lineHeight);
		if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
		const fontSize = Number.parseFloat(style.fontSize);
		if (Number.isFinite(fontSize) && fontSize > 0) return fontSize * 1.2;
		return 19.2;
	}

	function resolveMinHeight(style: CSSStyleDeclaration) {
		if (typeof minLines === 'number' && Number.isFinite(minLines) && minLines > 0) {
			const lineHeight = resolveLineHeight(style);
			const paddingTop = Number.parseFloat(style.paddingTop) || 0;
			const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
			const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
			const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;

			let height = lineHeight * minLines + paddingTop + paddingBottom;
			if (style.boxSizing === 'border-box') {
				height += borderTop + borderBottom;
			}
			return Math.ceil(height);
		}

		return minHeight;
	}

	function adjustHeight() {
		if (!(ref instanceof HTMLTextAreaElement)) return;

		ref.style.height = 'auto';
		const style = getComputedStyle(ref);
		const minHeightPx = resolveMinHeight(style);
		const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
		const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
		const extraHeight = style.boxSizing === 'border-box' ? borderTop + borderBottom : 0;
		resolvedMinHeight = minHeightPx;
		const { height, overflowY, stickToBottom } = computeTextareaAutosizeLayout({
			scrollHeight: ref.scrollHeight,
			viewportInnerHeight: innerHeight.current,
			maxHeight,
			minHeight: minHeightPx,
			extraHeight
		});

		ref.style.height = `${height}px`;
		ref.style.overflowY = overflowY;
		if (stickToBottom) {
			ref.scrollTop = ref.scrollHeight;
		}
	}

	function scheduleAdjustHeight() {
		if (typeof requestAnimationFrame !== 'function') {
			adjustHeight();
			return;
		}
		if (rafId !== null) return;
		rafId = requestAnimationFrame(() => {
			rafId = null;
			adjustHeight();
		});
	}

	onMount(() => {
		scheduleAdjustHeight();
		if (autofocus && ref instanceof HTMLTextAreaElement) {
			ref.focus();
		}
	});
	$effect(() => {
		if (!(ref instanceof HTMLTextAreaElement)) return;

		const el = ref;
		const handle = () => scheduleAdjustHeight();
		el.addEventListener('input', handle);
		el.addEventListener('paste', handle);
		el.addEventListener('cut', handle);
		el.addEventListener('compositionend', handle);
		return () => {
			el.removeEventListener('input', handle);
			el.removeEventListener('paste', handle);
			el.removeEventListener('cut', handle);
			el.removeEventListener('compositionend', handle);
		};
	});
	$effect(() => {
		if (value !== undefined) {
			scheduleAdjustHeight();
		}
	});
	$effect(() => {
		void minHeight;
		void minLines;
		void maxHeight;
		scheduleAdjustHeight();
	});
	$effect(() => {
		const viewportInnerHeight = innerHeight.current;
		void viewportInnerHeight;
		scheduleAdjustHeight();
	});
</script>

<InputGroup.Textarea
	bind:ref
	bind:value
	{placeholder}
	{...restProps}
	class={cn(
		'rounded-square shadow-flat resize-none border-0 bg-transparent pt-3 pb-0 text-base ring-0 focus:outline-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none',
		c
	)}
	style={`min-height: ${resolvedMinHeight}px; max-height: ${maxHeight}px; unicode-bidi: plaintext; text-align: start;`}
	rows={typeof minLines === 'number' && Number.isFinite(minLines) && minLines > 0
		? Math.max(1, Math.round(minLines))
		: 1}
/>
