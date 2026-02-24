import { describe, expect, it } from 'vitest';
import { computeTextareaAutosizeLayout } from '$lib/components/multimodal/textarea-autosize-layout';

describe('computeTextareaAutosizeLayout', () => {
	it('enforces min height', () => {
		const r = computeTextareaAutosizeLayout({
			scrollHeight: 10,
			viewportInnerHeight: 900,
			maxHeight: 400,
			minHeight: 60
		});

		expect(r.height).toBe(60);
		expect(r.overflowY).toBe('hidden');
	});

	it('caps height by maxHeight', () => {
		const r = computeTextareaAutosizeLayout({
			scrollHeight: 2000,
			viewportInnerHeight: 2000,
			maxHeight: 400,
			minHeight: 60
		});

		expect(r.height).toBe(400);
		expect(r.overflowY).toBe('auto');
		expect(r.stickToBottom).toBe(true);
	});

	it('caps height by half viewport when smaller than maxHeight', () => {
		const r = computeTextareaAutosizeLayout({
			scrollHeight: 2000,
			viewportInnerHeight: 600,
			maxHeight: 400,
			minHeight: 60
		});

		expect(r.height).toBe(300);
		expect(r.overflowY).toBe('auto');
	});
});
