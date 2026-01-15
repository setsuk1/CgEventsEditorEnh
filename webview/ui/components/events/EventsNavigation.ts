import { EventEmitter } from '../../../utils/EventEmitter';

class EventsNavigation extends EventEmitter {
	scrollToEvent(eventId: string): void {
		this.emit('scroll-to-event', eventId);
	}
}

export const eventsNavigation = new EventsNavigation();
