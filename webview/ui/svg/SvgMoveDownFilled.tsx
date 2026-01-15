import React from 'react';

export class SvgMoveDownFilled extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 12l5-5h-3V3H6v4H3l5 5z" />
			</svg>
		);
	}
}

