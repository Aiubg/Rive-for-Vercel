<script lang="ts">
	import * as Empty from '$lib/components/ui/empty';
	import { Button } from '$lib/components/ui/button';
	import FileQuestionIcon from '@lucide/svelte/icons/file-question';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from 'svelte-i18n';
</script>

<Empty.State
	class="h-screen"
	icon={FileQuestionIcon}
	title={$t('error.not_found')}
	description={$t('error.not_found_description')}
>
	<Button variant="outline" onclick={() => goto(resolve('/'))}>{$t('error.back_to_home')}</Button>
</Empty.State>
