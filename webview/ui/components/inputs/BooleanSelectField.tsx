import React from 'react';
import { translation } from '../../../trans/Trans';

interface BooleanSelectFieldProps {
	value: any;
	onChange(value: any): void;
}

export class BooleanSelectField extends React.PureComponent<BooleanSelectFieldProps, {}> {
	render() {
		const { value, onChange } = this.props;
		return (
			<select
				className="form-select form-select-sm"
				value={value ? 'true' : 'false'}
				onChange={(e) => onChange(e.target.value)}
			>
				<option value="true">{translation.state.booleanTrue.getTrans()}</option>
				<option value="false">{translation.state.booleanFalse.getTrans()}</option>
			</select>
		);
	}
}