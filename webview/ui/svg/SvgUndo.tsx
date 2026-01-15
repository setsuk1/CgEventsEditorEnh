import React from 'react';

export class SvgUndo extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg {...rest} width={width ?? 14} height={height ?? 14} viewBox="0 0 16 16" fill="currentColor">
				<path d="M7 3L3 7l4 4V8h4a3 3 0 1 1 0 6h-2v-1h2a2 2 0 1 0 0-4H7V3z" />
			</svg>
		);
	}
}

