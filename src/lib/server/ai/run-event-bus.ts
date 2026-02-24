type Subscriber = (event: { runId: string; seq: number; chunk: string }) => void;

class RunEventBus {
	private subscribersByRunId = new Map<string, Set<Subscriber>>();

	emit(event: { runId: string; seq: number; chunk: string }) {
		const subs = this.subscribersByRunId.get(event.runId);
		if (!subs || subs.size === 0) return;
		for (const sub of subs) {
			try {
				sub(event);
			} catch {
				// ignore
			}
		}
	}

	subscribe(runId: string, subscriber: Subscriber) {
		let subs = this.subscribersByRunId.get(runId);
		if (!subs) {
			subs = new Set();
			this.subscribersByRunId.set(runId, subs);
		}
		subs.add(subscriber);
		return () => {
			const current = this.subscribersByRunId.get(runId);
			if (!current) return;
			current.delete(subscriber);
			if (current.size === 0) {
				this.subscribersByRunId.delete(runId);
			}
		};
	}
}

export const runEventBus = new RunEventBus();
