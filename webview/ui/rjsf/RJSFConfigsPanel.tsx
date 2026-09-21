import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, RegistryWidgetsType, RJSFSchema, TemplatesType, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { getSelectedLanguage, ICgEventsSchema, ObjectUtil } from '@shared';
import React from 'react';
import { playMouseDownAudio, playMouseHoverAudio } from '../../helper/sound';
import { winEE } from '../../msg/WindowEventEmitter';
import { translation } from '../../trans/Trans';
import { SvgCodeBrackets } from '../svg/SvgCodeBrackets';
import { SvgListBox } from '../svg/SvgListBox';
import { FormHistoryControls } from '../components/common/FormHistoryControls';
import { MonacoEditorComponent } from '../components/common/MonacoEditorComponent';
import { Tooltip } from '../components/common/Tooltip';
import { ConfigsPanelHeader } from '../components/configs/ConfigsPanelHeader';
import { deepMergeDefined } from '../utils/deepMerge';
import { FormHistory } from '../utils/formHistory';
import { setOwnValueAtPath } from '../../utils/ownPath';
import { handleEnterCommitShortcut, handleUndoRedoShortcuts } from '../utils/formUndoRedo';
import { HelperField } from './fields/HelperField';
import { convertFullSchema, createFallbackSchema } from './schemaConverter';
import {
	applyRjsfArrayAddDefaults,
	buildRjsfDefaultValues,
	createPendingRjsfArrayAdd,
	type PendingRjsfArrayAdd,
} from './rjsfDefaultValues';
import { ArrayFieldItemTemplate, ArrayFieldTemplate } from './templates/ArrayFieldTemplate';
import { DescriptionFieldTemplate, FieldTemplate } from './templates/FieldTemplate';
import { ObjectFieldTemplate } from './templates/ObjectFieldTemplate';
import { coerceToSchema } from './utils/formDataCoercion';
import { getOwnRjsfConfigEntry, hasBooleanChange, transformRjsfValidationErrors } from './utils/rjsfUtils';
import { pruneHiddenFields } from './utils/visibleOption';
import { CheckboxListWidget } from './widgets/CheckboxListWidget';
import { ColorWidget } from './widgets/ColorWidget';
import { DatalistWidget } from './widgets/DatalistWidget';
import { HelperWidget } from './widgets/HelperWidget';
import { JSONWidget } from './widgets/JSONWidget';
import { SelectWidget } from './widgets/SelectWidget';

type SchemaSection = 'definition' | 'action' | 'trigger' | 'check';

type RJSFConfigSchema = {
	definition: Record<string, any>;
	action?: Record<string, any>;
	trigger?: Record<string, any>;
	check?: Record<string, any>;
};

function normalizeRjsfConfigSchema(schema: RJSFConfigSchema): ICgEventsSchema {
	// Static bundled schemas are legacy JSON sources and may contain extra/legacy
	// fields. Conversion only requires the four category maps, so normalize the
	// boundary here rather than scattering caller-side casts.
	return {
		action: (schema.action ?? {}) as ICgEventsSchema['action'],
		trigger: (schema.trigger ?? {}) as ICgEventsSchema['trigger'],
		check: (schema.check ?? {}) as ICgEventsSchema['check'],
		definition: schema.definition as ICgEventsSchema['definition'],
	};
}

export type RJSFConfigsPanelEditorMode = 'toggle' | 'json' | 'visual';

export interface RJSFConfigsPanelProps {
	configs?: Record<string, any> | any[];
	configKey: string;
	schema?: RJSFConfigSchema;
	schemaSection?: SchemaSection;
	onUpdate(patch: Record<string, any>): void;
	onClose(): void;
	onBack?(): void;
	backTitle?: string;
	embedded?: boolean;
	showHeader?: boolean;
	title?: string;
	description?: string;
	editorMode?: RJSFConfigsPanelEditorMode;
	onValidate?(data: any): string | undefined;
	formContext?: Record<string, any>;
}

