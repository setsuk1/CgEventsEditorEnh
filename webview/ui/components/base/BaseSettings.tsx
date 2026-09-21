import baseSettingSchema from '@media/json/basesetting.enheditor.schema.json';
import { translateSchema } from '@shared';
import React from 'react';
import { editor, EditorChangeEvents, type EditorChangeEventType } from '../../../editor/CgEventsEditor';
import { translation } from '../../../trans/Trans';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';
import { acquireModalLock } from '../../utils/modalLock';
import { cloneDraftSnapshot, isDraftSnapshotCurrent } from '../../utils/draftSnapshot';
import { BaseSettingsSummary } from './BaseSettingsSummary';
import {
	getBaseConfigDefinitionLabel,
	getBaseConfigEntryValue,
	hasBaseConfigEditKey,
	mergeBaseConfigPatch,
	resolveBaseConfigLabel,
	resolveBaseConfigSchema,
} from './BaseSettingsData';

const BASE_SETTINGS_REFRESH_EVENTS: readonly EditorChangeEventType[] = [
	EditorChangeEvents.SCHEMA_UPDATED,
	EditorChangeEvents.CONFIG_UPDATED,
	EditorChangeEvents.DOCUMENT_UPDATED,
	EditorChangeEvents.SOURCES_UPDATED,
	EditorChangeEvents.RESOURCES_UPDATED,
];

interface BaseSettingsRJSFProps {
	onEditAsJson?: () => void;
}

interface BaseSettingsRJSFState {
	editOpen: boolean;
	configEditKey?: string;
	configs: Record<string, any>;
}

/**
 * BaseSettings component using RJSF (React JSON Schema Form) for the form rendering.
 * This replaces the manual form implementation with schema-driven forms.
 */
export class BaseSettings extends React.PureComponent<BaseSettingsRJSFProps, BaseSettingsRJSFState> {
	private releaseModalLock: (() => void) | null = null;
	private baseEditInitialSnapshot?: Record<string, any>;
	private configEditInitialSnapshot: unknown = undefined;

	constructor(props: BaseSettingsRJSFProps) {
		super(props);
		this.state = {
			editOpen: false,
			configEditKey: undefined,
			configs: this.buildConfigsSnapshot(),
		};
	}

	componentDidMount(): void {
		for (const eventType of BASE_SETTINGS_REFRESH_EVENTS) {
			editor.on(eventType, this.handleEditorDataUpdate);
		}
	}

	componentDidUpdate(_prevProps: BaseSettingsRJSFProps, prevState: BaseSettingsRJSFState) {
		const overlayOpen = this.state.editOpen || hasBaseConfigEditKey(this.state.configEditKey);
		const prevOverlayOpen = prevState.editOpen || hasBaseConfigEditKey(prevState.configEditKey);
		if (overlayOpen !== prevOverlayOpen) {
			if (overlayOpen) {
				this.releaseModalLock = this.releaseModalLock ?? acquireModalLock();
			} else {
				this.releaseModalLock?.();
				this.releaseModalLock = null;
			}
		}
	}

