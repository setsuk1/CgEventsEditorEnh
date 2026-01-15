import React from 'react';

export class SvgLoopIndicator extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg
				{...rest}
				width={width ?? 14}
				height={height ?? 14}
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M16.5 3.5H20v3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M19.5 12a7.5 7.5 0 0 1-12.6 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M7.5 20.5H4v-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		);
	}
}

