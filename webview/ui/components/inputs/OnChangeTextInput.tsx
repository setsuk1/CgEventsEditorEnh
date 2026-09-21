import React from 'react';
import { createPortal } from 'react-dom';
import { CAPTURED_SCROLL_EVENT, winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { DynamicStyle } from '../../utils/dynamicStyles';
import { AnimationFrameTask } from '../../utils/AnimationFrameTask';
import { resolveSuggestionDropdownLayout } from './SuggestionDropdownLayout';
import {
	canShowTextSuggestions,
	filterTextSuggestions,
	getTextHighlightSegments,
	sortTextSuggestions,
	textSuggestionsEqual,
	type TextSuggestion,
} from './TextInputSuggestions';

interface OnChangeTextInputProps {
	id?: string;
	value: any;
	textarea?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	placeholder?: string;
	required?: boolean;
	onChange(value: string): void;
	suggestions?: TextSuggestion[];
	suggestFilter?: 'none';
	onDraftChange?(value: string): void;
}

interface OnChangeTextInputState {
	value: string;
	showSuggestions: boolean;
	filteredSuggestions: TextSuggestion[];
}

export class OnChangeTextInput extends React.Component<OnChangeTextInputProps, OnChangeTextInputState> {
	private inputRef = React.createRef<HTMLInputElement>();
	private readonly positionFrame = new AnimationFrameTask();
	private viewportListenersAttached = false;
	private dropdownStyle = new DynamicStyle('cgenh-suggestion-dropdown');
	private dropdownCss = '';
	private sortedSuggestionsSource?: TextSuggestion[];
	private sortedSuggestions: TextSuggestion[] = [];

	constructor(props: OnChangeTextInputProps) {
		super(props);
		const value = String(props.value ?? '');
		this.state = {
			value,
			showSuggestions: false,
			filteredSuggestions: this.getFilteredSuggestions(value, props),
		};
	}

	componentDidUpdate(prevProps: OnChangeTextInputProps) {
		const suggestionsUnavailable = !canShowTextSuggestions(this.props);
		if (suggestionsUnavailable && (this.state.showSuggestions || this.viewportListenersAttached)) {
			this.detachViewportListeners();
			if (this.state.showSuggestions) this.setState({ showSuggestions: false });
		}

		if (prevProps.value !== this.props.value) {
			const value = String(this.props.value ?? '');
			if (value !== this.state.value) {
				this.setState({ value, filteredSuggestions: this.getFilteredSuggestions(value) });
				return;
			}
		}

		if (prevProps.suggestions !== this.props.suggestions || prevProps.suggestFilter !== this.props.suggestFilter) {
			if (!this.props.suggestions?.length) {
				this.detachViewportListeners();
				if (this.state.showSuggestions || this.state.filteredSuggestions.length) {
					this.setState({ showSuggestions: false, filteredSuggestions: [] });
				}
				return;
			}
			const filteredSuggestions = this.getFilteredSuggestions(this.state.value);
			if (!textSuggestionsEqual(this.state.filteredSuggestions, filteredSuggestions)) {
				this.setState({ filteredSuggestions });
			}
		}
	}

	componentWillUnmount() {
		this.detachViewportListeners();
		this.positionFrame.cancel();
		this.dropdownStyle.dispose();
	}

	private getSortedSuggestions(suggestions: TextSuggestion[]): TextSuggestion[] {
		if (this.sortedSuggestionsSource !== suggestions) {
			this.sortedSuggestionsSource = suggestions;
			this.sortedSuggestions = sortTextSuggestions(suggestions);
		}
		return this.sortedSuggestions;
	}

	private getFilteredSuggestions(input: string, props = this.props): TextSuggestion[] {
		const suggestions = props.suggestions;
		if (!suggestions?.length) return [];
		if (props.suggestFilter === 'none') return this.getSortedSuggestions(suggestions);
		return filterTextSuggestions(input, suggestions);
	}

	private attachViewportListeners(): void {
		if (this.viewportListenersAttached) return;
		this.viewportListenersAttached = true;
		winEE.on('resize', this.handleViewportChange);
		winEE.on(CAPTURED_SCROLL_EVENT, this.handleViewportChange);
	}

	private detachViewportListeners(): void {
		if (!this.viewportListenersAttached) return;
		this.viewportListenersAttached = false;
		winEE.off('resize', this.handleViewportChange);
		winEE.off(CAPTURED_SCROLL_EVENT, this.handleViewportChange);
	}

	private showSuggestions = (): void => {
		if (!canShowTextSuggestions(this.props)) return;
		this.attachViewportListeners();
		if (!this.state.showSuggestions) this.setState({ showSuggestions: true });
		this.scheduleDropdownPositionUpdate();
	};

	private hideSuggestions = () => {
		this.detachViewportListeners();
		if (this.state.showSuggestions) this.setState({ showSuggestions: false });
	};

	private handleViewportChange = () => {
		this.scheduleDropdownPositionUpdate();
	};

	private scheduleDropdownPositionUpdate = () => {
		this.positionFrame.schedule(() => this.calculateDropdownPosition());
	};

	private calculateDropdownPosition = () => {
		const input = this.inputRef.current;
		if (!input || !this.state.showSuggestions) return;

		const rect = input.getBoundingClientRect();
		const layout = resolveSuggestionDropdownLayout(
			{ left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width },
			{ width: window.innerWidth, height: window.innerHeight },
		);
		const cssText = layout.placeBelow
			? `position: fixed; left: ${layout.left}px; top: ${rect.bottom}px; bottom: auto; width: ${layout.width}px; right: auto; max-height: ${layout.maxHeight}px; overflow-y: auto; z-index: 2000;`
			: `position: fixed; left: ${layout.left}px; top: auto; bottom: ${window.innerHeight - rect.top}px; width: ${layout.width}px; right: auto; max-height: ${layout.maxHeight}px; overflow-y: auto; z-index: 2000;`;

		if (this.dropdownCss !== cssText) {
			this.dropdownCss = cssText;
			this.dropdownStyle.update(cssText);
		}
	};

	private handleFocus = () => {
		this.setState({ filteredSuggestions: this.getFilteredSuggestions(this.state.value) }, this.showSuggestions);
	};

	private handleInputChange = (value: string) => {
		this.props.onDraftChange?.(value);
		const hasSuggestions = canShowTextSuggestions(this.props);
		this.setState({
			value,
			filteredSuggestions: this.getFilteredSuggestions(value),
			showSuggestions: hasSuggestions,
		});
		if (hasSuggestions) {
			this.attachViewportListeners();
			this.scheduleDropdownPositionUpdate();
		} else {
			this.detachViewportListeners();
		}
	};

	private commitValue = () => {
		if (this.props.disabled || this.props.readOnly) return;
		const next = this.state.value;
		if (next !== String(this.props.value ?? '')) this.props.onChange(next);
	};

	private handleBlur = () => {
		this.commitValue();
		this.hideSuggestions();
	};

	private handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key === 'Enter' && !this.props.textarea) this.commitValue();
		if (event.key === 'Escape') this.hideSuggestions();
	};

	private handleSuggestionMouseDown = (event: React.MouseEvent, suggestion: TextSuggestion) => {
		event.preventDefault();
		if (this.props.disabled || this.props.readOnly) {
			this.hideSuggestions();
			return;
		}
		const value = suggestion.value;
		this.detachViewportListeners();
		this.setState({
			value,
			showSuggestions: false,
			filteredSuggestions: this.getFilteredSuggestions(value),
		}, () => {
			this.props.onChange(value);
			this.inputRef.current?.focus();
		});
	};

	render() {
		const { id, textarea, suggestions, disabled, readOnly, placeholder, required } = this.props;
		const { value, showSuggestions, filteredSuggestions } = this.state;

		if (textarea) {
			return (
				<textarea
					className="form-control form-control-sm"
					value={value}
					onChange={(e) => this.handleInputChange(e.target.value)}
					onBlur={this.handleBlur}
					onKeyDown={this.handleKeyDown}
					rows={3}
					id={id}
					disabled={disabled}
					readOnly={readOnly}
					placeholder={placeholder}
					required={required}
				/>
			);
		}

		const hasSuggestions = canShowTextSuggestions({ suggestions, disabled, readOnly, textarea });
		const renderHighlightedText = (text: string) =>
			getTextHighlightSegments(text, value).map((segment, index) =>
				segment.match ? (
					<mark key={index} className="bg-warning-subtle px-0">{segment.text}</mark>
				) : segment.text
			);
		return (
			<div className="position-relative">
				<input
					className="form-control form-control-sm"
					type="text"
					id={id}
					value={value}
					onChange={(e) => this.handleInputChange(e.target.value)}
					onFocus={this.handleFocus}
					onBlur={this.handleBlur}
					onKeyDown={this.handleKeyDown}
					autoComplete="off"
					disabled={disabled}
					readOnly={readOnly}
					placeholder={placeholder}
					required={required}
					ref={this.inputRef}
				/>
				{hasSuggestions && showSuggestions && createPortal(
					<ul className={`dropdown-menu show shadow ${this.dropdownStyle.className}`}>
						{filteredSuggestions.length > 0 ? (
							filteredSuggestions.map((suggestion) => {
								const hasLabel = suggestion.label !== undefined && suggestion.label !== null;
								const labelText = hasLabel ? String(suggestion.label) : suggestion.value;
								const showRawValue = hasLabel && labelText !== suggestion.value;
								const wrapRawValueInParens = showRawValue && labelText.trim() !== '';
								return (
									<li key={suggestion.value} onMouseDown={(e) => this.handleSuggestionMouseDown(e, suggestion)}>
										<button type="button" className="dropdown-item d-flex align-items-start justify-content-between gap-2">
											<span className="text-truncate">{renderHighlightedText(labelText)}</span>
											{showRawValue ? (
												<small className="text-body-secondary text-truncate">
													{wrapRawValueInParens ? (
														<>({renderHighlightedText(suggestion.value)})</>
													) : renderHighlightedText(suggestion.value)}
												</small>
											) : null}
										</button>
									</li>
								);
							})
						) : (
							<li className="dropdown-item-text text-body-secondary fst-italic">
								{translation.validation.noMatches.getTrans()}
							</li>
						)}
					</ul>,
					document.body
				)}
			</div>
		);
	}
}