interface RJSFConfigsPanelState {
	formData: any;
	showJsonEditor: boolean;
	jsonText: string;
	jsonError?: string;
	formError?: string;
}

const widgets: RegistryWidgetsType = {
	color: ColorWidget,
	CheckboxList: CheckboxListWidget,
	helper: HelperWidget,
	datalist: DatalistWidget,
	json: JSONWidget,
	select: SelectWidget,
};

const fields: RegistryFieldsType = {
	helper: HelperField,
};

const templates: Partial<TemplatesType> = {
	ArrayFieldItemTemplate,
	ArrayFieldTemplate,
	DescriptionFieldTemplate,
	FieldTemplate,
	ObjectFieldTemplate,
};

export class RJSFConfigsPanel extends React.PureComponent<RJSFConfigsPanelProps, RJSFConfigsPanelState> {
	private formHistory: FormHistory<any>;
	private cachedJsonSchema: RJSFSchema = { type: 'object' };
	private cachedUiSchema: UiSchema = {};
	private cachedSchemaRef?: RJSFConfigSchema;
	private cachedSchemaKey?: { configKey: string; schemaSection: SchemaSection };
	private cachedLanguageCode?: string;
	private lastConfigKey: string;
	private lastSchemaSection: SchemaSection;
	private lastSchemaRef?: RJSFConfigSchema;
	private containerRef = React.createRef<HTMLDivElement>();
	private formRef = React.createRef<Form<any>>();
	private pendingImmediateCommit = false;
	private pendingArrayAdd?: PendingRjsfArrayAdd;

	constructor(props: RJSFConfigsPanelProps) {
		super(props);
		this.ensureSchemaCache(props);
		const initialData = this.buildInitialData(props);
		const initialShowJsonEditor = this.getEditorMode(props) === 'json';
		this.formHistory = new FormHistory(initialData, this.forceUpdate.bind(this));
		this.state = {
			formData: initialData,
			showJsonEditor: initialShowJsonEditor,
			jsonText: JSON.stringify(initialData, null, 2),
			jsonError: undefined as string | undefined,
			formError: undefined as string | undefined,
		};
		this.lastConfigKey = props.configKey;
		this.lastSchemaSection = this.getSchemaSection(props);
		this.lastSchemaRef = props.schema;
	}

	componentDidMount(): void {
		winEE.on('keydown', this.handleKeyDown);
	}

	componentDidUpdate(prevProps: RJSFConfigsPanelProps): void {
		const nextSchemaSection = this.getSchemaSection(this.props);
		const configKeyChanged = this.lastConfigKey !== this.props.configKey;
		const schemaSectionChanged = this.lastSchemaSection !== nextSchemaSection;
		const schemaChanged = this.lastSchemaRef !== this.props.schema;
		const editorModeChanged = this.getEditorMode(prevProps) !== this.getEditorMode(this.props);
		if (configKeyChanged || schemaSectionChanged || editorModeChanged) {
			this.lastConfigKey = this.props.configKey;
			this.lastSchemaSection = nextSchemaSection;
			this.lastSchemaRef = this.props.schema;
			this.ensureSchemaCache(this.props);
			const initialData = this.buildInitialData(this.props);
			const initialShowJsonEditor = this.getEditorMode(this.props) === 'json';
			this.formHistory.reset(initialData);
			this.setState({
				formData: initialData,
				showJsonEditor: initialShowJsonEditor,
				jsonText: JSON.stringify(initialData, null, 2),
				jsonError: undefined as string | undefined,
				formError: undefined as string | undefined,
			});
			return;
		}

		if (schemaChanged) {
			this.lastSchemaRef = this.props.schema;
			this.ensureSchemaCache(this.props);
			const { schema } = this.getSchemaPair(this.props);
			const liveData = this.state.showJsonEditor
				? this.state.formData
				: (this.formRef.current?.state.formData ?? this.state.formData);
			const formData = coerceToSchema(liveData, schema);
			const jsonText = this.state.showJsonEditor && !this.state.jsonError
				? JSON.stringify(formData, null, 2)
				: this.state.jsonText;
			this.formHistory.reset(formData);
			this.setState({
				formData,
				jsonText,
				jsonError: this.state.jsonError,
				formError: undefined as string | undefined,
			});
			return;
		}

		if (prevProps.embedded !== this.props.embedded && this.state.showJsonEditor) {
			this.setState({ jsonText: JSON.stringify(this.state.formData, null, 2) });
		}
	}