	componentWillUnmount(): void {
		for (const eventType of BASE_SETTINGS_REFRESH_EVENTS) {
			editor.off(eventType, this.handleEditorDataUpdate);
		}
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleEditorDataUpdate = () => {
		this.forceUpdate();
	};

	private buildConfigsSnapshot(configOverride?: Record<string, any>): Record<string, any> {
		const config = configOverride ?? editor.getEventsJson()?.config;
		return {
			EventsSettings: {
				stage: config?.stage ?? {},
				preload: config?.preload ?? {}
			},
		};
	}

	private openEdit = () => {
		const config = editor.getEventsJson()?.config;
		const configs = this.buildConfigsSnapshot(config);
		this.baseEditInitialSnapshot = cloneDraftSnapshot(configs);
		this.setState({
			editOpen: true,
			configEditKey: undefined,
			configs,
		});
	};

	private closeEdit = () => this.setState({ editOpen: false });

	private handleUpdate = (patch: Record<string, any>) => {
		if (patch?.configs?.EventsSettings) {
			if (this.baseEditInitialSnapshot && !isDraftSnapshotCurrent(this.baseEditInitialSnapshot, this.buildConfigsSnapshot())) {
				throw new Error(translation.validation.dataChanged.getTrans());
			}
			const eventsSettings = patch.configs.EventsSettings;
			editor.updateConfig({
				stage: eventsSettings.stage,
				preload: eventsSettings.preload,
			});
		}
	};

	public openConfig = (configKey: string) => {
		this.configEditInitialSnapshot = cloneDraftSnapshot(getBaseConfigEntryValue(editor.getEventsJson()?.config.configs, configKey));
		this.setState({ configEditKey: configKey });
	};

	private handleConfigPatch = (patch: Record<string, any>) => {
		if (!patch?.configs || typeof patch.configs !== 'object' || Array.isArray(patch.configs)) return;
		const editingKey = this.state.configEditKey;
		if (hasBaseConfigEditKey(editingKey) && !isDraftSnapshotCurrent(
			this.configEditInitialSnapshot,
			getBaseConfigEntryValue(editor.getEventsJson()?.config.configs, editingKey),
		)) {
			throw new Error(translation.validation.dataChanged.getTrans());
		}
		const currentConfigs = editor.getEventsJson()?.config.configs;
		const nextConfigs = mergeBaseConfigPatch(currentConfigs, patch.configs);
		editor.updateConfig({ ...patch, configs: nextConfigs });
	};

	render() {
		const config = editor.getEventsJson()?.config;
		const schema = editor.getSchema();
		const resources = editor.getResources();
		const sourceOptions = editor.getSources();
		const stage = config?.stage ?? {};
		const preload = config?.preload ?? {};
		const configs = config?.configs ?? {};

		const baseLabelObj = baseSettingSchema.definition?.EventsSettings?.label;
		const baseLabel = baseLabelObj ? translateSchema(baseLabelObj) : undefined;

		let configItems: Array<{ key: string; label: string; value: unknown }> = [];
		if (Array.isArray(configs)) {
			configItems = configs.map((entry: unknown, idx: number) => ({
				key: String(idx),
				label: `${translation.settings.configSection.getTrans()} ${idx + 1}`,
				value: entry,
			}));
		} else if (configs && typeof configs === 'object') {
			const fallbackConfigLabel = translation.settings.configSection.getTrans();
			configItems = Object.keys(configs).map((key) => {
				const labelObj = getBaseConfigDefinitionLabel(schema, key);
				const localized = labelObj ? translateSchema(labelObj) : undefined;
				return {
					key,
					label: resolveBaseConfigLabel(key, localized, fallbackConfigLabel),
					value: configs[key],
				};
			});
		}

		return (
			<>
				<BaseSettingsSummary
					stage={stage}
					preload={preload}
					onOpen={this.openEdit}
					resources={resources ?? []}
					configList={configItems}
					onOpenConfig={(key) => this.openConfig(key)}
					baseLabel={baseLabel}
				/>
				{this.state.editOpen && (
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) this.closeEdit();
							}}
						>
							<div
								className="modal-dialog modal-xl modal-dialog-centered cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<RJSFConfigsPanel
									configs={this.state.configs}
									configKey="EventsSettings"
									schema={baseSettingSchema}
									schemaSection="definition"
									onUpdate={this.handleUpdate}
									onClose={this.closeEdit}
									formContext={{ sourceOptions, resources }}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>
				)}
				{hasBaseConfigEditKey(this.state.configEditKey) && (
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) this.setState({ configEditKey: undefined });
							}}
						>
							<div
								className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<RJSFConfigsPanel
									configs={editor.getEventsJson()?.config.configs}
									configKey={this.state.configEditKey}
									schema={resolveBaseConfigSchema(schema, this.state.configEditKey)}
									onUpdate={this.handleConfigPatch}
									onClose={() => this.setState({ configEditKey: undefined })}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>
				)}
			</>
		);
	}
}