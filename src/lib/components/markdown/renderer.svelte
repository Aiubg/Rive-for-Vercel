<script lang="ts">
	import Markdown from 'svelte-exmarkdown';
	import type { Plugin } from 'svelte-exmarkdown';
	import { gfmPlugin } from 'svelte-exmarkdown/gfm';
	import remarkBreaks from 'remark-breaks';
	import type { Pluggable } from 'unified';
	import { cn } from '$lib/utils/shadcn';
	import CodePre from '$lib/components/markdown/code-pre.svelte';
	import { markdownNeedsHighlight, markdownNeedsMath } from '$lib/utils/markdown';
	import { logger } from '$lib/utils/logger';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import type { CitationSource } from '$lib/utils/citations';

	let {
		md,
		streaming = false,
		citations = []
	}: {
		md: string;
		streaming?: boolean;
		citations?: CitationSource[];
	} = $props();

	const normalizeMathDelimiters = (value: string) =>
		value
			// block math: \[ ... \] -> $$\n...\n$$
			// Keep it on standalone lines so remark-math treats it as flow math (katex-display).
			.replace(/\\\[((?:.|\r|\n)+?)\\\]/g, (_, inner) => `\n$$\n${inner.trim()}\n$$\n`)
			// inline math: \( ... \) -> $ ... $
			.replace(/\\\((.+?)\\\)/g, (_, inner) => `$${inner}$`);

	const content = $derived(md ? normalizeMathDelimiters(md) : '');
	const citationMap = $derived.by(() => {
		const map: Record<number, CitationSource> = {};
		for (const citation of citations) {
			map[citation.id] = citation;
		}
		return map;
	});

	let plugins = $state<Plugin[]>([gfmPlugin(), { remarkPlugin: remarkBreaks as Pluggable }]);
	let pluginVersion = 0;
	let previousNeedsHighlight: boolean | null = null;
	let previousNeedsMath: boolean | null = null;

	function resolveCitation(href: unknown): CitationSource | null {
		if (typeof href !== 'string') return null;
		if (!href.startsWith('cite:')) return null;
		const id = Number(href.slice(5));
		if (!Number.isFinite(id)) return null;
		return citationMap[Math.trunc(id)] ?? null;
	}

	function isCitationHref(href: unknown): boolean {
		return typeof href === 'string' && href.startsWith('cite:');
	}

	const COMMON_SECOND_LEVEL_LABELS = new Set(['ac', 'co', 'com', 'edu', 'gov', 'net', 'org']);

	function toSourceLabel(hostname: string): string {
		const cleaned = hostname.replace(/^www\./i, '').toLowerCase();
		const parts = cleaned.split('.').filter(Boolean);
		if (parts.length === 0) return '';
		if (parts.length === 1) return parts[0] ?? '';

		const tld = parts[parts.length - 1] ?? '';
		const secondLevel = parts[parts.length - 2] ?? '';

		if (tld.length === 2 && COMMON_SECOND_LEVEL_LABELS.has(secondLevel) && parts.length >= 3) {
			return parts[parts.length - 3] ?? secondLevel;
		}

		return secondLevel;
	}

	function parseCitationMeta(url: string | undefined) {
		if (!url) return { hostname: '', faviconUrl: '', sourceLabel: '' };
		try {
			const hostname = new URL(url).hostname;
			return {
				hostname,
				faviconUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
				sourceLabel: toSourceLabel(hostname)
			};
		} catch {
			const hostCandidate = url.replace(/^[a-z]+:\/\//i, '').split('/')[0] ?? '';
			return {
				hostname: hostCandidate || url,
				faviconUrl: '',
				sourceLabel: toSourceLabel(hostCandidate)
			};
		}
	}

	function formatPublishedAt(value: string | undefined): string {
		if (!value) return '';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '';
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(parsed);
	}

	function handleFaviconError(event: Event) {
		const target = event.currentTarget as HTMLImageElement | null;
		if (target) {
			target.style.display = 'none';
		}
	}

	$effect(() => {
		const current = content;
		const needsHighlight = markdownNeedsHighlight(current);
		const needsMath = markdownNeedsMath(current);
		const shouldRefreshPlugins =
			previousNeedsHighlight !== needsHighlight || previousNeedsMath !== needsMath;

		if (!shouldRefreshPlugins) {
			return;
		}

		previousNeedsHighlight = needsHighlight;
		previousNeedsMath = needsMath;
		const version = ++pluginVersion;

		void (async () => {
			const next: Plugin[] = [gfmPlugin(), { remarkPlugin: remarkBreaks as Pluggable }];

			if (needsMath) {
				const [{ default: remarkMath }, { default: rehypeKatex }] = await Promise.all([
					import('remark-math'),
					import('rehype-katex')
				]);
				await import('katex/dist/katex.min.css');
				next.push({ remarkPlugin: remarkMath as Pluggable });
				next.push({
					rehypePlugin: [rehypeKatex, { output: 'html', strict: false, trust: false }] as Pluggable
				});
			}

			if (needsHighlight) {
				try {
					const [{ default: rehypeHighlight }, { common }, { mermaid }] = await Promise.all([
						import('rehype-highlight'),
						import('lowlight'),
						import('$lib/utils/highlight-mermaid')
					]);
					const highlightLanguages = { ...common, mermaid };
					next.push({
						rehypePlugin: [
							rehypeHighlight,
							{
								detect: true,
								// Do not auto-detect as mermaid to avoid false positives in plain code blocks.
								subset: Object.keys(common),
								languages: highlightLanguages
							}
						] as Pluggable
					});
				} catch (e) {
					logger.error('Failed to load highlight plugins', e);
				}
			}

			if (pluginVersion === version) {
				plugins = next;
			}
		})();
	});
</script>

<div class="markdown-body" data-streaming={streaming ? 'true' : 'false'}>
	<Markdown md={content} {plugins}>
		{#snippet table(props)}
			{@const { children, ...rest } = props}
			<div class="markdown-table-wrap my-5 w-full overflow-x-auto">
				<table {...rest} class={cn('markdown-table w-full border-collapse text-sm', rest.class)}>
					{@render children?.()}
				</table>
			</div>
		{/snippet}
		{#snippet thead(props)}
			{@const { children, ...rest } = props}
			<thead {...rest} class={cn('markdown-table-head', rest.class)}>
				{@render children?.()}
			</thead>
		{/snippet}
		{#snippet tbody(props)}
			{@const { children, ...rest } = props}
			<tbody {...rest} class={cn('markdown-table-body', rest.class)}>
				{@render children?.()}
			</tbody>
		{/snippet}
		{#snippet tr(props)}
			{@const { children, ...rest } = props}
			<tr {...rest} class={cn('markdown-table-row m-0 p-0', rest.class)}>
				{@render children?.()}
			</tr>
		{/snippet}
		{#snippet th(props)}
			{@const { children, ...rest } = props}
			<th
				{...rest}
				class={cn(
					'markdown-table-th text-start font-semibold [[align=center]]:text-center [[align=right]]:text-right',
					rest.class
				)}
			>
				{@render children?.()}
			</th>
		{/snippet}
		{#snippet td(props)}
			{@const { children, ...rest } = props}
			<td
				{...rest}
				class={cn(
					'markdown-table-td text-start [[align=center]]:text-center [[align=right]]:text-right',
					rest.class
				)}
			>
				{@render children?.()}
			</td>
		{/snippet}
		{#snippet ol(props)}
			{@const { children, ...rest } = props}
			<ol
				{...rest}
				class={cn(
					'my-3 ms-6 list-decimal space-y-2 not-first:mt-4 marker:text-current',
					rest.class
				)}
			>
				{@render children?.()}
			</ol>
		{/snippet}
		{#snippet ul(props)}
			{@const { children, ...rest } = props}
			<ul
				{...rest}
				class={cn('my-3 ms-6 list-disc space-y-2 not-first:mt-4 marker:text-current', rest.class)}
			>
				{@render children?.()}
			</ul>
		{/snippet}
		{#snippet li(props)}
			{@const { children, ...rest } = props}
			<li {...rest} class={cn('leading-7 wrap-break-word', rest.class)}>
				{@render children?.()}
			</li>
		{/snippet}

		{#snippet strong(props)}
			{@const { children, ...rest } = props}
			<span {...rest} class={cn('font-semibold wrap-break-word', rest.class)}>
				{@render children?.()}
			</span>
		{/snippet}
		{#snippet a(props)}
			{@const { children, href, class: className, ...rest } = props}
			{@const citation = resolveCitation(href)}
			{#if citation}
				{@const { hostname, faviconUrl, sourceLabel } = parseCitationMeta(citation.url)}
				{@const publishedAt = formatPublishedAt(citation.publishedAt)}
				<Tooltip>
					<TooltipTrigger>
						{#snippet child({ props: triggerProps })}
							<a
								{...rest}
								{...triggerProps}
								href={citation.url}
								class={cn('citation-pill', typeof className === 'string' ? className : '')}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Source ${sourceLabel || citation.id}: ${citation.title}`}
							>
								{sourceLabel || citation.id}
							</a>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent class="citation-card w-74 p-3" side="top" sideOffset={8}>
						<div class="space-y-2">
							<p class="text-foreground line-clamp-2 text-sm leading-snug">{citation.title}</p>
							{#if citation.snippet}
								<p class="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
									{citation.snippet}
								</p>
							{/if}
							<div class="text-muted-foreground flex items-center gap-2 text-xs">
								{#if faviconUrl}
									<img
										src={faviconUrl}
										alt=""
										class="rounded-inline h-4 w-4"
										onerror={handleFaviconError}
									/>
								{/if}
								{#if hostname}
									<span class="max-w-40 truncate">{hostname}</span>
								{/if}
								{#if publishedAt}
									<span aria-hidden="true">|</span>
									<span>{publishedAt}</span>
								{/if}
							</div>
						</div>
					</TooltipContent>
				</Tooltip>
			{:else if isCitationHref(href)}
				{@const fallbackCitationId =
					typeof href === 'string' ? href.slice('cite:'.length).trim() : ''}
				<span class="text-muted-foreground align-baseline text-xs font-normal">
					{fallbackCitationId}
				</span>
			{:else}
				<a
					{...rest}
					href={typeof href === 'string' ? href : undefined}
					class={cn(
						'text-primary hover:text-primary/85 font-medium wrap-break-word underline decoration-from-font underline-offset-3 transition-colors',
						typeof className === 'string' ? className : ''
					)}
					target="_blank"
					rel="noopener noreferrer"
				>
					{@render children?.()}
				</a>
			{/if}
		{/snippet}

		{#snippet h1(props)}
			{@const { children, ...rest } = props}
			<h1
				{...rest}
				class={cn(
					'mt-6 mb-3 scroll-m-20 text-2xl font-semibold tracking-tight text-balance wrap-break-word first:mt-0',
					rest.class
				)}
			>
				{@render children?.()}
			</h1>
		{/snippet}
		{#snippet h2(props)}
			{@const { children, ...rest } = props}
			<h2
				{...rest}
				class={cn(
					'mt-5 mb-3 scroll-m-20 text-xl font-semibold tracking-tight wrap-break-word first:mt-0',
					rest.class
				)}
			>
				{@render children?.()}
			</h2>
		{/snippet}
		{#snippet h3(props)}
			{@const { children, ...rest } = props}
			<h3
				{...rest}
				class={cn(
					'mt-4 mb-2 scroll-m-20 text-lg font-semibold tracking-tight wrap-break-word',
					rest.class
				)}
			>
				{@render children?.()}
			</h3>
		{/snippet}
		{#snippet h4(props)}
			{@const { children, ...rest } = props}
			<h4
				{...rest}
				class={cn(
					'mt-3 mb-2 scroll-m-20 text-base font-semibold tracking-tight wrap-break-word',
					rest.class
				)}
			>
				{@render children?.()}
			</h4>
		{/snippet}
		{#snippet h5(props)}
			{@const { children, ...rest } = props}
			<h5
				{...rest}
				class={cn(
					'mt-3 mb-1 scroll-m-20 text-sm font-semibold tracking-tight wrap-break-word',
					rest.class
				)}
			>
				{@render children?.()}
			</h5>
		{/snippet}
		{#snippet h6(props)}
			{@const { children, ...rest } = props}
			<h6
				{...rest}
				class={cn(
					'mt-2 mb-1 scroll-m-20 text-xs font-semibold tracking-tight wrap-break-word',
					rest.class
				)}
			>
				{@render children?.()}
			</h6>
		{/snippet}
		{#snippet p(props)}
			{@const { children, ...rest } = props}
			<p {...rest} class={cn('mb-4 leading-7 wrap-break-word last:mb-0', rest.class)}>
				{@render children?.()}
			</p>
		{/snippet}
		{#snippet blockquote(props)}
			{@const { children, ...rest } = props}
			<blockquote
				{...rest}
				class={cn(
					'markdown-blockquote bg-muted/45 text-foreground/90 my-4 rounded-md py-2 ps-4 pe-3 wrap-break-word',
					rest.class
				)}
			>
				{@render children?.()}
			</blockquote>
		{/snippet}
		{#snippet hr(props)}
			{@const { ...rest } = props}
			<hr {...rest} class={cn('border-border/70 my-6 border-0 border-t', rest.class)} />
		{/snippet}
		{#snippet pre(props)}
			{@const { children, class: className, ...rest } = props}
			<CodePre {...rest} class={typeof className === 'string' ? className : ''} {streaming}>
				{@render children?.()}
			</CodePre>
		{/snippet}
		{#snippet code(props)}
			{@const { children, class: c, ...rest } = props}
			{@const inline = 'inline' in props ? (props as { inline: boolean }).inline : false}
			{#if inline}
				<code class={cn('markdown-code-inline', c)} {...rest}>
					{@render children?.()}
				</code>
			{:else}
				<code class={cn('font-mono', c)} {...rest}>{@render children?.()}</code>
			{/if}
		{/snippet}
		{#snippet img(props)}
			{@const { src, alt, title, ...rest } = props}
			<figure class="markdown-img-figure">
				<img
					{src}
					{alt}
					title={title || alt}
					{...rest}
					class={cn('markdown-img', rest.class)}
					loading="lazy"
				/>
				{#if title || alt}
					<figcaption class="markdown-img-caption">
						{title || alt}
					</figcaption>
				{/if}
			</figure>
		{/snippet}
	</Markdown>
</div>
