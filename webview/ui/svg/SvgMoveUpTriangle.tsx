import React from 'react';

export class SvgMoveUpTriangle extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
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
				<path d="M8 3L4 7H12L8 3Z" fill="currentColor" />
				<path d="M8 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			</svg>
		);
	}
}

