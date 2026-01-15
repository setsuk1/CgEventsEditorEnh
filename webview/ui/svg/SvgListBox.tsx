import React from 'react';

export class SvgListBox extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 16} height={height ?? 16} viewBox="0 0 16 16" fill="currentColor">
				<path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z" />
				<path d="M1 1h14v14H1V1zm1 1v12h12V2H2z" fillOpacity="0.3" />
			</svg>
		);
	}
}

