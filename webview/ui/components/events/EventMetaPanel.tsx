import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, RegistryWidgetsType, RJSFSchema, TemplatesType, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { getSelectedLanguage, ICgEvent, ICgEventsSchemaEntry, ObjectUtil } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SvgCodeBrackets } from '../../svg/SvgCodeBrackets';
import { SvgListBox } from '../../svg/SvgListBox';
import { HelperField } from '../../rjsf/fields';
import { convertSchemaEntry } from '../../rjsf/schemaConverter';
import { ArrayFieldItemTemplate, ArrayFieldTemplate, DescriptionFieldTemplate, FieldTemplate, ObjectFieldTemplate } from '../../rjsf/templates';
import { hasBooleanChange, isRecord } from '../../rjsf/utils/rjsfUtils';
import { pruneHiddenFields } from '../../rjsf/utils/visibleOption';
import { ColorWidget } from '../../rjsf/widgets/ColorWidget';
import { DatalistWidget } from '../../rjsf/widgets/DatalistWidget';
import { HelperWidget } from '../../rjsf/widgets/HelperWidget';
import { JSONWidget } from '../../rjsf/widgets/JSONWidget';
import { SelectWidget } from '../../rjsf/widgets/SelectWidget';
import { FormHistory } from '../../utils/formHistory';
import { handleEnterCommitShortcut, handleUndoRedoShortcuts } from '../../utils/formUndoRedo';
import { acquireModalLock } from '../../utils/modalLock';
import { EVENT_FOLDER_REGEX, EVENT_NAME_REGEX } from '../../utils/validators';
import { FormHistoryControls } from '../common/FormHistoryControls';
import { MonacoEditorComponent } from '../common/MonacoEditorComponent';
import { Tooltip } from '../common/Tooltip';
import { transformRjsfValidationErrors } from '../../rjsf/utils/rjsfErrorTransform';

// Import the Event definition schema
import eventSchemaJson from '@media/json/event.enheditor.schema.json';

interface EventMetaPanelProps {
	eventId: string;
	onClose(): void;
	onEditAsJson?(): void;
}

interface EventMetaPanelState {
	formData: any;
	jsonText: string;
	jsonError?: string;
	showJsonEditor: boolean;
	formError?: string;
}

// Custom widgets registry
const widgets: RegistryWidgetsType = {
	color: ColorWidget,
	helper: HelperWidget,
	datalist: DatalistWidget,
	json: JSONWidget,
	select: SelectWidget,
};

// Custom fields registry
const fields: RegistryFieldsType = {
	helper: HelperField,
};

// Custom templates
const templates: Partial<TemplatesType> = {
	ArrayFieldItemTemplate,
	ArrayFieldTemplate,
	DescriptionFieldTemplate,
	FieldTemplate,
	ObjectFieldTemplate,
};

/**
 * Get the first definition entry with use="config" from the event schema
 */
function getEventDefinitionEntry(): ICgEventsSchemaEntry | undefined {
	const definitions = eventSchemaJson?.definition;
	if (!definitions || typeof definitions !== 'object') {
		return undefined;
	}
	for (const entry of Object.values(definitions)) {
		if (entry && typeof entry === 'object' && 'use' in entry && entry.use === 'config') {
			return entry as ICgEventsSchemaEntry;
		}
	}
	return undefined;
}

/**
 * Build default values from schema
 */
function buildDefaultValues(schema: RJSFSchema): Record<string, any> {
	const result: Record<string, any> = {};
	if (!schema.properties) return result;

	for (const [key, prop] of Object.entries(schema.properties)) {
		if (typeof prop === 'boolean') continue;

		if (prop.default !== undefined) {
			result[key] = prop.default;
		} else if (Array.isArray(prop.enum) && prop.enum.length > 0) {
			result[key] = prop.enum[0];
		} else if (prop.type === 'boolean') {
			result[key] = false;
		} else if (prop.type === 'number' || prop.type === 'integer') {
			result[key] = 0;
		} else if (prop.type === 'string') {
			result[key] = '';
		}
	}
	return result;
}

/**
 * Convert event data to form data format
 */
function eventToFormData(event: ICgEvent): Record<string, any> {
	return {
		id: event.id ?? '',
		disabled: !!event.disabled,
		folder: event.folder ?? '',
		startTime: event.startTime ?? 0,
		checkInterval: event.checkInterval ?? 10,
		repeats: event.repeats ?? 0,
		repeatInterval: event.repeatInterval ?? 0,
		devOnly: !!event.devOnly,
		referenceOnly: event.referenceOnly ? 1 : 0,
		color: event.color ?? '#ffffff',
	};
}

/**
 * Convert form data back to event patch
 */
