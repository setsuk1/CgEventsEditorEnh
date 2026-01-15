import React from 'react';

interface SummaryItemProps {
	label: string;
	value: React.ReactNode;
}

export class SummaryItem extends React.PureComponent<SummaryItemProps> {
	render() {
		return (
			<div>
				<div className="text-body-secondary small">{this.props.label}</div>
				<div className="fw-semibold">{this.props.value}</div>
			</div>
		);
	}
}
