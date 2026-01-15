import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { winEE } from '../../../msg/WindowEventEmitter';
import { HelperInfo } from '../inputs/PropertyElement';

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
	/**
	 * If true, keep helper selections as arrays (do not unwrap to a single item).
	 * Useful when the stored value (or its JSON form) is array-root.
	 */
	preserveArraySelection?: boolean;
}

interface IRequestData {
	data: any;
	path: string
	type: "requestData"
}

interface IPostDataData {
	data: any;
	path: string;
	type: "postData";
}


interface IPostJsonData {
	data: any;
	json: any;
	path: string;
	type: "postJson";
}

type IHelperMessage = IRequestData | IPostDataData | IPostJsonData;

export class HelperViewer extends React.PureComponent<HelperViewerProps> {
	private iframeRef = React.createRef<HTMLIFrameElement>();

	private normalizeSelection(payload: any): any {
		const preserveArray = this.props.preserveArraySelection === true;
		console.log('[HelperViewer] normalizeSelection input:', payload);
		if (typeof payload === 'string') {
			const trimmed = payload.trim();
			if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
				try {
					payload = JSON.parse(trimmed);
				} catch {
					return payload;
				}
			} else {
				return payload;
			}
		}
		if (payload && typeof payload === 'object') {
			if (!preserveArray && Array.isArray(payload) && payload.length === 1) {
				return this.normalizeSelection(payload[0]);
			}
			// If helper wraps selection as array of configs with empty codes, return the first meaningful entry
			if (!preserveArray && Array.isArray(payload) && payload.length > 1) {
				const firstMeaningful = payload.find((p) => p && (p.code || p.config)) ?? payload[0];
				return this.normalizeSelection(firstMeaningful);
			}
			if (Object.prototype.hasOwnProperty.call(payload, '_overwrite')) {
				const inner = payload.data ?? payload.json;
				if (inner !== undefined) return this.normalizeSelection(inner);
			}
			const inner = payload.data ?? payload.json ?? payload.value;
			if (inner !== undefined) return this.normalizeSelection(inner);
		}
		console.log('[HelperViewer] normalizeSelection output:', payload);
		return payload;
	}

	componentDidMount(): void {
		winEE.on('message', this.handleMessage, this);
	}

	componentWillUnmount(): void {
		winEE.off('message', this.handleMessage, this);
	}

	private handleMessage = (event: MessageEvent) => {
		console.log('[HelperViewer] message received:', event.data);
		if (this.iframeRef.current && event.source !== this.iframeRef.current.contentWindow) {
			return;
		}

		const data = event.data;

		// TWRoleCgEditor / TWMapCgEditor helper lifecycle (and weapon-specific app channel)
		if ((this.isTwRoleHelper() || this.isTwMapHelper()) && (data?.type === 'helperApp' || data?.type === 'weaponApp')) {
			this.handleMessageTwHelper(data);
		}

		// Generic helpers requesting current JSON/data
		if (data?.type === 'requestData' || data?.data?.type === 'requestData') {
			this.postInitData();
		}

		// Selection results (support both top-level and nested payload shapes)
		const nestedType = event.data?.data?.type;
		const topType = event.data?.type;
		if (this.props.onSelect) {
			if (topType === 'helperSelect') {
				const raw = event.data.value ?? event.data.data ?? event.data.json;
				this.props.onSelect(this.normalizeSelection(raw));
			} else if (topType === 'postJson') {
				const payload = event.data.data ?? event.data.value ?? event.data.json;
				this.props.onSelect(this.normalizeSelection(payload));
			} else if (topType === 'postData') {
				const payload = event.data.data ?? event.data.value ?? event.data.json;
				this.props.onSelect(this.normalizeSelection(payload));
			} else if (nestedType === 'helperSelect') {
				const nested = event.data.data;
				this.props.onSelect(this.normalizeSelection(nested?.value ?? nested?.data ?? nested?.json));
			} else if (nestedType === 'postJson') {
				const nested = event.data.data;
				this.props.onSelect(this.normalizeSelection(nested?.data ?? nested?.value ?? nested?.json));
			} else if (nestedType === 'postData') {
				const nested = event.data.data;
				this.props.onSelect(this.normalizeSelection(nested?.data ?? nested?.value ?? nested?.json));
			}
		}
	};

	private isTwRoleHelper(): boolean {
		const name = this.props.helperInfo?.name ?? '';
		return name.toLowerCase().includes('twrolecgeditor');
	}

	private isTwMapHelper(): boolean {
		const name = this.props.helperInfo?.name ?? '';
		return name.toLowerCase().includes('twmapcgeditor');
	}

	private postInitData() {
		const payload = this.buildHelperPayload(this.props.value ?? this.props.defaultValue);
		const config = editor.getEventsJson()?.config;
		const cgapp = editor.getCgApp();
		const items = editor.getItems()?.list;
		const options = this.findEditorOptions(this.props.helperInfo);
		const data = {
			json: payload.json,
			value: payload.raw,
			config,
			options,
			resourcePack: cgapp?.appResourcePack,
			sources: cgapp?.srcUrlMap,
			items
		};
		console.log('[HelperViewer] postInitData sending:', data);
		this.iframeRef.current?.contentWindow?.postMessage({ type: 'initEditor', data }, '*');
	}

	private findEditorOptions(helperInfo?: HelperInfo): any {
		if (helperInfo?.editorOptions && typeof helperInfo.editorOptions === 'object') {
			return helperInfo.editorOptions;
		}
		if (!helperInfo?.entryType || !helperInfo?.entryKey || !helperInfo?.propKey) return undefined;
		const schema = editor.getSchema();
		const entry = schema[helperInfo.entryType]?.[helperInfo.entryKey];
		const props = Array.isArray(entry?.properties) ? entry.properties : [];
		let prop = props.find((p: any) => p?.key === helperInfo.propKey);
		if (!prop) {
			// If duplicates exist, prefer the last occurrence
			for (let i = props.length - 1; i >= 0; i--) {
				if (props[i].key === helperInfo.propKey) {
					prop = props[i];
					break;
				}
			}
		}
		console.log('[HelperViewer] findEditorOptions', {
			entryType: helperInfo.entryType,
			entryKey: helperInfo.entryKey,
			propKey: helperInfo.propKey,
			hasEntry: !!entry,
			hasProp: !!prop,
			editorOptions: prop?.editorOptions,
		});
		if (prop && prop.editorOptions && typeof prop.editorOptions === 'object') {
			return prop.editorOptions;
		}
		return undefined;
	}

	private handleMessageTwHelper(data: { type: string; data: IHelperMessage }) {
		if (data.type !== 'helperApp') return;
		switch (data.data.type) {
			case 'requestData':
				this.postInitData();
				break;
			case 'postData':
				if (this.props.onSelect) {
					this.props.onSelect(this.normalizeSelection(data.data.data));
				}
				break;
			case 'postJson':
				if (this.props.onSelect) {
					const payload = data.data.data ?? data.data?.json ?? data.data;
					this.props.onSelect(this.normalizeSelection(payload));
				}
				break;
		}
	}

	public requestJson() {
		this.iframeRef.current.contentWindow.postMessage(
			{
				type: 'requestJson',
			},
			'*',
		);
	}

	public refreshWithValue(next: any) {
		const payload = this.buildHelperPayload(next ?? this.props.defaultValue);
		console.log('[HelperViewer] refreshWithValue sending:', { json: payload.json, value: payload.raw });
		if (this.iframeRef.current?.contentWindow) {
			this.iframeRef.current.contentWindow.postMessage(
				{
					type: 'refreshJson',
					data: payload.json,
					value: payload.raw,
				},
				'*',
			);
		}
	}

	private buildUrlFromHelper(): string {
		const rawName = this.props.helperInfo.name || '';
		const normalized = rawName.replace(/[^0-9a-z]/gi, '').toLowerCase();
		const base = new URL(`https://${normalized}.gamelet.online/play`);
		base.searchParams.set("usage", this.props.helperInfo.helperType || 'edit');
		const args = { ...(this.props.helperInfo.args || {}) };
		// Some helpers (e.g. TWMapCgEditor) expect certain params at top-level query
		['path', 'mapurl', 'main', 'name'].forEach((key) => {
			const val = args[key];
			if (val !== undefined && val !== null && String(val).length > 0) {
				base.searchParams.set(key, String(val));
				delete args[key];
			}
		});
		base.searchParams.set("params", btoa(JSON.stringify(args)));
		if (this.props.locale) {
			base.searchParams.set("locale", this.props.locale);
		}

		// Provide generous height for layout helpers
		if (rawName.toLowerCase().includes('cgeditorlayout')) {
			const helperHeight = this.props.frameHeight || this.props.helperInfo?.args?.height;
			if (!helperHeight) {
				base.searchParams.set('height', '900');
			}
		}
		return base.toString();
	}

	private buildHelperPayload(value: any): { json: any; raw: any } {
		const name = (this.props.helperInfo?.name || '').toLowerCase();
		const helperType = (this.props.helperInfo?.helperType || '').toLowerCase();
		const helperArgsType = (this.props.helperInfo?.args?.type || '').toLowerCase();

		const isCgEditorLayout = name.includes('cgeditorlayout');

		if (isCgEditorLayout) {
			if (value && typeof value === 'object') {
				return { json: value, raw: value };
			}
			if (typeof value === 'string' && value.trim()) {
				try {
					const parsed = JSON.parse(value);
					return { json: parsed, raw: parsed };
				} catch {
					return { json: value, raw: value };
				}
			}
			return { json: {}, raw: {} };
		}

		// TWMapCgEditor tile helpers often expect a flat object and tolerate stringified JSON.
		if (name.includes('twmapcgeditor')) {
			if (value && typeof value === 'object') {
				return { json: value, raw: value };
			}
			if (typeof value === 'string' && value.trim()) {
				try {
					const parsed = JSON.parse(value);
					return { json: parsed, raw: parsed };
				} catch {
					return { json: value, raw: value };
				}
			}
		}
		const isRoleSelector = helperType.includes('selectrole');
		const isRoleViewer = helperType.includes('viewer') && helperArgsType === 'role';
		const isCustomWeapon =
			helperType.includes('customweapon') ||
			helperType.includes('customfarweapon') ||
			helperType.includes('customthrowableweapon') ||
			helperType.includes('editweapon') ||
			helperType.includes('editfarweapon') ||
			helperType.includes('editthrowableweapon');

		const looksLikeCustomPayload =
			value &&
			typeof value === 'object' &&
			(value.fires !== undefined ||
				value.type !== undefined ||
				value.config !== undefined);

		const hasCodeFields =
			value &&
			typeof value === 'object' &&
			('code' in value || 'name' in value || 'frameName' in value);

		// Many legacy helpers expect a plain code string (e.g., weapon viewer/selectors).
		const wantsCodeString =
			!isRoleSelector &&
			!isRoleViewer &&
			(helperType.includes('select') || helperType.includes('viewer')) &&
			!isCustomWeapon &&
			!looksLikeCustomPayload &&
			(typeof value !== 'object' || hasCodeFields);

		if (wantsCodeString) {
			const code =
				value && typeof value === 'object'
					? value.code ?? value.name ?? value.frameName ?? ''
					: value ?? '';
			const safeCode = code === undefined || code === null ? '' : String(code);
			console.log('[HelperViewer] buildHelperPayload code-only:', safeCode, 'from', value);
			return { json: safeCode, raw: safeCode };
		}

		if (isRoleSelector || isRoleViewer) {
			// Role helpers expect role JSON (or list wrapper), not stringified.
			if (value && typeof value === 'object') {
				console.log('[HelperViewer] buildHelperPayload role object:', value);
				return { json: value, raw: value };
			}
			const roleInit = value ? { dr: value } : { list: [] };
			console.log('[HelperViewer] buildHelperPayload role init:', roleInit);
			return { json: roleInit, raw: roleInit };
		}

		// Custom weapon editors/selectors: ensure an object is provided, not an empty string.
		if (isCustomWeapon) {
			const base = value ?? this.props.defaultValue ?? {};
			let payload: any;
			if (base && typeof base === 'object') {
				if (base.config !== undefined) {
					payload = base;
				} else {
					payload = { code: base.code ?? base.name ?? '', config: base };
				}
			} else {
				const def = this.props.defaultValue;
				const defaultConfig = def && typeof def === 'object' ? def.config ?? def : {};
				payload = { code: base ?? '', config: defaultConfig || {} };
			}
			if (!payload.code && this.props.defaultValue && typeof this.props.defaultValue === 'object') {
				payload.code = this.props.defaultValue.code ?? '';
			}
			if (payload.config === undefined) {
				payload.config = {};
			}
			console.log('[HelperViewer] buildHelperPayload custom weapon object:', payload);
			const jsonPayload = payload.config ? payload.config : payload;
			return { json: jsonPayload, raw: payload };
		}

		const expectsObject =
			name.includes('weapon') ||
			name.includes('farweapon') ||
			name.includes('throwableweapon') ||
			name.includes('itemicon') ||
			name.includes('item') ||
			name.includes('mapblock') ||
			name.includes('mapobject') ||
			name.includes('customweapon') ||
			name.includes('customitem') ||
			name.includes('editor') ||
			name.includes('role');

		if (expectsObject) {
			if (value && typeof value === 'object') {
				console.log('[HelperViewer] buildHelperPayload object:', value);
				return { json: value, raw: value };
			}
			const code = value === undefined || value === null ? '' : String(value);
			const obj = { code, name: code };
			console.log('[HelperViewer] buildHelperPayload default object:', obj);
			return { json: obj, raw: obj };
		}

		if (value === undefined) return { json: '', raw: '' };
		if (value === null) return { json: null, raw: null };
		return { json: value, raw: value };
	}

	render() {
		const { url, className, title, helperInfo, value, locale } = this.props;
		const finalUrl = helperInfo ? this.buildUrlFromHelper() : url;
		if (!finalUrl) {
			return null;
		}
		return (
			<iframe
				ref={this.iframeRef}
				className={['cgenh-helper-viewer', className].filter(Boolean).join(' ')}
				src={finalUrl}
				title={title ?? 'helper-viewer'}
				onLoad={() => this.postInitData()}
			/>
		);
	}
}
