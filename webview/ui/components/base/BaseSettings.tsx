import baseSettingSchema from '@media/json/basesetting.enheditor.schema.json';
import { translateSchema } from '@shared';
import React from 'react';
import { editor, EditorChangeEvents } from '../../../editor/CgEventsEditor';
import { translation } from '../../../trans/Trans';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';
import { acquireModalLock } from '../../utils/modalLock';
import { BaseSettingsSummary } from './BaseSettingsSummary';

interface BaseSettingsRJSFProps {
	onEditAsJson?: () => void;
}

interface BaseSettingsRJSFState {
	editOpen: boolean;
	configEditKey?: string;
	configs: Record<string, any>;
	schemaVersion: number;
}

/**
 * BaseSettings component using RJSF (React JSON Schema Form) for the form rendering.
 * This replaces the manual form implementation with schema-driven forms.
 */
export class BaseSettings extends React.PureComponent<BaseSettingsRJSFProps, BaseSettingsRJSFState> {
	private releaseModalLock: (() => void) | null = null;

	constructor(props: BaseSettingsRJSFProps) {
		super(props);
		this.state = {
			editOpen: false,
			configEditKey: undefined,
			configs: this.buildConfigsSnapshot(),
			schemaVersion: 0,
		};
	}

	componentDidMount(): void {
		// Listen for schema updates to trigger re-render
		editor.on(EditorChangeEvents.SCHEMA_UPDATED, this.handleSchemaUpdate, this);
	}

	componentDidUpdate(_prevProps: BaseSettingsRJSFProps, prevState: BaseSettingsRJSFState) {
		const overlayOpen = this.state.editOpen || !!this.state.configEditKey;
		const prevOverlayOpen = prevState.editOpen || !!prevState.configEditKey;
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
		editor.off(EditorChangeEvents.SCHEMA_UPDATED, this.handleSchemaUpdate, this);
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleSchemaUpdate = () => {
		// Increment schemaVersion to trigger re-render
		this.setState((prev) => ({ schemaVersion: prev.schemaVersion + 1 }));
	};

	private buildConfigsSnapshot(configOverride?: Record<string, any>): Record<string, any> {
		const config = configOverride ?? editor.getEventsJson()?.config;
		// Build the EventsSettings config object that matches RJSF schema structure
		return {
			EventsSettings: {
				stage: config?.stage ?? {},
				preload: config?.preload ?? {}
			},
		};
	}

	private openEdit = () => {
		const config = editor.getEventsJson()?.config;
		this.setState({
			editOpen: true,
			configEditKey: undefined,
			configs: this.buildConfigsSnapshot(config),
		});
	};

	private closeEdit = () => this.setState({ editOpen: false });

	private handleUpdate = (patch: Record<string, any>) => {
		if (patch?.configs?.EventsSettings) {
			const eventsSettings = patch.configs.EventsSettings;
			// Update the editor with the new stage and preload settings
			editor.updateConfig({
				stage: eventsSettings.stage,
				preload: eventsSettings.preload,
			});
		}
	};

	public openConfig = (configKey: string) => {
		this.setState({
			configEditKey: configKey,
			configs: this.buildConfigsSnapshot(),
		});
	};

	private handleConfigPatch = (patch: Record<string, any>) => {
		if (patch?.configs && typeof patch.configs === 'object') {
			this.setState((prev) => ({
				configs: { ...(prev.configs || {}), ...patch.configs },
			}));
		}
		editor.updateConfig(patch);
	};

	render() {
		const config = editor.getEventsJson()?.config;
		const schema = editor.getSchema();
		const resources = editor.getResources();
		const sourceOptions = editor.getSources();
		const stage = config?.stage ?? {};
		const preload = config?.preload ?? {};
		const configs = config?.configs ?? {};

		// Get the base settings label from schema
		const baseLabelObj = baseSettingSchema.definition?.EventsSettings?.label;
		const baseLabel = baseLabelObj ? translateSchema(baseLabelObj) : undefined;

		// Build config items for the summary view
		let configItems: Array<{ key: string; label: string; value: unknown }> = [];
		if (Array.isArray(configs)) {
			configItems = configs.map((entry: unknown, idx: number) => ({
				key: String(idx),
				label: `${translation.settings.configSection.getTrans()} ${idx + 1}`,
				value: entry,
			}));
		} else if (configs && typeof configs === 'object') {
			configItems = Object.keys(configs).map((key) => {
				const labelObj = schema?.definition?.[key]?.label;
				const localized = labelObj ? translateSchema(labelObj) : undefined;
				return { key, label: localized ?? key, value: configs[key] };
			});
		}

		return (
			<>
				<BaseSettingsSummary
					stage={stage}
					preload={preload}
					onOpen={this.openEdit}
					totalResources={resources?.length ?? 0}
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
								if (e.target === e.currentTarget) {
									this.closeEdit();
								}
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
									formContext={{
										sourceOptions: sourceOptions,
										resources: resources,
									}}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>
				)}
				{this.state.configEditKey && (
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.setState({ configEditKey: undefined });
								}
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
									schema={schema}
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
