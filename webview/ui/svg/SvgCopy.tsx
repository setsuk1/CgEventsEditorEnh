import React from 'react';

export class SvgCopy extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M4 2v10h8V2H4zm7 9H5V3h6v8zM2 4v10h8v-1H3V4H2z" />
			</svg>
		);
	}
}

