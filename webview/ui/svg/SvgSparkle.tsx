import React from 'react';

export class SvgSparkle extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg
				{...rest}
				width={width ?? 16}
				height={height ?? 16}
				viewBox="0 0 16 16"
				fill="#FFC400"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M7.5 1L8.5 4.5L12 5.5L8.5 6.5L7.5 10L6.5 6.5L3 5.5L6.5 4.5L7.5 1Z" />
				<path d="M13.5 9L14 11L16 11.5L14 12L13.5 14L13 12L11 11.5L13 11L13.5 9Z" />
				<path d="M3.5 10L4 11.5L6 12L4 12.5L3.5 14L3 12.5L1 12L3 11.5L3.5 10Z" />
			</svg>
		);
	}
}

