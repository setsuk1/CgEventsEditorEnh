import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { winEE } from '../../../msg/WindowEventEmitter';
import type { HelperInfo } from './HelperInfo';
import { buildHelperPayload, normalizeHelperSelection } from './HelperViewerData';

interface HelperViewerProps {
	url?: string;
	className?: string;
	title?: string;
	helperInfo?: HelperInfo | null;
	value?: any;
	defaultValue?: any;
	locale?: string;
	onSelect?(value: any): void;
	frameHeight?: string;
	preserveArraySelection?: boolean;
}

interface IRequestData {
	data: any;
	path: string;
	type: 'requestData';
}

interface IPostDataData {
	data: any;
	path: string;
	type: 'postData';
}

interface IPostJsonData {
	data: any;
	json: any;
	path: string;
	type: 'postJson';
}

type IHelperMessage = IRequestData | IPostDataData | IPostJsonData;

function encodeBase64Utf8(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

export class HelperViewer extends React.PureComponent<HelperViewerProps> {
	private iframeRef = React.createRef<HTMLIFrameElement>();

	private getFrameUrl(): string | undefined {
		return this.props.helperInfo ? this.buildUrlFromHelper() : this.props.url;
	}

	private getFrameOrigin(): string | undefined {
		const url = this.getFrameUrl();
		if (!url) return undefined;
		try {
			return new URL(url, document.baseURI).origin;
		} catch {
			return undefined;
		}
	}

	private postToFrame(message: unknown): void {
		const frame = this.iframeRef.current?.contentWindow;
		const origin = this.getFrameOrigin();
		if (frame && origin) frame.postMessage(message, origin);
	}

	componentDidMount(): void {
		winEE.on('message', this.handleMessage);
	}

	componentWillUnmount(): void {
		winEE.off('message', this.handleMessage);
	}

	private handleMessage = (event: MessageEvent) => {
		const frame = this.iframeRef.current?.contentWindow;
		const origin = this.getFrameOrigin();
		if (!frame || !origin || event.source !== frame || event.origin !== origin) return;

		const data = event.data;
		if ((this.isTwRoleHelper() || this.isTwMapHelper()) && (data?.type === 'helperApp' || data?.type === 'weaponApp')) {
			this.handleMessageTwHelper(data);
			return;
		}

		if (data?.type === 'requestData' || data?.data?.type === 'requestData') {
			this.postInitData();
			return;
		}

		if (!this.props.onSelect) return;
		const nestedType = data?.data?.type;
		const topType = data?.type;
		if (topType === 'helperSelect') {
			this.props.onSelect(normalizeHelperSelection(data.value ?? data.data ?? data.json, this.props.preserveArraySelection === true));
		} else if (topType === 'postJson' || topType === 'postData') {
			this.props.onSelect(normalizeHelperSelection(data.data ?? data.value ?? data.json, this.props.preserveArraySelection === true));
		} else if (nestedType === 'helperSelect' || nestedType === 'postJson' || nestedType === 'postData') {
			const nested = data.data;
			this.props.onSelect(normalizeHelperSelection(nested?.value ?? nested?.data ?? nested?.json, this.props.preserveArraySelection === true));
		}
	};

	private isTwRoleHelper(): boolean {
		return (this.props.helperInfo?.name ?? '').toLowerCase().includes('twrolecgeditor');
	}

	private isTwMapHelper(): boolean {
		return (this.props.helperInfo?.name ?? '').toLowerCase().includes('twmapcgeditor');
	}

	private postInitData() {
		const payload = buildHelperPayload(this.props.value ?? this.props.defaultValue, this.getHelperPayloadOptions());
		const data = {
			json: payload.json,
			value: payload.raw,
			config: editor.getEventsJson()?.config,
			options: this.findEditorOptions(this.props.helperInfo),
			resourcePack: editor.getCgApp()?.appResourcePack,
			sources: editor.getCgApp()?.srcUrlMap,
			items: editor.getItems()?.list,
		};
		this.postToFrame({ type: 'initEditor', data });
	}

	private findEditorOptions(helperInfo?: HelperInfo): any {
		if (helperInfo?.editorOptions && typeof helperInfo.editorOptions === 'object') {
			return helperInfo.editorOptions;
		}
		if (!helperInfo?.entryType || !helperInfo?.entryKey || !helperInfo?.propKey) return undefined;
		const entry = editor.getSchema()?.[helperInfo.entryType]?.[helperInfo.entryKey];
		const props = Array.isArray(entry?.properties) ? entry.properties : [];
		for (let i = props.length - 1; i >= 0; i--) {
			const prop = props[i];
			if (prop?.key === helperInfo.propKey && prop.editorOptions && typeof prop.editorOptions === 'object') {
				return prop.editorOptions;
			}
		}
		return undefined;
	}

	private handleMessageTwHelper(data: { type: 'helperApp' | 'weaponApp'; data: IHelperMessage }) {
		switch (data.data.type) {
			case 'requestData':
				this.postInitData();
				break;
			case 'postData':
				this.props.onSelect?.(normalizeHelperSelection(data.data.data, this.props.preserveArraySelection === true));
				break;
			case 'postJson': {
				const payload = data.data.data ?? data.data.json ?? data.data;
				this.props.onSelect?.(normalizeHelperSelection(payload, this.props.preserveArraySelection === true));
				break;
			}
		}
	}

	public requestJson() {
		this.postToFrame({ type: 'requestJson' });
	}

	public refreshWithValue(next: any) {
		const payload = buildHelperPayload(next ?? this.props.defaultValue, this.getHelperPayloadOptions());
		this.postToFrame({
			type: 'refreshJson',
			data: payload.json,
			value: payload.raw,
		});
	}

	private buildUrlFromHelper(): string | undefined {
		const rawName = this.props.helperInfo?.name?.trim() ?? '';
		const normalized = rawName.replace(/[^0-9a-z]/gi, '').toLowerCase();
		if (!normalized) return undefined;

		const base = new URL(`https://${normalized}.gamelet.online/play`);
		base.searchParams.set('usage', this.props.helperInfo?.helperType || 'edit');
		const args = { ...(this.props.helperInfo?.args || {}) };
		['path', 'mapurl', 'main', 'name'].forEach((key) => {
			const val = args[key];
			if (val !== undefined && val !== null && String(val).length > 0) {
				base.searchParams.set(key, String(val));
				delete args[key];
			}
		});
		base.searchParams.set('params', encodeBase64Utf8(JSON.stringify(args)));
		if (this.props.locale) base.searchParams.set('locale', this.props.locale);
		if (rawName.toLowerCase().includes('cgeditorlayout')) {
			const helperHeight = this.props.frameHeight || this.props.helperInfo?.args?.height;
			if (!helperHeight) base.searchParams.set('height', '900');
		}
		return base.toString();
	}

	private getHelperPayloadOptions() {
		return {
			helperName: this.props.helperInfo?.name,
			helperType: this.props.helperInfo?.helperType,
			helperArgsType: this.props.helperInfo?.args?.type,
			defaultValue: this.props.defaultValue,
		};
	}

	render() {
		const finalUrl = this.getFrameUrl();
		if (!finalUrl) return null;
		return (
			<iframe
				ref={this.iframeRef}
				className={['cgenh-helper-viewer', this.props.className].filter(Boolean).join(' ')}
				src={finalUrl}
				title={this.props.title ?? 'helper-viewer'}
				loading="lazy"
				onLoad={() => this.postInitData()}
			/>
		);
	}
}
