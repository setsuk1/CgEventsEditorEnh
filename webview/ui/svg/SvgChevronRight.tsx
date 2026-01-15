import React from 'react';

export class SvgChevronRight extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
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
				<path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		);
	}
}

