<script lang="ts">
	import { untrack } from 'svelte';
	import { AlertDialog, AlertDialogContent } from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import Camera from '@lucide/svelte/icons/camera';
	import type { User } from '$lib/types/db';
	import { fetchWithTimeout } from '$lib/utils/network';
	import { toast } from 'svelte-sonner';
	import { t } from 'svelte-i18n';
	import { get } from 'svelte/store';

	let {
		open = $bindable(false),
		user,
		onupdated
	}: {
		open: boolean;
		user: User;
		onupdated?: (updated: User) => void;
	} = $props();

	let loading = $state(false);
	let saving = $state(false);
	let uploading = $state(false);
	let displayName = $state('');
	let avatarUrl = $state<string | null>(null);
	let originalDisplayName = $state('');
	let originalAvatarUrl = $state<string | null>(null);

	const avatarInputId = `profile-avatar-${Math.random().toString(36).slice(2)}`;
	const trimmedDisplayName = $derived(displayName.trim());
	const fallbackName = $derived(trimmedDisplayName || user?.email || 'U');
	const avatarSrc = $derived(
		avatarUrl ?? `/api/avatar?name=${encodeURIComponent(fallbackName)}&background=random`
	);
	const isDirty = $derived(
		trimmedDisplayName !== originalDisplayName.trim() || avatarUrl !== originalAvatarUrl
	);

	async function loadProfile() {
		if (!user) return;
		loading = true;
		try {
			const res = await fetchWithTimeout('/api/profile', { timeout: 10000, retries: 1 });
			if (res.ok) {
				const data = (await res.json()) as {
					displayName?: string | null;
					avatarUrl?: string | null;
				};
				displayName = data.displayName ?? '';
				avatarUrl = data.avatarUrl ?? null;
			} else {
				displayName = user.displayName ?? '';
				avatarUrl = user.avatarUrl ?? null;
			}
		} catch {
			displayName = user.displayName ?? '';
			avatarUrl = user.avatarUrl ?? null;
		} finally {
			originalDisplayName = displayName;
			originalAvatarUrl = avatarUrl;
			loading = false;
		}
	}

	async function saveProfile() {
		if (saving) return;
		saving = true;
		try {
			const res = await fetchWithTimeout('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
					avatarUrl
				}),
				timeout: 15000
			});
			if (!res.ok) {
				throw new Error('profile.update_failed');
			}
			const updated = (await res.json()) as User;
			onupdated?.(updated);
			originalDisplayName = updated.displayName ?? '';
			originalAvatarUrl = updated.avatarUrl ?? null;
			toast.success(get(t)('profile.updated'));
			open = false;
		} catch (e) {
			const message = e instanceof Error ? e.message : 'profile.update_failed';
			toast.error(get(t)(message));
		} finally {
			saving = false;
		}
	}

	async function handleAvatarChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement | null;
		const file = input?.files?.[0];
		if (!file || uploading) return;
		uploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetchWithTimeout('/api/profile/avatar', {
				method: 'POST',
				body: formData,
				timeout: 20000
			});
			if (!res.ok) {
				throw new Error('upload.failed');
			}
			const data = (await res.json()) as { avatarUrl?: string };
			if (!data.avatarUrl) {
				throw new Error('upload.invalid_response');
			}
			avatarUrl = data.avatarUrl;
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.failed';
			toast.error(get(t)(message));
		} finally {
			if (input) input.value = '';
			uploading = false;
		}
	}

	$effect(() => {
		if (open) {
			untrack(() => loadProfile());
		}
	});
</script>

<AlertDialog bind:open>
	<AlertDialogContent>
		<div class="flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold select-none">{$t('profile.title')}</h3>
				<Button
					variant="ghost"
					size="icon"
					class="size-8"
					onclick={() => (open = false)}
					aria-label={$t('common.close')}
				>
					<XIcon class="size-5" />
				</Button>
			</div>

			{#if loading}
				<div class="flex h-40 items-center justify-center">
					<Spinner class="size-8 border-2" />
				</div>
			{:else}
				<div class="flex flex-col gap-6">
					<div class="flex flex-col items-center gap-4">
						<div class="group relative">
							<img
								src={avatarSrc}
								alt={fallbackName}
								width={96}
								height={96}
								class="rounded-pill size-24 object-cover"
							/>
							<label
								for={avatarInputId}
								class="rounded-pill absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
								aria-label={$t('profile.change_avatar')}
							>
								{#if uploading}
									<Spinner class="size-5 border-2 text-white" />
								{:else}
									<Camera class="size-6 text-white" />
								{/if}
							</label>
							<input
								id={avatarInputId}
								type="file"
								accept="image/png,image/jpeg,image/webp"
								class="hidden"
								onchange={handleAvatarChange}
							/>
						</div>
					</div>

					<div class="flex flex-col gap-3">
						<div class="flex flex-col gap-2">
							<Label for="profile-display-name">{$t('profile.display_name')}</Label>
							<Input
								id="profile-display-name"
								class="input-xl"
								bind:value={displayName}
								placeholder={$t('profile.display_name_placeholder')}
								maxlength={40}
							/>
						</div>
						<p class="text-muted-foreground text-xs">
							{$t('profile.description')}
						</p>
					</div>

					<div class="flex justify-end gap-3">
						<Button variant="outline" class="btn-xl" onclick={() => (open = false)}>
							{$t('common.cancel')}
						</Button>
						<Button class="btn-xl gap-2" disabled={!isDirty || saving} onclick={saveProfile}>
							{#if saving}
								<Spinner class="size-4 border-2" />
							{/if}
							{$t('profile.save')}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</AlertDialogContent>
</AlertDialog>
