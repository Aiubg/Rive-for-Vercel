import { on } from 'svelte/events';

type Serializer<T> = {
	toJSON: (value: T) => string;
	fromJSON: (text: string, fallback: T) => T;
};

/**
 * LocalStorage class provides a type-safe wrapper around the browser's localStorage.
 * It uses Svelte 5 runes for reactivity and supports cross-tab synchronization.
 */
export class LocalStorage<T> {
	#key: string;
	#defaultValue: T;
	#serializer: Serializer<T>;
	#value = $state<T>() as T;
	#unsubscribe: (() => void) | null = null;

	/**
	 * @param key The localStorage key.
	 * @param defaultValue The value to use if no value is stored.
	 * @param serializer Optional custom serializer/deserializer.
	 */
	constructor(key: string, defaultValue: T, serializer?: Partial<Serializer<T>>) {
		this.#key = key;
		this.#defaultValue = defaultValue;
		this.#serializer = {
			toJSON: (v: T) => JSON.stringify(v),
			fromJSON: (text: string, fallback: T) => {
				try {
					return JSON.parse(text) as T;
				} catch {
					return fallback;
				}
			},
			...serializer
		} as Serializer<T>;

		this.#value = this.#load();

		if (typeof window !== 'undefined') {
			this.#unsubscribe = on(window, 'storage', (event) => {
				if (event.key === this.#key) {
					this.#value = this.#load();
				}
			});
		}
	}

	#load(): T {
		if (typeof localStorage === 'undefined') return this.#defaultValue;
		const storedValue = localStorage.getItem(this.#key);
		if (storedValue === null || storedValue.trim() === '') return this.#defaultValue;
		return this.#serializer.fromJSON(storedValue, this.#defaultValue);
	}

	/** Returns the current value from storage */
	get value(): T {
		return this.#value;
	}

	/** Updates the value in storage and triggers reactivity */
	set value(v: T) {
		this.#value = v;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(this.#key, this.#serializer.toJSON(v));
		}
	}

	/** Removes the item from storage and resets to default value */
	delete() {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(this.#key);
		}
		this.#value = this.#defaultValue;
	}

	destroy() {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
	}
}
