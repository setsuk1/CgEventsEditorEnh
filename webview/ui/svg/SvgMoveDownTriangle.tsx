import React from 'react';

export class SvgMoveDownTriangle extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
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
				<path d="M8 13L12 9H4L8 13Z" fill="currentColor" />
				<path d="M8 7V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			</svg>
		);
	}
}

