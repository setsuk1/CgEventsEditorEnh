import React from 'react';

export class SvgMoveUpFilled extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 4l-5 5h3v4h4v-4h3L8 4z" />
			</svg>
		);
	}
}

