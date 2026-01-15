import React from 'react';

export class SvgPlayCircle extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
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
				<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
				<path d="M7 5.6L11 8L7 10.4V5.6Z" fill="currentColor" />
			</svg>
		);
	}
}

