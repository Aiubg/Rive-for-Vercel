<script lang="ts">
	import AuthForm from '$lib/components/auth-form.svelte';
	import SubmitButton from '$lib/components/submit-button.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from 'svelte-i18n';
	import type { FormData as AuthFormData } from '$lib/components/auth-form.svelte';
	import Logo from '$lib/components/ui/logo/logo.svelte';

	let { form }: { form: AuthFormData } = $props();

	const isSignUp = $derived(page.params.authType === 'signup');
	const signInSignUp = $derived(isSignUp ? $t('auth.sign_up') : $t('auth.sign_in'));
</script>

<div class="relative flex min-h-dvh w-screen items-center justify-center overflow-hidden">
	<div class="absolute inset-x-0 top-0 z-10 p-2">
		<div class="flex h-10 flex-row items-center justify-between">
			<a
				href={resolve('/')}
				class="ui-focus-ring ui-focus-ring-sidebar text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-control inline-flex shrink-0 items-center justify-center transition-colors outline-none select-none"
				aria-label={$t('common.go_to_home')}
			>
				<Logo size={30} color="currentColor" class="p-1" />
			</a>
		</div>
	</div>
	<div class="relative flex w-full max-w-md flex-col gap-7 px-5 py-7 sm:px-8 sm:py-8">
		<div class="flex flex-col items-center justify-center gap-2 text-center select-none">
			<h3 class="text-foreground text-2xl font-semibold tracking-tight">{signInSignUp}</h3>
			<p class="text-muted-foreground text-sm leading-relaxed">
				{$t('auth.auth_description', { values: { action: signInSignUp.toLowerCase() } })}
			</p>
		</div>
		<AuthForm {form}>
			{#snippet submitButton({ pending, success })}
				<SubmitButton {pending} {success}>{signInSignUp}</SubmitButton>
			{/snippet}

			{#if isSignUp}
				{@render switchAuthType({
					question: $t('auth.already_have_account'),
					href: '/signin',
					cta: $t('auth.sign_in_cta'),
					postscript: $t('auth.instead', { default: '' })
				})}
			{:else}
				{@render switchAuthType({
					question: $t('auth.dont_have_account'),
					href: '/signup',
					cta: $t('auth.sign_up_cta'),
					postscript: $t('auth.for_free', { default: '' })
				})}
			{/if}
		</AuthForm>
	</div>
</div>

{#snippet switchAuthType({
	question,
	href,
	cta,
	postscript
}: {
	question: string;
	href: string;
	cta: string;
	postscript: string;
})}
	<p class="text-muted-foreground mt-5 text-center text-sm select-none">
		{question}
		<a
			href={resolve('/(auth)/[authType=authType]', {
				authType: href === '/signin' ? 'signin' : 'signup'
			})}
			class="text-primary hover:text-foreground font-semibold transition-colors hover:underline"
		>
			{cta}
		</a>
		{postscript}
	</p>
{/snippet}
