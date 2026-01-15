import React from 'react';

export class SvgRedo extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M9 3v3h4l-4 4-1-1 3-3H9V3zM5 8a2 2 0 0 0 0 4h2v1H5a3 3 0 0 1 0-6h6v1H5z" />
			</svg>
		);
	}
}

