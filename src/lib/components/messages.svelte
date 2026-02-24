<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import Info from '@lucide/svelte/icons/info';
	import PreviewMessage from '$lib/components/messages/preview-message.svelte';
	import ThinkingMessage from '$lib/components/messages/thinking-message.svelte';
	import MessageOutline from '$lib/components/messages/message-outline.svelte';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/state';
	import type { UIMessageWithTree } from '$lib/types/message';
	import { computeMessagesWithSiblings } from '$lib/utils/chat';

	let containerRef = $state<HTMLDivElement | null>(null);
	let contentRef = $state<HTMLDivElement | null>(null);
	let endRef = $state<HTMLDivElement | null>(null);

	let {
		readonly,
		loading,
		isStreaming = false,
		messages,
		allMessages = [],
		messagesWithSiblings: messagesWithSiblingsProp,
		onregenerate,
		onedit,
		onswitchbranch
	}: {
		readonly: boolean;
		loading: boolean;
		isStreaming?: boolean;
		messages: UIMessageWithTree[];
		allMessages?: UIMessageWithTree[];
		messagesWithSiblings?: Array<{
			message: UIMessageWithTree;
			siblings: string[];
			currentIndex: number;
		}>;
		onregenerate?: (payload: { message: UIMessageWithTree }) => void;
		onedit?: (payload: { message: UIMessageWithTree; text: string }) => void;
		onswitchbranch?: (parentId: string, messageId: string) => void;
	} = $props();

	const messagesWithSiblings = $derived.by(() => {
		if (messagesWithSiblingsProp) return messagesWithSiblingsProp;
		return computeMessagesWithSiblings(allMessages, messages);
	});

	let isAtBottom = $state(true);
	let messagesInitialized = false;
	let enableIntro = $state(false);
	let autoScrollEnabled = $state(true);
	let lastHighlightHash = $state<string | null>(null);
	let activeMessageId = $state<string | null>(null);

	let lastUserMessageId = $state<string | null>(null);

	const lastMessage = $derived(messages.at(-1));
	const lastUserMessage = $derived.by(() => {
		for (let i = messages.length - 1; i >= 0; i -= 1) {
			const message = messages[i];
			if (message?.role === 'user') {
				return message;
			}
		}
		return null;
	});
	const streamingAssistantId = $derived(
		isStreaming && lastMessage?.role === 'assistant' ? lastMessage.id : null
	);
	const introMessageId = $derived.by(() => (enableIntro ? (lastMessage?.id ?? null) : null));

	const BOTTOM_EPSILON_PX = 8;
	const NAV_SCROLL_OFFSET_PX = 8;
	const SCROLL_RETRY_FRAMES = 3;
	const noop = (_?: unknown) => {};
	const WINDOW_MIN = 80;
	const WINDOW_STEP = 40;
	const TOP_LOAD_THRESHOLD_PX = 48;
	let renderWindowSize = $state(WINDOW_MIN);
	let activeUpdateScheduled = $state(false);

	const showThinking = $derived(
		loading &&
			(!lastMessage ||
				lastMessage.role === 'user' ||
				(lastMessage.role === 'assistant' && (lastMessage.parts?.length ?? 0) === 0))
	);

	onMount(() => {
		enableIntro = true;
		if (containerRef && messages.length > 0) {
			containerRef.scrollTop = containerRef.scrollHeight;
		}
		lastUserMessageId = lastUserMessage?.id ?? null;
		updateIsAtBottom();
		messagesInitialized = true;

		if (containerRef && contentRef) {
			let resizeRafId = 0;
			const observer = new ResizeObserver(() => {
				if (!autoScrollEnabled || !containerRef) return;
				if (resizeRafId) {
					cancelAnimationFrame(resizeRafId);
				}
				resizeRafId = requestAnimationFrame(() => {
					resizeRafId = 0;
					if (!autoScrollEnabled || !containerRef) return;
					const targetTop = containerRef.scrollHeight - containerRef.clientHeight;
					if (Math.abs(containerRef.scrollTop - targetTop) > 1) {
						containerRef.scrollTop = targetTop;
					}
					updateIsAtBottom();
				});
			});
			observer.observe(contentRef);
			observer.observe(containerRef);
			return () => {
				if (resizeRafId) {
					cancelAnimationFrame(resizeRafId);
				}
				observer.disconnect();
			};
		}
	});

	function raf() {
		return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}

	function clampScrollTop(top: number) {
		if (!containerRef) return top;
		const maxTop = Math.max(0, containerRef.scrollHeight - containerRef.clientHeight);
		return Math.min(Math.max(0, top), maxTop);
	}

	function getMessageElement(messageId: string) {
		const element = document.getElementById('msg-' + messageId);
		if (!(element instanceof HTMLElement)) return null;
		return element;
	}

	function computeMessageTop(messageId: string, offset = 0) {
		if (!containerRef) return null;
		const element = getMessageElement(messageId);
		if (!element) return null;
		const containerRect = containerRef.getBoundingClientRect();
		const elementRect = element.getBoundingClientRect();
		const rawTop = containerRef.scrollTop + (elementRect.top - containerRect.top) - offset;
		return clampScrollTop(rawTop);
	}

	function scrollToMessage(
		messageId: string,
		{
			behavior = 'auto',
			offset = NAV_SCROLL_OFFSET_PX
		}: { behavior?: ScrollBehavior; offset?: number } = {}
	) {
		if (!containerRef) return false;
		const top = computeMessageTop(messageId, offset);
		if (top === null) return false;
		containerRef.scrollTo({ top, behavior });
		return true;
	}

	async function settleScrollToMessage(
		messageId: string,
		{
			behavior = 'auto',
			retries = SCROLL_RETRY_FRAMES
		}: { behavior?: ScrollBehavior; retries?: number } = {}
	) {
		for (let i = 0; i <= retries; i += 1) {
			const ok = scrollToMessage(messageId, { behavior: i === 0 ? behavior : 'auto' });
			if (!ok) return false;
			await raf();
		}
		return true;
	}

	async function scrollToBottom(behavior: ScrollBehavior = 'auto') {
		if (!containerRef) return;
		autoScrollEnabled = true;
		await tick();
		const targetTop = containerRef.scrollHeight - containerRef.clientHeight;
		containerRef.scrollTo({ top: targetTop, behavior });

		// Use requestAnimationFrame for a more immediate follow-up if needed,
		// instead of a 100ms timeout which causes visible jumps
		requestAnimationFrame(() => {
			if (containerRef && autoScrollEnabled) {
				const finalTop = containerRef.scrollHeight - containerRef.clientHeight;
				if (Math.abs(containerRef.scrollTop - finalTop) > 1) {
					containerRef.scrollTop = finalTop;
					updateIsAtBottom();
				}
			}
		});
	}

	function updateIsAtBottom() {
		if (!containerRef) return;
		const { scrollTop, scrollHeight, clientHeight } = containerRef;
		const distanceToBottom = scrollHeight - clientHeight - scrollTop;
		isAtBottom = distanceToBottom <= BOTTOM_EPSILON_PX;
		return distanceToBottom;
	}

	function updateActiveMessage() {
		if (activeUpdateScheduled) return;
		activeUpdateScheduled = true;
		requestAnimationFrame(() => {
			if (!containerRef) {
				activeUpdateScheduled = false;
				return;
			}
			const elements = containerRef.querySelectorAll('[id^="msg-"]');
			const containerRect = containerRef.getBoundingClientRect();
			const scrollThreshold = containerRect.top + 40;

			let currentActiveId = activeMessageId;
			for (let i = 0; i < elements.length; i++) {
				const el = elements[i];
				if (!(el instanceof HTMLElement)) continue;
				const rect = el.getBoundingClientRect();
				if (rect.top <= scrollThreshold) {
					currentActiveId = el.id.replace('msg-', '');
				} else {
					break;
				}
			}

			if (currentActiveId !== activeMessageId) {
				activeMessageId = currentActiveId;
			}
			activeUpdateScheduled = false;
		});
	}

	function handleScroll(event: Event) {
		const distanceToBottom = updateIsAtBottom();
		if (distanceToBottom === undefined) return;
		if (event.isTrusted) {
			autoScrollEnabled = distanceToBottom <= BOTTOM_EPSILON_PX;
		}
		if (containerRef && containerRef.scrollTop <= TOP_LOAD_THRESHOLD_PX) {
			const total = messagesWithSiblings.length;
			if (total > renderWindowSize) {
				renderWindowSize = Math.min(total, renderWindowSize + WINDOW_STEP);
			}
		}
		updateActiveMessage();
	}

	function handleScrollToBottom() {
		void scrollToBottom('smooth');
	}

	$effect(() => {
		if (!(containerRef && endRef)) return;
		if (!messagesInitialized) return;

		const last = lastMessage;
		if (!last) return;

		const lastUser = lastUserMessage;
		if (lastUser && lastUser.id !== lastUserMessageId) {
			lastUserMessageId = lastUser.id;
			void scrollToBottom('auto');
			return;
		}

		if (autoScrollEnabled && isAtBottom && (loading || last?.role === 'assistant')) {
			untrack(() => {
				if (containerRef) {
					const targetTop = containerRef.scrollHeight - containerRef.clientHeight;
					if (Math.abs(containerRef.scrollTop - targetTop) > 1) {
						containerRef.scrollTop = targetTop;
					}
					updateIsAtBottom();
				}
			});
		}
	});

	$effect(() => {
		void messages.length;
		void loading;
		if (!containerRef) return;

		tick().then(() => {
			updateIsAtBottom();
		});
	});

	$effect(() => {
		const total = messagesWithSiblings.length;
		if (total === 0) {
			renderWindowSize = WINDOW_MIN;
			return;
		}
		// Only increase renderWindowSize, don't shrink it during active session to prevent flicker
		if (total > renderWindowSize) {
			if (total - renderWindowSize < WINDOW_STEP) {
				renderWindowSize = total;
			}
		}
		if (renderWindowSize > total + WINDOW_STEP) {
			renderWindowSize = total;
		}
	});

	$effect(() => {
		const hash = page.url.hash.replace('#', '');
		if (!hash || hash === lastHighlightHash) return;
		if (messages.length === 0) return;

		// Ensure the target message is within the rendered window
		const targetIndex = messages.findIndex((m) => m.id === hash);
		if (targetIndex !== -1) {
			const neededSize = messages.length - targetIndex;
			if (neededSize > renderWindowSize) {
				renderWindowSize = neededSize;
			}
		}

		void (async () => {
			await tick();
			const scrolled = await settleScrollToMessage(hash, { behavior: 'auto' });
			if (!scrolled) return;

			// Reset window scroll position to prevent blank blocks caused by browser's default hash scrolling.
			if (window.scrollY !== 0) {
				window.scrollTo(0, 0);
			}

			lastHighlightHash = hash;
		})();
	});

	const renderStartIndex = $derived(Math.max(0, messagesWithSiblings.length - renderWindowSize));
	const renderedMessagesWithSiblings = $derived(messagesWithSiblings.slice(renderStartIndex));

	$effect(() => {
		if (!containerRef || renderedMessagesWithSiblings.length === 0) return;

		// Initial update
		updateActiveMessage();
	});

	function handleNavigate(id: string) {
		void settleScrollToMessage(id, { behavior: 'auto' });
	}

	function handleSwitchVersion(
		index: number,
		siblings: string[],
		parentId: string | null | undefined
	) {
		const targetId = siblings[index];
		if (!targetId) return;
		onswitchbranch?.(parentId || 'root', targetId);
	}
