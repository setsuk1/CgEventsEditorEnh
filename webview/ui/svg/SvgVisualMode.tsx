import React from 'react';

export class SvgVisualMode extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg
				{...rest}
				width={width ?? 16}
				height={height ?? 16}
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M3 3.5H13C13.5523 3.5 14 3.94772 14 4.5V11.5C14 12.0523 13.5523 12.5 13 12.5H3C2.44772 12.5 2 12.0523 2 11.5V4.5C2 3.94772 2.44772 3.5 3 3.5Z" stroke="currentColor" strokeWidth="1.4" />
				<path d="M4.5 6H11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
				<path d="M4.5 8H11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
				<path d="M4.5 10H9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
			</svg>
		);
	}
}

