import React from 'react';

export class SvgPlus extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 3v5H3v2h5v5h2v-5h5V8H10V3H8z" />
			</svg>
		);
	}
}

