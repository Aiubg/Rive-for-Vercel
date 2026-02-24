import { getContext, setContext } from 'svelte';

export type SearchResult = {
	id: number;
	title: string;
	url: string;
	snippet: string;
	publishedAt?: string;
	score?: number;
};

export class SearchSidebarState {
	#isOpen = $state(false);
	results = $state<SearchResult[]>([]);
	activeToolCallId = $state<string | null>(null);
	htmlCode = $state<string | null>(null);
	htmlTitle = $state<string | null>(null);
	fileContent = $state<string | null>(null);
	fileName = $state<string | null>(null);
	fileUrl = $state<string | null>(null);
	fileContentType = $state<string | null>(null);
	mode = $state<'search' | 'html' | 'file'>('search');

	get isOpen() {
		return this.#isOpen;
	}

	set isOpen(value: boolean) {
		this.#isOpen = value;
	}

	open(results: SearchResult[], toolCallId: string) {
		this.results = results;
		this.activeToolCallId = toolCallId;
		this.htmlCode = null;
		this.htmlTitle = null;
		this.fileName = null;
		this.fileContent = null;
		this.fileUrl = null;
		this.fileContentType = null;
		this.mode = 'search';
		this.isOpen = true;
	}

	openHtml(code: string) {
		this.htmlCode = code;
		this.activeToolCallId = null;
		this.fileName = null;
		this.fileContent = null;
		this.fileUrl = null;
		this.fileContentType = null;
		this.mode = 'html';
		this.isOpen = true;

		const titleMatch = code.match(/<title>(.*?)<\/title>/i);
		const title = titleMatch?.[1] ?? null;
		this.htmlTitle = title;
	}

	openFile({
		name,
		content = null,
		url = null,
		contentType = null
	}: {
		name: string;
		content?: string | null;
		url?: string | null;
		contentType?: string | null;
	}) {
		this.htmlCode = null;
		this.htmlTitle = null;
		this.fileName = name;
		this.fileContent = content;
		this.fileUrl = url;
		this.fileContentType = contentType;
		this.activeToolCallId = null;
		this.mode = 'file';
		this.isOpen = true;
	}

	close() {
		this.isOpen = false;
	}

	toggle() {
		this.isOpen = !this.isOpen;
	}
}

const SEARCH_SIDEBAR_KEY = Symbol('SEARCH_SIDEBAR');

export function setSearchSidebarContext() {
	const state = new SearchSidebarState();
	setContext(SEARCH_SIDEBAR_KEY, state);
	return state;
}

export function getSearchSidebarContext() {
	return getContext<SearchSidebarState>(SEARCH_SIDEBAR_KEY);
}
