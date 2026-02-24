<script lang="ts">
	import PlayIcon from '@lucide/svelte/icons/play';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import DiscIcon from '@lucide/svelte/icons/disc-3';
	import { cn } from '$lib/utils/shadcn';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';

	type AudioPlayerProps = {
		audioUrl: string;
		title?: string;
		artist?: string;
		coverUrl?: string;
		sourceUrl?: string;
		duration?: string;
	};

	let {
		audioUrl,
		title,
		artist,
		coverUrl,
		sourceUrl,
		duration: durationLabel
	}: AudioPlayerProps = $props();

	let audio = $state<HTMLAudioElement>();
	let paused = $state(true);
	let isPlaying = $derived(!paused);
	let currentTime = $state(0);
	let duration = $state(0);
	let isError = $state(false);
	let rafId: number;

	function togglePlay() {
		if (!audio) return;
		if (audio.paused) {
			audio.play();
			startRaf();
		} else {
			audio.pause();
			cancelRaf();
		}
	}

	function startRaf() {
		cancelRaf();
		const loop = () => {
			if (audio && !audio.paused) {
				currentTime = audio.currentTime;
				rafId = requestAnimationFrame(loop);
			}
		};
		rafId = requestAnimationFrame(loop);
	}

	function cancelRaf() {
		if (rafId) cancelAnimationFrame(rafId);
	}

	function handleTimeUpdate() {
		if (audio && paused) currentTime = audio.currentTime;
	}

	function handleDurationChange() {
		if (audio) duration = audio.duration;
	}

	function handleEnded() {
		paused = true;
		currentTime = 0;
		cancelRaf();
	}

	function handleError() {
		isError = true;
		paused = true;
		cancelRaf();
	}

	onMount(() => {
		return () => cancelRaf();
	});

	function formatTime(seconds: number) {
		if (!seconds || isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function handleSeek(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const time = parseFloat(target.value);
		if (audio) {
			audio.currentTime = time;
			currentTime = time;
		}
	}
</script>

<div
	class="bg-background group relative w-full max-w-md overflow-hidden rounded-xl border shadow-sm transition-all select-none"
>
	<!-- Background Gradient/Blur -->
	{#if coverUrl}
		<div class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
			<img
				src={coverUrl}
				alt=""
				class="h-full w-full scale-150 object-cover opacity-50 blur-2xl dark:opacity-40"
			/>
			<div
				class="from-background/80 via-background/40 to-background/20 absolute inset-0 bg-linear-to-r"
			></div>
		</div>
	{/if}

	<div class="relative z-10 flex flex-col gap-3 p-4">
		<div class="flex gap-4">
			<!-- Cover -->
			<div
				class="border-border/50 bg-muted relative h-26 w-26 shrink-0 overflow-hidden rounded-lg border shadow-sm"
			>
				{#if coverUrl}
					<img src={coverUrl} alt={title} class="h-full w-full object-cover" loading="lazy" />
				{:else}
					<div
						class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center"
					>
						<DiscIcon size={48} class="opacity-50" />
					</div>
				{/if}
			</div>

			<!-- Right Side Info & Controls -->
			<div class="flex min-w-0 flex-1 flex-col justify-between py-1">
				<div class="flex flex-col gap-1">
					<h3
						class="text-foreground line-clamp-1 text-base leading-tight font-semibold tracking-tight"
						{title}
					>
						{title || $t('chat.music_player')}
					</h3>
					<p class="text-muted-foreground line-clamp-1 text-sm" title={artist}>
						{artist || $t('chat.unknown_artist')}
					</p>
				</div>

				<div class="mt-2 flex items-center justify-between">
					<button
						class={cn(
							'bg-primary text-primary-foreground hover:bg-primary/90 flex h-9 w-9 items-center justify-center rounded-full shadow-sm  transition-all',
							isError && 'cursor-not-allowed opacity-50'
						)}
						onclick={togglePlay}
						disabled={isError}
						aria-label={isPlaying ? 'Pause' : 'Play'}
						type="button"
					>
						{#if isPlaying}
							<PauseIcon size={18} class="fill-current" />
						{:else}
							<PlayIcon size={18} class="ml-px fill-current" />
						{/if}
					</button>

					{#if sourceUrl}
						<a
							href={sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground/80 hover:text-primary text-xs transition-colors hover:underline"
						>
							{$t('chat.source')}
						</a>
					{/if}
				</div>
			</div>
		</div>

		<!-- Progress Bar -->
		<div class="flex flex-col gap-2 pt-1">
			<input
				type="range"
				min="0"
				max={duration || 100}
				value={currentTime}
				oninput={handleSeek}
				class="bg-foreground/10 accent-primary h-1 w-full cursor-pointer appearance-none rounded-full focus:ring-0 focus:outline-none"
				style="background-image: linear-gradient(to right, var(--primary) 0%, var(--primary) {(currentTime /
					(duration || 1)) *
					100}%, transparent {(currentTime / (duration || 1)) *
					100}%, transparent 100%); background-repeat: no-repeat;"
				disabled={!duration || isError}
			/>
			<div class="text-muted-foreground flex justify-between px-1 text-xs font-medium">
				<span>{formatTime(currentTime)}</span>
				<span>{formatTime(duration) || '0:00'}</span>
			</div>
		</div>
	</div>

	<audio
		bind:this={audio}
		src={audioUrl}
		bind:paused
		ontimeupdate={handleTimeUpdate}
		ondurationchange={handleDurationChange}
		onended={handleEnded}
		onerror={handleError}
		preload="none"
		class="hidden"
	></audio>
</div>

<style>
	/* Custom range slider styling */
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		height: 12px;
		width: 12px;
		border-radius: 50%;
		background: currentColor;
		margin-top: -4px;
		opacity: 1;
		border: none;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 9999px;
		border: none;
	}

	/* Firefox styles */
	input[type='range']::-moz-range-thumb {
		height: 12px;
		width: 12px;
		border-radius: 50%;
		background: currentColor;
		box-shadow: none;
		opacity: 1;
		border: none;
	}

	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 9999px;
		border: none;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 8px;
		border-radius: 9999px;
		border: none;
	}
</style>
