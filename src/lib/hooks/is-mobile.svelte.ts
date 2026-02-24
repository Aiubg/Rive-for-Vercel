import { MediaQuery } from 'svelte/reactivity';
import { BREAKPOINTS } from '$lib/utils/constants';

export class IsMobile extends MediaQuery {
	constructor(breakpoint: number = BREAKPOINTS.md.value) {
		super(`max-width: ${breakpoint - 1}px`);
	}
}
