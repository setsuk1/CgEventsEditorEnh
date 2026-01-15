export interface EventCardHeaderGlobalClient {
	handleEventHeaderMenuKeyDown(event: KeyboardEvent): void;
}

export class EventCardHeaderGlobalManager {
	private clientsByEventId = new Map<string, EventCardHeaderGlobalClient>();
	private contextMenuOwnerEventId: string | null = null;

	register(eventId: string, client: EventCardHeaderGlobalClient): void {
		this.clientsByEventId.set(eventId, client);
	}

	unregister(eventId: string, client: EventCardHeaderGlobalClient): void {
		const existing = this.clientsByEventId.get(eventId);
		if (existing !== client) {
			return;
		}
		this.clientsByEventId.delete(eventId);
		if (this.contextMenuOwnerEventId === eventId) {
			this.contextMenuOwnerEventId = null;
		}
	}

	setContextMenuOwner(eventId: string): void {
		this.contextMenuOwnerEventId = eventId;
	}

	clearContextMenuOwner(eventId: string): void {
		if (this.contextMenuOwnerEventId === eventId) {
			this.contextMenuOwnerEventId = null;
		}
	}

	handleWindowKeyDown(event: KeyboardEvent): void {
		const ownerId = this.contextMenuOwnerEventId;
		if (!ownerId) {
			return;
		}
		const client = this.clientsByEventId.get(ownerId);
		if (!client) {
			this.contextMenuOwnerEventId = null;
			return;
		}
		client.handleEventHeaderMenuKeyDown(event);
	}
}

export const eventCardHeaderGlobalManager = new EventCardHeaderGlobalManager();

