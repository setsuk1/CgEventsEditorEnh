import React from 'react';

export class SvgRemoveX extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M11.854 4.146a.5.5 0 010 .708L8.707 8l3.147 3.146a.5.5 0 01-.708.708L8 8.707l-3.146 3.147a.5.5 0 01-.708-.708L7.293 8 4.146 4.854a.5.5 0 11.708-.708L8 7.293l3.146-3.147a.5.5 0 01.708 0z" />
			</svg>
		);
	}
}

