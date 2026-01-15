import React from 'react';
import { createPortal } from 'react-dom';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { DynamicStyle } from '../../utils/dynamicStyles';

interface Suggestion {
	value: string;
	label?: string;
}

interface OnChangeTextInputProps {
	id?: string;
	value: any;
	textarea?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	placeholder?: string;
	required?: boolean;
	onChange(value: string): void;
	suggestions?: Suggestion[];
	suggestFilter?: 'none';
	onDraftChange?(value: string): void;
}

interface OnChangeTextInputState {
	value: string;
	showSuggestions: boolean;
	filteredSuggestions: Suggestion[];
}

/**
 * Mimics native onChange behavior (fires on commit) while keeping suggestions.
 * Internal state tracks typing; external value updates resync when changed.
 */
export class OnChangeTextInput extends React.Component<OnChangeTextInputProps, OnChangeTextInputState> {
	private containerRef = React.createRef<HTMLDivElement>();
	private dropdownRef = React.createRef<HTMLUListElement>();
	private inputRef = React.createRef<HTMLInputElement>();
	private rafId: number | null = null;
	private dropdownStyle = new DynamicStyle('cgenh-suggestion-dropdown');
	private dropdownCss = '';

	constructor(props: OnChangeTextInputProps) {
		super(props);
		this.state = {
			value: String(props.value ?? ''),
			showSuggestions: false,
			filteredSuggestions: props.suggestions || [],
		};
	}

	componentDidMount() {
		document.addEventListener('mousedown', this.handleClickOutside);
		winEE.on('resize', this.handleWindowResize, this);
		winEE.on('scroll', this.handleWindowScroll, this);
	}

	componentDidUpdate(prevProps: OnChangeTextInputProps) {
		if (prevProps.value !== this.props.value) {
			const nextVal = String(this.props.value ?? '');
			if (nextVal !== this.state.value) {
				this.setState({ value: nextVal }, () => this.filterSuggestions(nextVal));
			}
		}
		if (prevProps.suggestions !== this.props.suggestions) {
			this.filterSuggestions(this.state.value);
		}
	}

	componentWillUnmount() {
		document.removeEventListener('mousedown', this.handleClickOutside);
		winEE.off('resize', this.handleWindowResize, this);
		winEE.off('scroll', this.handleWindowScroll, this);
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.dropdownStyle.dispose();
	}

	private hideSuggestions = () => {
		if (this.state.showSuggestions) {
			this.setState({ showSuggestions: false });
		}
	};

	private handleClickOutside = (event: MouseEvent) => {
		if (!event.target || !(event.target instanceof Node)) {
			return;
		}
		const target = event.target;
		const container = this.containerRef.current;
		const dropdown = this.dropdownRef.current;
		const clickedInsideContainer = container ? container.contains(target) : false;
		const clickedInsideDropdown = dropdown ? dropdown.contains(target) : false;
		if (!clickedInsideContainer && !clickedInsideDropdown) {
			this.commitValue();
			this.hideSuggestions();
		}
	};

	private handleViewportChange = () => {
		if (!this.state.showSuggestions) {
			return;
		}
		this.scheduleDropdownPositionUpdate();
	};

	private handleWindowResize(this: OnChangeTextInput) {
		this.handleViewportChange();
	}

	private handleWindowScroll(this: OnChangeTextInput) {
		this.handleViewportChange();
	}

