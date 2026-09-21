import sortingSchema from '@media/json/sorting.enheditor.schema.json';
import { type ISortingPreset, type ISortingRule } from '@shared';
import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgTrash } from '../../svg/SvgTrash';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';

interface EventsSortingModalsProps {
	sortingOpen: boolean;
	sortingRules: ISortingRule[];
	onSortingUpdate(patch: Record<string, any>): void;
	onCloseSorting(): void;
	saveOpen: boolean;
	loadOpen: boolean;
	confirmOpen: boolean;
	presets: ISortingPreset[];
	currentPresetName?: string;
	defaultPresetSelected: boolean;
	presetNameInput: string;
	presetNameInputRef: React.RefObject<HTMLInputElement>;
	confirmMessage: string;
	onCloseSave(): void;
	onPresetNameBlur(): void;
	onPresetNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void;
	onSelectPresetName(name: string): void;
	onSavePreset(): void;
	onCloseLoad(): void;
	onLoadDefaultPreset(): void;
	onLoadPreset(preset: ISortingPreset): void;
	onDeletePreset(name: string): void;
	onConfirmCancel(): void;
	onConfirm(): void;
}

export function EventsSortingModals(props: EventsSortingModalsProps): React.ReactNode {
	return (
		<>
			{props.sortingOpen && (
				<>
					<div
						className="modal show d-block"
						role="dialog"
						onMouseDown={(event) => {
							if (event.target === event.currentTarget) props.onCloseSorting();
						}}
					>
						<div
							className="modal-dialog modal-lg modal-dialog-centered cgenh-modal-dialog"
							role="document"
							onMouseDown={(event) => event.stopPropagation()}
						>
							<RJSFConfigsPanel
								configs={{ EventSortingRuleSet: { rules: props.sortingRules } }}
								configKey="EventSortingRuleSet"
								schema={sortingSchema}
								schemaSection="definition"
								onUpdate={props.onSortingUpdate}
								onClose={props.onCloseSorting}
							/>
						</div>
					</div>
					<div className="modal-backdrop show" />
				</>
			)}

			{props.saveOpen && (
				<>
					<div
						className="modal show d-block"
						role="dialog"
						onMouseDown={(event) => {
							if (event.target === event.currentTarget) props.onCloseSave();
						}}
					>
						<div className="modal-dialog modal-dialog-centered" role="document" onMouseDown={(event) => event.stopPropagation()}>
							<div className="modal-content">
								<div className="modal-header">
									<h5 className="modal-title">{translation.events.sorting.savePreset.getTrans()}</h5>
									<button type="button" className="btn-close" onClick={props.onCloseSave} aria-label={translation.common.close.getTrans()} />
								</div>
								<div className="modal-body">
									<div className="mb-3">
										<label htmlFor="preset-name-input" className="form-label">{translation.events.sorting.presetName.getTrans()}</label>
										<input
											ref={props.presetNameInputRef}
											type="text"
											className="form-control"
											id="preset-name-input"
											defaultValue={props.presetNameInput}
											onBlur={props.onPresetNameBlur}
											onKeyDown={props.onPresetNameKeyDown}
											placeholder={translation.events.sorting.presetNamePlaceholder.getTrans()}
											autoFocus
										/>
									</div>
									{props.presets.length > 0 && (
										<div>
											<label className="form-label">{translation.events.sorting.existingPresets.getTrans()}</label>
											<div className="list-group list-group-flush cgenh-modal-scroll-list">
												{props.presets.map((preset) => (
													<button
														key={preset.name}
														type="button"
														className="list-group-item list-group-item-action py-2"
														onClick={() => props.onSelectPresetName(preset.name)}
													>
														{preset.name}
													</button>
												))}
											</div>
										</div>
									)}
								</div>
								<div className="modal-footer">
									<button type="button" className="btn btn-secondary" onClick={props.onCloseSave}>{translation.common.cancel.getTrans()}</button>
									<button type="button" className="btn btn-primary" onClick={props.onSavePreset}>{translation.common.save.getTrans()}</button>
								</div>
							</div>
						</div>
					</div>
					<div className="modal-backdrop show" />
				</>
			)}

			{props.loadOpen && (
				<>
					<div
						className="modal show d-block"
						role="dialog"
						onMouseDown={(event) => {
							if (event.target === event.currentTarget) props.onCloseLoad();
						}}
					>
						<div className="modal-dialog modal-dialog-centered" role="document" onMouseDown={(event) => event.stopPropagation()}>
							<div className="modal-content">
								<div className="modal-header">
									<h5 className="modal-title">{translation.events.sorting.loadPreset.getTrans()}</h5>
									<button type="button" className="btn-close" onClick={props.onCloseLoad} aria-label={translation.common.close.getTrans()} />
								</div>
								<div className="modal-body">
									<div className="cgenh-preset-list">
										<div
											className={`cgenh-preset-item${props.defaultPresetSelected ? ' cgenh-preset-item--selected' : ''}`}
											onClick={props.onLoadDefaultPreset}
										>
											<span className="cgenh-preset-item__name">{translation.events.sorting.defaultPreset.getTrans()}</span>
											<span className="cgenh-preset-item__badge">Default</span>
										</div>
										{props.presets.map((preset) => (
											<div
												key={preset.name}
												className={`cgenh-preset-item${props.currentPresetName === preset.name ? ' cgenh-preset-item--selected' : ''}`}
												onClick={() => props.onLoadPreset(preset)}
											>
												<span className="cgenh-preset-item__name">{preset.name}</span>
												<button
													type="button"
													className="cgenh-preset-item__delete"
													onClick={(event) => {
														event.stopPropagation();
														props.onDeletePreset(preset.name);
													}}
													title={translation.events.sorting.deletePreset.getTrans()}
												>
													<SvgTrash width={14} height={14} aria-hidden="true" />
												</button>
											</div>
										))}
										{props.presets.length === 0 && (
											<div className="cgenh-preset-empty">{translation.events.sorting.noPresets.getTrans()}</div>
										)}
									</div>
								</div>
								<div className="modal-footer">
									<button type="button" className="btn btn-secondary" onClick={props.onCloseLoad}>{translation.common.close.getTrans()}</button>
								</div>
							</div>
						</div>
					</div>
					<div className="modal-backdrop show" />
				</>
			)}

			{props.confirmOpen && (
				<>
					<div
						className="modal show d-block cgenh-modal--confirm"
						role="dialog"
						onMouseDown={(event) => {
							if (event.target === event.currentTarget) props.onConfirmCancel();
						}}
					>
						<div className="modal-dialog modal-dialog-centered modal-sm" role="document" onMouseDown={(event) => event.stopPropagation()}>
							<div className="modal-content">
								<div className="modal-header">
									<h5 className="modal-title">{translation.common.confirm.getTrans()}</h5>
									<button type="button" className="btn-close" onClick={props.onConfirmCancel} aria-label={translation.common.close.getTrans()} />
								</div>
								<div className="modal-body"><p className="mb-0">{props.confirmMessage}</p></div>
								<div className="modal-footer">
									<button type="button" className="btn btn-secondary" onClick={props.onConfirmCancel}>{translation.common.cancel.getTrans()}</button>
									<button type="button" className="btn btn-primary" onClick={props.onConfirm}>{translation.common.confirm.getTrans()}</button>
								</div>
							</div>
						</div>
					</div>
					<div className="modal-backdrop show cgenh-modal-backdrop--confirm" />
				</>
			)}
		</>
	);
}
