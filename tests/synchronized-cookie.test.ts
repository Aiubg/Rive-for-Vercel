import { describe, expect, it } from 'vitest';
import { chatModels } from '$lib/ai/model-registry';
import { POST } from '../src/routes/(chat)/api/synchronized-cookie/[cookieName]/+server';

describe('synchronized-cookie api', () => {
	it('rejects cross-origin requests', async () => {
		const request = new Request('http://localhost/api/synchronized-cookie/selected-model', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin: 'http://evil.example'
			},
			body: JSON.stringify({ value: chatModels[0]?.id ?? 'invalid' })
		});

		const cookies = { set: () => undefined } as unknown;

		await expect(
			POST({
				params: { cookieName: 'selected-model' },
				cookies,
				request,
				url: new URL('http://localhost/api/synchronized-cookie/selected-model')
			} as never)
		).rejects.toMatchObject({ status: 403 });
	});

	it('sets selected-model cookie for same origin', async () => {
		const modelId = chatModels[0]?.id;
		if (!modelId) throw new Error('No chat models configured');

		let lastSet: { name: string; value: string; options: unknown } = {
			name: '',
			value: '',
			options: null
		};
		const cookies = {
			set: (name: string, value: string, options: unknown) => {
				lastSet = { name, value, options };
			}
		};

		const request = new Request('http://localhost/api/synchronized-cookie/selected-model', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin: 'http://localhost'
			},
			body: JSON.stringify({ value: modelId })
		});

		const res = await POST({
			params: { cookieName: 'selected-model' },
			cookies,
			request,
			url: new URL('http://localhost/api/synchronized-cookie/selected-model')
		} as never);

		expect(res.status).toBe(200);
		expect(lastSet.name).toBe('selected-model');
		expect(lastSet.value).toBe(modelId);
	});
});
