import { IIncomingMessageMap, IncomingMessageType, IOutgoingMessageMap, isIncomingMessage, OutgoingMessageType } from '@shared';
import { winEE } from '../msg/WindowEventEmitter';
import { messageToken, vscode } from '../vscodeApi';
import { EventEmitter } from '../utils/EventEmitter';

export class MessageHandler extends EventEmitter {
	constructor() {
		super();
		winEE.on('message', this.handleMessage);
	}

	onIncoming<T extends IncomingMessageType>(
		type: T,
		listener: (data: IIncomingMessageMap[T]) => void,
	): boolean {
		return super.on(type, listener);
	}

	offIncoming<T extends IncomingMessageType>(
		type: T,
		listener: (data: IIncomingMessageMap[T]) => void,
	): boolean {
		return super.off(type, listener);
	}

	protected handleMessage = (ev: MessageEvent<unknown>) => {
		const msg = ev.data;
		if (!msg || typeof msg !== 'object' || Array.isArray(msg) || (msg as { token?: unknown }).token !== messageToken) return;
		if (!isIncomingMessage(msg)) return;
		this.emit(msg.type, msg.data);
	};

	send<T extends OutgoingMessageType>(type: T, data: IOutgoingMessageMap[T]) {
		vscode.postMessage({ token: messageToken, type, data });
	}
}

export const msgHandler = new MessageHandler();
