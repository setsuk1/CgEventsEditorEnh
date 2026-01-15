import React from 'react';

interface ColorInputFieldProps {
	value: any;
	onChange(value: string): void;
}

export class ColorInputField extends React.PureComponent<ColorInputFieldProps> {
	render() {
		return (
			<input
				className="form-control form-control-color"
				type="color"
				value={this.props.value ?? '#000000'}
				onChange={(e) => this.props.onChange(e.target.value)}
			/>
		);
	}
}