</script>

<div class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
	<div
		bind:this={containerRef}
		class="scrollbar-stable flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
		onscroll={handleScroll}
	>
		<div
			bind:this={contentRef}
			class="mx-auto flex w-full max-w-210 flex-col px-8 pt-4 pb-8 md:px-12"
		>
			{#if readonly}
				<div
					class="text-muted-foreground flex items-center justify-center gap-2 py-2 text-sm whitespace-nowrap"
				>
					<Info size={16} class="shrink-0" />
					<span>{$t('share.read_only_view')}</span>
				</div>
			{/if}

			{#each renderedMessagesWithSiblings as { message, siblings, currentIndex } (message.id)}
				<div class="overflow-anchor-none">
					<PreviewMessage
						{message}
						{readonly}
						{loading}
						messageLoading={loading && streamingAssistantId === message.id}
						enableIntro={enableIntro && message.id === introMessageId}
						totalVersions={siblings.length}
						{currentIndex}
						onregenerate={onregenerate ?? noop}
						onedit={onedit ?? noop}
						onswitchversion={(idx) => handleSwitchVersion(idx, siblings, message.parentId)}
					/>
				</div>
			{/each}

			{#if showThinking}
				<div class="overflow-anchor-none">
					<ThinkingMessage />
				</div>
			{/if}

			<div bind:this={endRef} class="overflow-anchor-auto h-px w-full"></div>
		</div>
	</div>

	{#if messages.length > 0}
		<div class="absolute end-2 bottom-1/2 z-20 hidden translate-y-1/2 md:block">
			<MessageOutline {messages} {activeMessageId} onnavigate={handleNavigate} />
		</div>
	{/if}

	{#if !isAtBottom}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4"
			transition:fade={{ duration: 200 }}
		>
			<Button
				size="icon-sm"
				variant="outline"
				class="bg-background/80 rounded-pill shadow-raised pointer-events-auto backdrop-blur-sm focus:border-(--interactive-border-color)! focus-visible:border-(--interactive-border-color)!"
				onclick={handleScrollToBottom}
				aria-label={$t('common.next_message')}
			>
				<ArrowDownIcon size={14} />
			</Button>
		</div>
	{/if}
</div>