	componentWillUnmount(): void {
		winEE.off('keydown', this.handleKeyDown);
	}

	private getSchemaSection(props: RJSFConfigsPanelProps): SchemaSection {
		return props.schemaSection ?? 'definition';
	}

	private getEditorMode(props: RJSFConfigsPanelProps = this.props): RJSFConfigsPanelEditorMode {
		const mode = props.editorMode;
		if (mode === 'json' || mode === 'visual' || mode === 'toggle') return mode;
		return 'toggle';
	}

	private ensureSchemaCache(props: RJSFConfigsPanelProps): void {
		const schemaSection = this.getSchemaSection(props);
		const schemaChanged = this.cachedSchemaRef !== props.schema;
		const languageCode = getSelectedLanguage().code;
		const languageChanged = this.cachedLanguageCode !== languageCode;
		const keyChanged =
			!this.cachedSchemaKey ||
			this.cachedSchemaKey.configKey !== props.configKey ||
			this.cachedSchemaKey.schemaSection !== schemaSection;

		if (!this.cachedSchemaKey || schemaChanged || keyChanged || languageChanged) {
			let jsonSchema: RJSFSchema;
			let uiSchema: UiSchema;
			if (props.schema) {
				const converted = convertFullSchema(normalizeRjsfConfigSchema(props.schema), props.configKey, schemaSection);
				jsonSchema = converted.schema;
				uiSchema = converted.uiSchema;
			} else {
				const fallback = createFallbackSchema(getOwnRjsfConfigEntry(props.configs, props.configKey));
				jsonSchema = fallback.schema;
				uiSchema = fallback.uiSchema;
			}
			this.cachedJsonSchema = jsonSchema;
			this.cachedUiSchema = ObjectUtil.deepCloneObject(uiSchema);
			this.cachedSchemaRef = props.schema;
			this.cachedSchemaKey = { configKey: props.configKey, schemaSection };
			this.cachedLanguageCode = languageCode;
		}
	}

	private getSchemaPair(props: RJSFConfigsPanelProps = this.props): { schema: RJSFSchema; uiSchema: UiSchema } {
		this.ensureSchemaCache(props);
		return {
			schema: this.cachedJsonSchema,
			uiSchema: this.cachedUiSchema,
		};
	}

	private buildInitialData(props: RJSFConfigsPanelProps): any {
		const { schema } = this.getSchemaPair(props);
		const defaults = buildRjsfDefaultValues(schema);
		const source = getOwnRjsfConfigEntry(props.configs, props.configKey);
		const merged = deepMergeDefined(defaults, source);
		return coerceToSchema(merged, schema);
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		if (handleUndoRedoShortcuts(event, this.containerRef.current, this.handleUndo, this.handleRedo)) return;
		handleEnterCommitShortcut(event, this.containerRef.current, this.handleEnterCommit);
	};

	private handleEnterCommit = () => {
		this.syncFormDataFromRef(() => this.commitFormData(true));
	};

	private replaceInitialHistorySnapshot = () => {
		if (this.formHistory.canUndo() || this.formHistory.canRedo()) return;
		this.formHistory.reset(this.state.formData);
	};

	private handleUndo = () => {
		this.commitFormData();
		const snapshot = this.formHistory.undo();
		if (!snapshot) return;
		this.setState((prev) => ({
			formData: snapshot,
			jsonText: prev.showJsonEditor ? JSON.stringify(snapshot, null, 2) : prev.jsonText,
			jsonError: undefined as string | undefined,
			formError: undefined as string | undefined,
		}), this.validateForm);
	};

