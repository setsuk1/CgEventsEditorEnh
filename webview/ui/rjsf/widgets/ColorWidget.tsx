import { WidgetProps } from '@rjsf/utils';
import React from 'react';

interface ColorWidgetState {
	draftText: string;
}

const COLOR_PICKER_VALUE = /^#[0-9a-f]{6}$/i;

/**
 * Custom color picker widget for RJSF
 */
export class ColorWidget extends React.PureComponent<WidgetProps, ColorWidgetState> {
	private blurTimer: number | null = null;

	constructor(props: WidgetProps) {
		super(props);
		this.state = {
			draftText: this.getEffectiveValue(props.value),
		};
	}

	componentDidUpdate(prevProps: WidgetProps): void {
		if (prevProps.value !== this.props.value) {
			const next = this.getEffectiveValue(this.props.value);
			if (next !== this.state.draftText) {
				this.setState({ draftText: next });
			}
		}
	}

	componentWillUnmount(): void {
		if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
	}

	private getEffectiveValue(value: unknown): string {
		return typeof value === 'string' && value ? value : '#000000';
	}

	private getPickerValue(value: string): string {
		return COLOR_PICKER_VALUE.test(value) ? value : '#000000';
	}

	private scheduleBlurCommit(id: string, value: string): void {
		if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
		this.blurTimer = window.setTimeout(() => {
			this.blurTimer = null;
			this.props.onBlur(id, value);
		}, 0);
	}

	private commitValue = (next: string) => {
		const { id, onChange } = this.props;
		onChange(next);
		if (id) this.scheduleBlurCommit(id, next);
	};

	private handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		this.commitValue(e.target.value);
	};

	private handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		this.setState({ draftText: e.target.value });
	};

	private commitDraftText = () => {
		const next = this.state.draftText;
		const current = this.getEffectiveValue(this.props.value);
		if (next === current) return;
		this.commitValue(next);
	};

	private handleTextBlur = () => {
		this.commitDraftText();
	};

	private handleTextKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key === 'Enter') this.commitDraftText();
	};

	render() {
		const { id, disabled, readonly } = this.props;
		const effectiveValue = this.getEffectiveValue(this.props.value);
		const pickerValue = this.getPickerValue(effectiveValue);

		return (
			<div className="input-group input-group-sm">
				<input
					type="color"
					id={`${id}-picker`}
					value={pickerValue}
					disabled={disabled || readonly}
					onChange={this.handlePickerChange}
					className="form-control form-control-color"
				/>
				<input
					type="text"
					id={id}
					value={this.state.draftText}
					disabled={disabled || readonly}
					onChange={this.handleTextChange}
					onBlur={this.handleTextBlur}
					onKeyDown={this.handleTextKeyDown}
					className="form-control font-monospace"
					placeholder="#000000"
				/>
			</div>
		);
	}
}
