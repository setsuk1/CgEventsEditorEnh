import { IOutgoingMessageMap, OutgoingMessageType } from '@shared';
import { vscode } from '../index';
import { winEE } from '../msg/WindowEventEmitter';
import { EventEmitter } from '../utils/EventEmitter';

export class MessageHandler extends EventEmitter {

	constructor() {
		if (msgHandler) {
			return msgHandler;
		}
		super();
		winEE.on('message', this.handleMessage, this);
	}

	protected handleMessage(ev: MessageEvent<any>) {
		const msg = ev.data;
		if (!msg) {
			return;
		}

		this.emit(msg.type, msg.data);
	}

	send<T extends OutgoingMessageType>(type: T, data: IOutgoingMessageMap[T]) {
		vscode.postMessage({ type, data });
	}
}

export const msgHandler = new MessageHandler();
