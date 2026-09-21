import { WidgetProps } from '@rjsf/utils';
import React from 'react';
import { translation } from '../../../trans/Trans';

interface JSONWidgetState {
	text: string;
	error: string | null;
}

/**
 * Custom JSON editor widget for RJSF
 */
export class JSONWidget extends React.PureComponent<WidgetProps, JSONWidgetState> {
	private blurTimer: number | null = null;

	constructor(props: WidgetProps) {
		super(props);
		this.state = {
			text: this.serializeValue(props.value),
			error: null,
		};
	}

	componentDidUpdate(prevProps: WidgetProps): void {
		if (prevProps.value === this.props.value) return;
		const nextText = this.serializeValue(this.props.value);
		if (nextText !== this.state.text) this.setState({ text: nextText, error: null });
	}

	componentWillUnmount(): void {
		if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
	}

	private serializeValue(value: unknown): string {
		if (typeof value === 'string') return value;
		try {
			const serialized = JSON.stringify(value ?? {}, null, 2);
			return typeof serialized === 'string' ? serialized : '{}';
		} catch {
			return '{}';
		}
	}

	private handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		this.setState({ text: e.target.value, error: null });
	};

	private handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
		if (this.props.disabled || this.props.readonly) return;
		const { id, onBlur, onChange } = this.props;
		const text = event.currentTarget.value;
		let value: any;
		try {
			value = JSON.parse(text || '{}');
		} catch (error) {
			const message = error instanceof Error
				? error.message
				: translation.validation.invalidJson.getTrans();
			this.setState({ error: message });
			return;
		}
		onChange(value);
		if (typeof onBlur === 'function' && typeof id === 'string' && id) {
			if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
			this.blurTimer = window.setTimeout(() => {
				this.blurTimer = null;
				onBlur(id, value);
			}, 0);
		}
	};

	render() {
		const { id, disabled, readonly } = this.props;
		const { text, error } = this.state;
		return (
			<div className="vstack gap-2">
				<textarea
					id={id}
					value={text}
					disabled={disabled || readonly}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					className={`form-control form-control-sm font-monospace${error ? ' is-invalid' : ''}`}
					rows={8}
					spellCheck={false}
				/>
				{error && <div className="invalid-feedback d-block">{error}</div>}
			</div>
		);
	}
}
