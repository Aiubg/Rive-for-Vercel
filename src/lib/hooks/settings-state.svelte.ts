import { getContext, setContext } from 'svelte';

const contextKey = Symbol('SettingsState');

export class SettingsState {
	open = $state(false);
	shortcutsOpen = $state(false);

	toggle = () => {
		this.open = !this.open;
	};

	setOpen = (value: boolean) => {
		this.open = value;
	};

	setContext() {
		setContext(contextKey, this);
	}

	static fromContext(): SettingsState {
		return getContext(contextKey);
	}
}