	private handleRedo = () => {
		this.commitFormData();
		const snapshot = this.formHistory.redo();
		if (!snapshot) return;
		this.setState((prev) => ({
			formData: snapshot,
			jsonText: prev.showJsonEditor ? JSON.stringify(snapshot, null, 2) : prev.jsonText,
			jsonError: undefined as string | undefined,
			formError: undefined as string | undefined,
		}), this.validateForm);
	};

	private validateForm = () => {
		if (!this.state.showJsonEditor) this.formRef.current?.validateForm();
	};

	private commitFormData = (trigger?: string | boolean) => {
		if (this.state.showJsonEditor && this.state.jsonError) return;
		let snapshot = this.state.formData;
		if (!this.state.showJsonEditor) {
			const formSnapshot = this.formRef.current?.state.formData;
			if (formSnapshot !== undefined) {
				const { schema } = this.getSchemaPair();
				snapshot = coerceToSchema(formSnapshot, schema);
			}
		}
		const pushed = this.formHistory.push(snapshot);
		if (trigger === true && pushed) this.validateForm();
	};

	private requestImmediateCommit = () => {
		if (!this.state.showJsonEditor || !this.state.jsonError) this.pendingImmediateCommit = true;
	};

	private registerArrayAdd = (path: Array<string | number>, index: number, itemSchema: unknown) => {
		this.pendingArrayAdd = createPendingRjsfArrayAdd(path, index, itemSchema);
	};

	private applyPendingArrayAddDefaults(nextData: any): any {
		const pending = this.pendingArrayAdd;
		this.pendingArrayAdd = undefined;
		if (!pending) return nextData;
		const schemaUtils = this.formRef.current?.state.schemaUtils;
		if (!schemaUtils) return nextData;
		const rowDefault = schemaUtils.getDefaultFormState(pending.itemSchema, undefined, true);
		return applyRjsfArrayAddDefaults(nextData, pending, rowDefault);
	}

	private handleFormBlur = (_id?: string, _value?: any) => {
		this.syncFormDataFromRef(() => this.commitFormData(true));
	};

	private syncFormDataFromRef = (afterApply?: () => void) => {
		const form = this.formRef.current;
		if (form) this.applyFormData(form.state.formData, afterApply);
	};

	private applyFormData(nextData: any, afterApply?: () => void) {
		const { schema } = this.getSchemaPair();
		const coerced = coerceToSchema(nextData, schema);
		this.setState((prev) => ({
			formData: coerced,
			jsonText: prev.showJsonEditor ? JSON.stringify(coerced, null, 2) : prev.jsonText,
			jsonError: undefined as string | undefined,
			formError: undefined as string | undefined,
		}), afterApply);
	}

	private transformErrors = (errors: any) => {
		return Array.isArray(errors)
			? transformRjsfValidationErrors(errors, translation.validation.required.getTrans())
			: errors;
	};

	private handleChange = (event: IChangeEvent) => {
		const shouldCommitImmediately = this.pendingImmediateCommit;
		if (!shouldCommitImmediately && !hasBooleanChange(this.state.formData, event.formData)) return;
		if (!shouldCommitImmediately) this.pendingArrayAdd = undefined;
		this.pendingImmediateCommit = false;
		const nextData = shouldCommitImmediately ? this.applyPendingArrayAddDefaults(event.formData) : event.formData;
		this.applyFormData(nextData, () => this.commitFormData(true));
	};

	private handlePathUpdate = (path: Array<string | number>, next: any, commit?: boolean | 'init') => {
		const liveBase = this.state.showJsonEditor
			? this.state.formData
			: (this.formRef.current?.state.formData ?? this.state.formData);
		const updated = setOwnValueAtPath(liveBase, path, next);
		if (commit === 'init') {
			if (this.formHistory.canUndo() || this.formHistory.canRedo()) {
				this.applyFormData(updated, () => this.commitFormData(true));
				return;
			}
			this.applyFormData(updated, this.replaceInitialHistorySnapshot);
			return;
		}
		this.applyFormData(updated, commit ? () => this.commitFormData(true) : undefined);
	};