function formDataToEventPatch(formData: Record<string, any>): Partial<ICgEvent> {
	const patch: Partial<ICgEvent> = {};
	if (Object.prototype.hasOwnProperty.call(formData, 'id') && typeof formData.id === 'string') {
		patch.id = formData.id.trim();
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'disabled')) {
		patch.disabled = !!formData.disabled;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'folder')) {
		patch.folder = typeof formData.folder === 'string' ? formData.folder.trim() : '';
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'startTime') && typeof formData.startTime === 'number') {
		patch.startTime = formData.startTime;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'checkInterval') && typeof formData.checkInterval === 'number') {
		patch.checkInterval = formData.checkInterval;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'repeats') && typeof formData.repeats === 'number') {
		patch.repeats = formData.repeats;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'repeatInterval') && typeof formData.repeatInterval === 'number') {
		patch.repeatInterval = formData.repeatInterval;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'devOnly')) {
		patch.devOnly = !!formData.devOnly;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'referenceOnly')) {
		patch.referenceOnly = formData.referenceOnly === 1;
	}
	if (Object.prototype.hasOwnProperty.call(formData, 'color') && typeof formData.color === 'string') {
		patch.color = formData.color;
	}
	return patch;
}

export class EventMetaPanel extends React.PureComponent<EventMetaPanelProps, EventMetaPanelState> {
	private releaseModalLock: (() => void) | null = null;
	private formHistory: FormHistory<any>;
	private containerRef = React.createRef<HTMLDivElement>();
	private formRef = React.createRef<Form<any>>();
	private cachedJsonSchema: RJSFSchema = { type: 'object' };
	private cachedUiSchema: UiSchema = {};
	private cachedLanguageCode?: string;
	private pendingArrayCommit = false;

	constructor(props: EventMetaPanelProps) {
		super(props);
		this.ensureSchemaCache();
		const event = this.getEventSnapshot(props.eventId);
		const initialFormData = this.buildInitialFormData(event);
		this.formHistory = new FormHistory(initialFormData, this.forceUpdate.bind(this));
		this.state = {
			formData: initialFormData,
			jsonText: this.stringifyEvent(event),
			jsonError: undefined,
			showJsonEditor: false,
			formError: undefined,
		};
	}

	componentDidMount(): void {
		this.releaseModalLock = acquireModalLock();
		winEE.on('keydown', this.handleKeyDown, this);
	}

	componentDidUpdate(prevProps: EventMetaPanelProps) {
		if (prevProps.eventId !== this.props.eventId) {
			const nextEvent = this.getEventSnapshot(this.props.eventId);
			const nextFormData = this.buildInitialFormData(nextEvent);
			this.formHistory.reset(nextFormData);
			this.setState({
				formData: nextFormData,
				jsonText: this.stringifyEvent(nextEvent),
				jsonError: undefined,
				showJsonEditor: false,
				formError: undefined,
			});
		}
	}

