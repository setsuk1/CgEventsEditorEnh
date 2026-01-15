import React from 'react';

export class SvgLink extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg
				{...rest}
				width={width ?? 14}
				height={height ?? 14}
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M6.5 9.5L9.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M5.2 6.2L4.3 7.1C3.1 8.3 3.1 10.2 4.3 11.4C5.5 12.6 7.4 12.6 8.6 11.4L9.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M10.8 9.8L11.7 8.9C12.9 7.7 12.9 5.8 11.7 4.6C10.5 3.4 8.6 3.4 7.4 4.6L6.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		);
	}
}

