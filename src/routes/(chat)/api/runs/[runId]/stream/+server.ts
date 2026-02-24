import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGenerationRunById, getRunEventsAfterSeq } from '$lib/server/db/queries';
import { handleServerError } from '$lib/server/utils';
import { runEventBus } from '$lib/server/ai/run-event-bus';

export const GET: RequestHandler = async ({ params, url, locals: { user }, request }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const runId = params.runId;
	const cursor = Number(url.searchParams.get('cursor') ?? '0');
	const afterSeq = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;

	const runRes = await getGenerationRunById({ id: runId });
	if (runRes.isErr()) {
		if (runRes.error._tag === 'DbEntityNotFoundError') {
			throw error(404, 'common.not_found');
		}
		handleServerError(runRes.error, 'common.internal_server_error', { runId });
	}
	const run = runRes.value;
	if (run.userId !== user.id) {
		throw error(403, 'common.forbidden');
	}

	const encoder = new TextEncoder();
	let lastSeqSent = afterSeq;
	let lastEventAt = Date.now();
	let closed = false;
	let unsub: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let statusPoll: ReturnType<typeof setInterval> | null = null;
	let statusPollInFlight = false;
	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start: async (controller) => {
			const send = (text: string) => controller.enqueue(encoder.encode(text));
			const isTerminalControlChunk = (chunk: string) => {
				try {
					const parsed = JSON.parse(chunk) as { type?: string };
					return parsed.type === 'finish' || parsed.type === 'error';
				} catch {
					return false;
				}
			};
			let hasSentDataEvent = false;
			const sendTerminalFallbackEvents = (
				status: string,
				errorText?: string | null,
				includeError = false
			) => {
				if (includeError && status === 'failed') {
					send(
						`data: ${JSON.stringify({ type: 'error', errorText: errorText || 'run.failed' })}\n\n`
					);
				}
				send(`data: ${JSON.stringify({ type: 'finish' })}\n\n`);
			};

			const sendEvent = (seq: number, chunk: string) => {
				hasSentDataEvent = true;
				lastSeqSent = seq;
				lastEventAt = Date.now();
				send(`id: ${seq}\n`);
				send(`data: ${chunk}\n\n`);
			};
			const closeStream = () => {
				if (closed) return;
				closed = true;
				if (heartbeat) clearInterval(heartbeat);
				if (statusPoll) clearInterval(statusPoll);
				unsub?.();
				controller.close();
			};

			const initialEvents = await getRunEventsAfterSeq({ runId, afterSeq });
			if (initialEvents.isErr()) {
				handleServerError(initialEvents.error, 'common.internal_server_error', { runId, afterSeq });
			}
			for (const ev of initialEvents.value) {
				sendEvent(ev.seq, ev.chunk);
				if (isTerminalControlChunk(ev.chunk)) {
					closeStream();
					return;
				}
			}

			const isFinished =
				run.status === 'succeeded' || run.status === 'failed' || run.status === 'canceled';
			if (isFinished && run.cursor <= lastSeqSent) {
				sendTerminalFallbackEvents(run.status, run.error, !hasSentDataEvent);
				closed = true;
				controller.close();
				return;
			}

			unsub = runEventBus.subscribe(runId, (ev) => {
				if (closed) return;
				sendEvent(ev.seq, ev.chunk);
				if (isTerminalControlChunk(ev.chunk)) {
					closeStream();
				}
			});

			heartbeat = setInterval(() => {
				if (closed) return;
				send(': ping\n\n');
			}, 15000);

			statusPoll = setInterval(async () => {
				if (closed || statusPollInFlight) return;
				if (Date.now() - lastEventAt < 3000) return;
				statusPollInFlight = true;
				const latest = await getGenerationRunById({ id: runId });
				statusPollInFlight = false;
				if (latest.isErr()) return;
				const r = latest.value;
				const finished =
					r.status === 'succeeded' || r.status === 'failed' || r.status === 'canceled';
				if (finished && r.cursor <= lastSeqSent) {
					sendTerminalFallbackEvents(r.status, r.error, !hasSentDataEvent);
					closeStream();
				}
			}, 5000);

			cleanup = () => {
				try {
					closeStream();
				} catch {
					// ignore
				}
			};

			if (request.signal) {
				request.signal.addEventListener('abort', cleanup);
			}
		},
		cancel: () => {
			if (cleanup) {
				cleanup();
				return;
			}
			closed = true;
			if (heartbeat) clearInterval(heartbeat);
			if (statusPoll) clearInterval(statusPoll);
			unsub?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'x-vercel-ai-ui-message-stream': 'v1'
		}
	});
};
