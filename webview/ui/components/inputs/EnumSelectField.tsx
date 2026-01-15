import React from 'react';

interface EnumSelectFieldProps {
	value: any;
	enumValues?: Array<string | number | boolean>;
	enumTitles?: string[];
	onChange(value: any): void;
}

export class EnumSelectField extends React.PureComponent<EnumSelectFieldProps> {
	render() {
		const { value, enumValues, enumTitles, onChange } = this.props;
		if (!enumValues || !enumValues.length) return null;
		return (
			<select
				className="form-select form-select-sm"
				value={value === undefined ? '' : String(value)}
				onChange={(e) => onChange(e.target.value)}
			>
				{enumValues.map((opt, idx) => (
					<option key={String(opt)} value={String(opt)}>
						{enumTitles?.[idx] ?? String(opt)}
					</option>
				))}
			</select>
		);
	}
}
