import { SynchronizedCookie } from '$lib/hooks/synchronized-cookie.svelte';

export class SelectedModel extends SynchronizedCookie {
	constructor(value: string) {
		super('selected-model', value);
	}

	static override fromContext(): SelectedModel {
		return super.fromContext('selected-model');
	}
}
