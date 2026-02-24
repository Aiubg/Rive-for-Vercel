<script module lang="ts">
	export type FormSuccessData = {
		success: true;
	};
	export type FormFailureData = {
		success: false;
		message: string;
		email?: string;
	};
	export type FormData = FormSuccessData | FormFailureData;

	export type AuthFormProps = {
		form?: FormData;
		submitButton: Snippet<[{ pending: boolean; success: boolean }]>;
		children: Snippet;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Eye, EyeOff } from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { t } from 'svelte-i18n';

	let { form, submitButton, children }: AuthFormProps = $props();

	let pending = $state(false);
	let showPassword = $state(false);
	const enhanceCallback: SubmitFunction<FormSuccessData, FormFailureData> = () => {
		pending = true;
		return async ({ result, update }) => {
			if (result.type === 'failure' && result.data?.message) {
				toast.error($t(result.data.message), { duration: 5000 });
			}
			pending = false;
			return update();
		};
	};

	const defaultValue = $derived.by(() => {
		if (!form?.success && form?.email) {
			return form.email;
		}
		return undefined;
	});
</script>

<form method="POST" class="flex flex-col gap-5" use:enhance={enhanceCallback}>
	<div class="flex flex-col gap-2">
		<Label for="email" class="text-muted-foreground text-xs font-medium tracking-wide">
			{$t('auth.email')}
		</Label>

		<Input
			id="email"
			name="email"
			class="bg-background/70 rounded-surface shadow-surface h-11 px-4 text-base md:text-sm"
			type="email"
			placeholder={$t('auth.email_placeholder')}
			autocomplete="email"
			required
			autofocus
			{defaultValue}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<Label for="password" class="text-muted-foreground text-xs font-medium tracking-wide">
			{$t('auth.password')}
		</Label>

		<div class="relative">
			<Input
				id="password"
				name="password"
				class="bg-background/70 rounded-surface shadow-surface h-11 px-4 pe-11 text-base md:text-sm"
				type={showPassword ? 'text' : 'password'}
				required
			/>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				class="text-muted-foreground hover:text-foreground absolute end-0 top-0 h-full px-3 hover:bg-transparent"
				onclick={() => (showPassword = !showPassword)}
				aria-label={showPassword ? $t('auth.hide_password') : $t('auth.show_password')}
			>
				{#if showPassword}
					<EyeOff class="size-4" />
				{:else}
					<Eye class="size-4" />
				{/if}
				<span class="sr-only">
					{showPassword ? $t('auth.hide_password') : $t('auth.show_password')}
				</span>
			</Button>
		</div>
	</div>

	{@render submitButton({ pending, success: !!form?.success })}
	{@render children()}
</form>
