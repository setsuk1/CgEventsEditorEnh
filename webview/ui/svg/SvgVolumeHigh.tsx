import React from 'react';

export class SvgVolumeHigh extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 16} height={height ?? 16} viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 2.5L4.5 5.5H2C1.45 5.5 1 5.95 1 6.5V9.5C1 10.05 1.45 10.5 2 10.5H4.5L8 13.5V2.5Z" />
				<path d="M10.5 6C11.3 6.8 11.3 9.2 10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
				<path d="M12.5 4C14 5.5 14 10.5 12.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
			</svg>
		);
	}
}