	componentWillUnmount(): void {
		winEE.off('keydown', this.handleKeyDown, this);
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private buildSchemaCache() {
		const entry = getEventDefinitionEntry();
		if (entry) {
			const { schema, uiSchema } = convertSchemaEntry(entry, {});
			this.cachedJsonSchema = schema;
			this.cachedUiSchema = this.buildEnhancedUiSchema(uiSchema);
		}
	}

	private ensureSchemaCache() {
		const languageCode = getSelectedLanguage().code;
		if (this.cachedLanguageCode === languageCode && Object.keys(this.cachedUiSchema).length > 0) {
			return;
		}
		this.cachedLanguageCode = languageCode;
		this.buildSchemaCache();
	}

	private buildEnhancedUiSchema(uiSchema: UiSchema): UiSchema {
		const enhanced: UiSchema = ObjectUtil.deepCloneObject(uiSchema);
		const addLanguageCode = (schema: any) => {
			if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
			for (const key of Object.keys(schema)) {
				if (key.startsWith('ui:')) continue;
				const field = schema[key];
				if (field && typeof field === 'object' && !Array.isArray(field)) {
					if (field['ui:widget'] === 'helper') {
						const options = field['ui:options'];
						field['ui:options'] = isRecord(options) ? { ...options } : {};
					}
					addLanguageCode(field);
				}
			}
		};
		addLanguageCode(enhanced);
		return enhanced;
	}

	private buildInitialFormData(event: ICgEvent): Record<string, any> {
		const defaults = buildDefaultValues(this.cachedJsonSchema);
		const eventData = eventToFormData(event);
		return { ...defaults, ...eventData };
	}

	private handleKeyDown(event: KeyboardEvent) {
		if (handleUndoRedoShortcuts(event, this.containerRef.current, this.handleUndo, this.handleRedo)) {
			return;
		}
		handleEnterCommitShortcut(event, this.containerRef.current, this.handleEnterCommit);
	}

	private handleEnterCommit = () => {
		this.syncFormDataFromRef(() => this.commitFormData(true));
	};

	private getEventSnapshot(eventId: string): ICgEvent {
		const event = editor.getEventById(eventId);
		if (event) {
			return event;
		}
		return {
			id: eventId,
			folder: '',
			disabled: false,
			startTime: 0,
			checkInterval: 10,
			repeats: 0,
			repeatInterval: 0,
			devOnly: false,
			referenceOnly: false,
			color: '#ffffff',
			triggers: [],
			checks: [],
			actions: [],
		};
	}

	private stringifyEvent(event: ICgEvent) {
		try {
			return JSON.stringify(event ?? {}, null, 2);
		} catch {
			return '';
		}
	}

	private handleUndo = () => {
		this.commitFormData();
		const snapshot = this.formHistory.undo();
		if (!snapshot) return;
		this.setState((prev) => ({
			formData: snapshot,
			jsonText: prev.showJsonEditor ? JSON.stringify(this.formDataToEvent(snapshot), null, 2) : prev.jsonText,
			jsonError: undefined,
			formError: undefined,
		}), this.validateForm);
	};

	private handleRedo = () => {
		this.commitFormData();
		const snapshot = this.formHistory.redo();
		if (!snapshot) return;
		this.setState((prev) => ({
			formData: snapshot,
			jsonText: prev.showJsonEditor ? JSON.stringify(this.formDataToEvent(snapshot), null, 2) : prev.jsonText,
			jsonError: undefined,
			formError: undefined,
		}), this.validateForm);
	};

	private validateForm = () => {
		if (this.state.showJsonEditor) {
			return;
		}
		this.formRef.current?.validateForm();
	};

	private commitFormData = (trigger?: string | boolean) => {
		if (this.state.showJsonEditor && this.state.jsonError) {
			return;
		}
		let snapshot = this.state.formData;
		if (!this.state.showJsonEditor) {
			const formSnapshot = this.formRef.current?.state.formData;
			if (formSnapshot !== undefined) {
				snapshot = formSnapshot;
			}
		}
		const pushed = this.formHistory.push(snapshot);
		if (trigger === true && pushed) {
			this.validateForm();
		}
	};

	private commitArrayChange = () => {
		if (this.state.showJsonEditor && this.state.jsonError) {
			return;
		}
		this.pendingArrayCommit = true;
	};

	private handleFormBlur = (_id?: string, _value?: any) => {
		this.syncFormDataFromRef(() => this.commitFormData(true));
	};

	private syncFormDataFromRef = (afterApply?: () => void) => {
		const form = this.formRef.current;
		if (!form) {
			return;
		}
		this.applyFormData(form.state.formData, afterApply);
	};

	private applyFormData(nextData: Record<string, any>, afterApply?: () => void) {
		this.setState((prev) => ({
			formData: nextData,
			jsonText: prev.showJsonEditor ? JSON.stringify(this.formDataToEvent(nextData), null, 2) : prev.jsonText,
			jsonError: undefined,
			formError: undefined,
		}), afterApply);
	}

	private isSelectChange(id?: string): boolean {
		if (!id) {
			return false;
		}
		const element = document.getElementById(id);
		return element instanceof HTMLSelectElement;
	}

	private handleChange = (event: IChangeEvent, id?: string) => {
		const shouldCommitArray = this.pendingArrayCommit;
		const shouldApply = shouldCommitArray || this.isSelectChange(id) || hasBooleanChange(this.state.formData, event.formData);
		if (!shouldApply) {
			return;
		}
		this.pendingArrayCommit = false;
		this.applyFormData(event.formData, () => this.commitFormData(true));
	};

	private getRequiredErrorMessage(): string {
		const code = getSelectedLanguage().code;
		if (code.startsWith('zh')) {
			return '必填';
		}
		return 'Required';
	}

	private transformErrors = (errors: any) => {
		if (!Array.isArray(errors)) {
			return errors;
		}
		return transformRjsfValidationErrors(errors, this.getRequiredErrorMessage());
	};

	private formDataToEvent(formData: Record<string, any>): ICgEvent {
		const current = this.getEventSnapshot(this.props.eventId);
		const patch = formDataToEventPatch(formData);
		return { ...current, ...patch };
	}

	private handleJsonChange = (text: string) => {
		try {
			const parsed = JSON.parse(text || '{}');
			const formData = eventToFormData(parsed);
			this.setState({
				jsonText: text,
				jsonError: undefined,
				formData,
				formError: undefined,
			});
		} catch (err) {
			this.setState({
				jsonText: text,
				jsonError: err instanceof Error ? err.message : translation.validation.invalidJson.getTrans(),
			});
		}
	};

	private handleSave = () => {
		const formSnapshot = this.state.showJsonEditor ? undefined : this.formRef.current?.state.formData;
		const formData = formSnapshot ?? this.state.formData;
		const nextId = typeof formData.id === 'string' ? formData.id.trim() : '';

		if (!nextId) {
			this.setState({ formError: translation.events.eventNameRequired.getTrans() });
			return;
		}
		if (!EVENT_NAME_REGEX.test(nextId)) {
			this.setState({ formError: translation.events.eventNameInvalid.getTrans() });
			return;
		}
		const events = editor.getEvents();
		const collision = events.some((evt) => evt.id === nextId && evt.id !== this.props.eventId);
		if (collision) {
			this.setState({ formError: translation.events.eventNameExists.getTrans() });
			return;
		}
		const folder = typeof formData.folder === 'string' ? formData.folder.trim() : '';
		if (!EVENT_FOLDER_REGEX.test(folder)) {
			this.setState({ formError: translation.events.folderNameInvalid.getTrans() });
			return;
		}

		const prunedFormData = pruneHiddenFields(formData, this.cachedUiSchema, formData);
		const patch = formDataToEventPatch(prunedFormData);
		editor.updateEvent(this.props.eventId, patch);
		this.props.onClose();
	};

	private toggleJsonEditor = () => {
		this.setState((prev) => ({
			showJsonEditor: !prev.showJsonEditor,
			jsonError: undefined,
			jsonText: prev.showJsonEditor
				? prev.jsonText
				: JSON.stringify(this.formDataToEvent(prev.formData), null, 2),
		}));
	};

	render() {
		this.ensureSchemaCache();
		const { onClose } = this.props;
		const canUndo = this.formHistory.canUndo();
		const canRedo = this.formHistory.canRedo();

		return (
			<>
				<div
					className="modal show d-block"
					role="dialog"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) {
							onClose();
						}
					}}
				>
					<div
						className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
						role="document"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<div ref={this.containerRef} className="modal-content d-flex flex-column h-100">
							<div className="modal-header d-flex align-items-center justify-content-between">
								<div className="me-auto">
									<div className="text-body-secondary small">{translation.events.editEvent.getTrans()}</div>
									<h5 className="modal-title mb-0">{this.props.eventId}</h5>
								</div>
								<FormHistoryControls
									canUndo={canUndo}
									canRedo={canRedo}
									onUndo={this.handleUndo}
									onRedo={this.handleRedo}
								/>
							</div>