	private handleSave = () => {
		if (this.state.showJsonEditor && this.state.jsonError) {
			this.setState({ formError: translation.validation.invalidJson.getTrans() });
			return;
		}

		const { schema, uiSchema } = this.getSchemaPair();
		const formSnapshot = this.state.showJsonEditor ? undefined : this.formRef.current?.state.formData;
		const sourceData = formSnapshot ?? this.state.formData;
		const coercedData = coerceToSchema(sourceData, schema);
		const sanitizedData = pruneHiddenFields(coercedData, uiSchema, coercedData);
		const validateMessage = this.props.onValidate?.(sanitizedData);
		if (validateMessage) {
			this.setState({ formError: validateMessage });
			return;
		}

		try {
			this.props.onUpdate({ configs: { [this.props.configKey]: sanitizedData } });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.setState({ formError: message || translation.validation.invalidJson.getTrans() });
			return;
		}
		this.props.onClose();
	};

	private handleJsonChange = (text: string) => {
		const { schema } = this.getSchemaPair();
		try {
			const parsed = JSON.parse(text || '{}');
			const coerced = coerceToSchema(parsed, schema);
			this.setState({
				jsonText: text,
				jsonError: undefined as string | undefined,
				formData: coerced,
				formError: undefined as string | undefined,
			});
		} catch (err) {
			this.setState({
				jsonText: text,
				jsonError: err instanceof Error ? err.message : translation.validation.invalidJson.getTrans(),
				formError: undefined as string | undefined,
			});
		}
	};

	private toggleJsonEditor = () => {
		if (this.getEditorMode() !== 'toggle') return;
		if (this.state.showJsonEditor) {
			if (this.state.jsonError) {
				this.setState({ formError: translation.validation.invalidJson.getTrans() });
				return;
			}
			this.setState((prev) => ({
				showJsonEditor: false,
				jsonError: undefined as string | undefined,
				jsonText: prev.jsonText,
				formError: undefined as string | undefined,
			}));
			return;
		}

		const form = this.formRef.current;
		if (!form) {
			this.setState((prev) => ({
				showJsonEditor: true,
				jsonError: undefined as string | undefined,
				jsonText: JSON.stringify(prev.formData, null, 2),
				formError: undefined as string | undefined,
			}));
			return;
		}
		this.applyFormData(form.state.formData, () => {
			this.setState((prev) => ({
				showJsonEditor: true,
				jsonError: undefined as string | undefined,
				jsonText: JSON.stringify(prev.formData, null, 2),
				formError: undefined as string | undefined,
			}));
		});
	};

	private renderVisualForm(jsonSchema: RJSFSchema, uiSchema: UiSchema) {
		return (
			<Form
				ref={this.formRef}
				schema={jsonSchema}
				uiSchema={uiSchema}
				formData={this.state.formData}
				validator={validator}
				onChange={this.handleChange}
				onBlur={this.handleFormBlur}
				widgets={widgets}
				fields={fields}
				templates={templates}
				formContext={{
					...this.props.formContext,
					rootFormData: this.state.formData,
					updateFormData: this.handlePathUpdate,
					requestImmediateCommit: this.requestImmediateCommit,
					registerArrayAdd: this.registerArrayAdd,
				}}
				className="cgenh-rjsf-form"
				liveValidate="onBlur"
				transformErrors={this.transformErrors}
				showErrorList={false}
			>
				<></>
			</Form>
		);
	}

