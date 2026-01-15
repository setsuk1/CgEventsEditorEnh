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
	constructor(props: WidgetProps) {
		super(props);
		this.state = {
			text: this.serializeValue(props.value),
			error: null,
		};
	}

	componentDidUpdate(prevProps: WidgetProps): void {
		const nextText = this.serializeValue(this.props.value);
		if (nextText !== this.state.text) {
			this.setState({ text: nextText, error: null });
		}
	}

	private serializeValue(value: unknown): string {
		if (typeof value === 'string') {
			return value;
		}
		try {
			return JSON.stringify(value ?? {}, null, 2);
		} catch {
			return '{}';
		}
	}

	private handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newText = e.target.value;
		this.setState({ text: newText, error: null });
	};

	private handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
		const { id, onBlur, onChange } = this.props;
		const text = event.currentTarget.value;
		try {
			const parsed = JSON.parse(text || '{}');
			onChange(parsed);
			if (typeof onBlur === 'function' && typeof id === 'string' && id) {
				setTimeout(() => onBlur(id, parsed), 0);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : translation.validation.invalidJson.getTrans();
			this.setState({ error: message });
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
				{error && (
					<div className="invalid-feedback d-block">{error}</div>
				)}
			</div>
		);
	}
}
