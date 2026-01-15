import React from 'react';

interface NumberInputFieldProps {
	value: any;
	onChange(value: string): void;
}

export class NumberInputField extends React.PureComponent<NumberInputFieldProps> {
	render() {
		return (
			<input
				className="form-control form-control-sm"
				type="number"
				value={this.props.value ?? ''}
				onChange={(e) => this.props.onChange(e.target.value)}
			/>
		);
	}
}
