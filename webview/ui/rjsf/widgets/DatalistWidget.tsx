import { WidgetProps } from '@rjsf/utils';
import React from 'react';
import { OnChangeTextInput } from '../../components/inputs/OnChangeTextInput';
import { isRecord } from '../utils/rjsfUtils';
import { buildWidgetSuggestionContext } from './suggestionUtils';

/**
 * Custom datalist widget for RJSF with autocomplete suggestions
 */
export class DatalistWidget extends React.PureComponent<WidgetProps> {
	private blurTimer: number | null = null;

	componentWillUnmount(): void {
		if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
	}

	private handleCommit = (next: string) => {
		const { id, onBlur, onChange } = this.props;
		onChange(next);
		if (typeof onBlur !== 'function' || typeof id !== 'string' || !id) return;
		if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
		this.blurTimer = window.setTimeout(() => {
			this.blurTimer = null;
			onBlur(id, next);
		}, 0);
	};

	render() {
		const { id, value, disabled, readonly, placeholder, required } = this.props;
		const rawOptions = isRecord(this.props.options) ? this.props.options : undefined;
		const suggestFilter = rawOptions?.suggestFilter === 'none' ? 'none' : undefined;
		const { suggestions } = buildWidgetSuggestionContext(this.props.options, this.props.registry?.formContext);

		return (
			<OnChangeTextInput
				id={id}
				value={value ?? ''}
				disabled={disabled}
				readOnly={readonly}
				placeholder={placeholder}
				required={required}
				suggestions={suggestions}
				suggestFilter={suggestFilter}
				onChange={this.handleCommit}
			/>
		);
	}
}