							<div
								className={[
									'modal-body',
									'cgenh-modal-body',
									this.state.showJsonEditor ? 'cgenh-modal-body--no-scroll' : 'cgenh-modal-body--scroll',
									this.state.showJsonEditor ? 'cgenh-modal-body--flush' : '',
									'd-flex',
									'flex-column',
									this.state.showJsonEditor ? '' : 'gap-3',
								].filter(Boolean).join(' ')}
							>
								{this.state.showJsonEditor ? (
									<MonacoEditorComponent
										className="flex-grow-1"
										value={this.state.jsonText}
										error={this.state.jsonError}
										onChange={this.handleJsonChange}
										onCommit={this.commitFormData}
										compact
										fill
									/>
								) : (
									<>
										<Form
											ref={this.formRef}
											schema={this.cachedJsonSchema}
											uiSchema={this.cachedUiSchema}
											formData={this.state.formData}
											validator={validator}
											onChange={this.handleChange}
											onBlur={this.handleFormBlur}
											widgets={widgets}
											fields={fields}
											templates={templates}
											formContext={{
												rootFormData: this.state.formData,
												commitArrayChange: this.commitArrayChange,
											}}
											className="cgenh-rjsf-form"
											liveValidate="onBlur"
											transformErrors={this.transformErrors}
											showErrorList={false}
										>
											<></>
										</Form>
										{this.state.formError && (
											<div className="alert alert-danger py-1 mb-0" role="alert">
												{this.state.formError}
											</div>
										)}
									</>
								)}
							</div>

							<div className="modal-footer justify-content-between">
								<Tooltip content={this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary p-1"
										onClick={this.toggleJsonEditor}
									>
										{this.state.showJsonEditor ? (
											<SvgListBox aria-hidden="true" />
										) : (
											<SvgCodeBrackets aria-hidden="true" />
										)}
									</button>
								</Tooltip>
								<div className="d-flex gap-2">
									<button type="button" className="btn btn-sm btn-outline-secondary" onClick={this.handleSave}>
										{translation.common.save.getTrans()}
									</button>
									<button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
										{translation.common.close.getTrans()}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="modal-backdrop show" />
			</>
		);
	}
}
