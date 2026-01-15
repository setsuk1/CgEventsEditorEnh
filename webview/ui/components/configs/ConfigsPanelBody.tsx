import React from 'react';

interface ConfigsPanelBodyProps {
	children: React.ReactNode;
	className?: string;
}

export class ConfigsPanelBody extends React.PureComponent<ConfigsPanelBodyProps> {
	render() {
		const { children, className } = this.props;
		return (
			<div className={`modal-body ${className ?? ''}`}>
				{children}
			</div>
		);
	}
}