	private scheduleDropdownPositionUpdate = () => {
		if (this.rafId !== null) {
			return;
		}
		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = null;
			this.calculateDropdownPosition();
		});
	};

	private calculateDropdownPosition = () => {
		const input = this.inputRef.current;
		if (!input) return;

		const rect = input.getBoundingClientRect();
		const viewportPadding = 8;
		const dropdownMaxHeight = 200;

		let left = rect.left;
		let width = rect.width;

		if (left + width > window.innerWidth - viewportPadding) {
			left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
		}
		if (left < viewportPadding) {
			left = viewportPadding;
		}
		width = Math.min(width, window.innerWidth - left - viewportPadding);

		const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
		const spaceAbove = rect.top - viewportPadding;
		const placeBelow = spaceBelow >= dropdownMaxHeight || spaceBelow >= spaceAbove;
		const maxHeight = Math.max(
			Math.min(dropdownMaxHeight, placeBelow ? spaceBelow : spaceAbove),
			80
		);

		const cssText = placeBelow
			? [
					'position: fixed;',
					`left: ${left}px;`,
					`top: ${rect.bottom}px;`,
					'bottom: auto;',
					`width: ${width}px;`,
					'right: auto;',
					`max-height: ${maxHeight}px;`,
					'overflow-y: auto;',
					'z-index: 2000;',
				].join(' ')
			: [
					'position: fixed;',
					`left: ${left}px;`,
					'top: auto;',
					`bottom: ${window.innerHeight - rect.top}px;`,
					`width: ${width}px;`,
					'right: auto;',
					`max-height: ${maxHeight}px;`,
					'overflow-y: auto;',
					'z-index: 2000;',
				].join(' ');

		if (this.dropdownCss !== cssText) {
			this.dropdownCss = cssText;
			this.dropdownStyle.update(cssText);
		}
	};

	private handleFocus = () => {
		this.calculateDropdownPosition();
		this.filterSuggestions(this.state.value);
		if (this.props.suggestions?.length) {
			this.setState({ showSuggestions: true });
		}
	};

	private handleInputChange = (value: string) => {
		this.calculateDropdownPosition();
		this.setState({ value }, () => this.filterSuggestions(value));
		this.props.onDraftChange?.(value);
		if (this.props.suggestions?.length) {
			this.setState({ showSuggestions: true });
		}
	};

	private commitValue = () => {
		const next = this.state.value;
		const current = String(this.props.value ?? '');
		if (next !== current) {
			this.props.onChange(next);
		}
	};

	private handleBlur = () => {
		this.commitValue();
		this.hideSuggestions();
	};

	private handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !this.props.textarea) {
			this.commitValue();
			this.scheduleDropdownPositionUpdate();
		}
		if (event.key === 'Escape') {
			this.scheduleDropdownPositionUpdate();
		}
	};

	private filterSuggestions = (input: string) => {
		const { suggestions, suggestFilter } = this.props;
		if (!suggestions) {
			this.setState({ filteredSuggestions: [] });
			return;
		}

		// When suggestFilter is 'none', don't filter and just sort
		if (suggestFilter === 'none') {
			const sorted = [...suggestions].sort((a, b) => a.value.localeCompare(b.value));
			this.setState({ filteredSuggestions: sorted });
			return;
		}

		const lowercasedInput = String(input ?? '').toLowerCase();
		const filtered = suggestions.filter(
			(suggestion) =>
				suggestion.value.toLowerCase().includes(lowercasedInput) ||
				(suggestion.label && suggestion.label.toLowerCase().includes(lowercasedInput))
		);
		this.setState({ filteredSuggestions: filtered });
	};

	private handleSuggestionMouseDown = (event: React.MouseEvent, suggestion: Suggestion) => {
		event.preventDefault();

		const next = suggestion.value;
		this.setState({ value: next, showSuggestions: false }, () => {
			this.props.onChange(next);
			this.filterSuggestions(next);
			this.inputRef.current?.focus();
		});
	};

	private renderHighlightedText(text: string, query: string): React.ReactNode {
		const raw = String(text ?? '');
		const needle = String(query ?? '').trim();
		if (!needle) {
			return raw;
		}

		const lower = raw.toLowerCase();
		const lowerNeedle = needle.toLowerCase();
		const nodes: React.ReactNode[] = [];
		let cursor = 0;
		let matchIndex = lower.indexOf(lowerNeedle, cursor);
		let key = 0;

		while (matchIndex !== -1) {
			if (matchIndex > cursor) {
				nodes.push(raw.slice(cursor, matchIndex));
			}
			nodes.push(
				<mark key={`m-${key++}`} className="bg-warning-subtle px-0">
					{raw.slice(matchIndex, matchIndex + needle.length)}
				</mark>
			);
			cursor = matchIndex + needle.length;
			matchIndex = lower.indexOf(lowerNeedle, cursor);
		}

		if (cursor < raw.length) {
			nodes.push(raw.slice(cursor));
		}

		return nodes;
	}

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

		const hasSuggestions = suggestions && suggestions.length > 0;

		return (
			<div className="position-relative" ref={this.containerRef}>
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
				{hasSuggestions &&
					showSuggestions &&
					createPortal(
						<ul className={`dropdown-menu show shadow ${this.dropdownStyle.className}`} ref={this.dropdownRef}>
							{filteredSuggestions.length > 0 ? (
								filteredSuggestions.map((suggestion) => {
									const hasLabel = suggestion.label !== undefined && suggestion.label !== null;
									const labelText = hasLabel ? String(suggestion.label) : suggestion.value;
									const showRawValue = hasLabel && labelText !== suggestion.value;
									const wrapRawValueInParens = showRawValue && labelText.trim() !== '';
									return (
										<li
											key={suggestion.value}
											onMouseDown={(e) => this.handleSuggestionMouseDown(e, suggestion)}
										>
											<button type="button" className="dropdown-item d-flex align-items-start justify-content-between gap-2">
												<span className="text-truncate">
													{this.renderHighlightedText(labelText, value)}
												</span>
												{showRawValue ? (
													<small className="text-body-secondary text-truncate">
														{wrapRawValueInParens ? (
															<>
																(
																{this.renderHighlightedText(suggestion.value, value)}
																)
															</>
														) : (
															this.renderHighlightedText(suggestion.value, value)
														)}
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