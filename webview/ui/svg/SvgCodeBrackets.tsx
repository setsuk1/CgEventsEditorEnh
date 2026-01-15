import React from 'react';

export class SvgCodeBrackets extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 16} height={height ?? 16} viewBox="0 0 16 16" fill="currentColor">
				<path d="M5 3l-4 5l4 5l1-1l-3-4l3-4L5 3zm6 0l-1 1l3 4l-3 4l1 1l4-5l-4-5z" />
			</svg>
		);
	}
}