	render() {
		const {
			configKey,
			onClose,
			onBack,
			backTitle,
			embedded = false,
			showHeader = true,
			title: titleOverride,
			description: descriptionOverride,
		} = this.props;
		const { schema: jsonSchema, uiSchema } = this.getSchemaPair();
		const title = titleOverride ?? jsonSchema.title ?? configKey;
		const description = descriptionOverride ?? jsonSchema.description;
		const resolvedBackTitle = onBack ? (backTitle ?? translation.common.back.getTrans()) : undefined;
		const canUndo = this.formHistory.canUndo();
		const canRedo = this.formHistory.canRedo();
		const canToggleJson = this.getEditorMode() === 'toggle';
		const historyControls = (
			<FormHistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={this.handleUndo} onRedo={this.handleRedo} />
		);

		if (embedded) {
			return (
				<div ref={this.containerRef} className="card shadow-sm">
					<div className="card-header d-flex align-items-center justify-content-between gap-2 py-1">
						{showHeader && (
							<div className="min-w-0">
								<p className="mb-0 fw-semibold text-truncate">{title}</p>
								{description && <p className="mb-0 mt-1 text-body-secondary small">{description}</p>}
							</div>
						)}
						{canToggleJson && (
							<Tooltip content={this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
								<button type="button" className="btn btn-sm btn-outline-secondary p-1" onClick={this.toggleJsonEditor} onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}>
									{this.state.showJsonEditor ? <SvgListBox aria-hidden="true" /> : <SvgCodeBrackets aria-hidden="true" />}
								</button>
							</Tooltip>
						)}
					</div>
					<div className="card-body p-2 d-flex flex-column gap-2">
						<div className="d-flex align-items-center justify-content-between">{historyControls}</div>
						{this.state.showJsonEditor ? (
							<MonacoEditorComponent value={this.state.jsonText} error={this.state.jsonError} onChange={this.handleJsonChange} onCommit={this.commitFormData} compact />
						) : (
							this.renderVisualForm(jsonSchema, uiSchema)
						)}
						{this.state.formError && <div className="alert alert-danger py-1 mb-0" role="alert">{this.state.formError}</div>}
						<div className="d-flex justify-content-end gap-2">
							<button type="button" className="btn btn-sm btn-outline-secondary" onClick={this.handleSave}>{translation.common.save.getTrans()}</button>
							<button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>{translation.common.close.getTrans()}</button>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div ref={this.containerRef} className="modal-content d-flex flex-column h-100">
				<ConfigsPanelHeader title={title} description={description} onClose={onClose} onBack={onBack} backTitle={resolvedBackTitle} controls={historyControls} showClose={false} />
				<div className={[
					'modal-body', 'flex-grow-1', 'd-flex', 'flex-column', 'gap-2', 'cgenh-modal-body',
					this.state.showJsonEditor ? 'cgenh-modal-body--flush' : '',
					this.state.showJsonEditor ? 'cgenh-modal-body--no-scroll' : 'cgenh-modal-body--scroll',
				].filter(Boolean).join(' ')}>
					{this.state.showJsonEditor ? (
						<MonacoEditorComponent className="flex-grow-1" value={this.state.jsonText} error={this.state.jsonError} onChange={this.handleJsonChange} onCommit={this.commitFormData} fill />
					) : (
						this.renderVisualForm(jsonSchema, uiSchema)
					)}
					{this.state.formError && <div className="alert alert-danger py-1 mb-0" role="alert">{this.state.formError}</div>}
				</div>
				<div className="modal-footer d-flex align-items-center justify-content-between">
					<div>
						{canToggleJson && (
							<Tooltip content={this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
								<button type="button" className="btn btn-sm btn-outline-secondary p-1" onClick={this.toggleJsonEditor} onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}>
									{this.state.showJsonEditor ? <SvgListBox aria-hidden="true" /> : <SvgCodeBrackets aria-hidden="true" />}
								</button>
							</Tooltip>
						)}
					</div>
					<div className="d-flex gap-2">
						<button type="button" className="btn btn-outline-secondary" onClick={this.handleSave}>{translation.common.save.getTrans()}</button>
						<button type="button" className="btn btn-outline-secondary" onClick={onClose}>{translation.common.close.getTrans()}</button>
					</div>
				</div>
			</div>
		);
	}
}