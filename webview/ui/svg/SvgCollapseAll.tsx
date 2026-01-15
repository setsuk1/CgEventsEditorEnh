import React from 'react';

export class SvgCollapseAll extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg
				{...rest}
				width={width ?? 14}
				height={height ?? 14}
				viewBox="0 0 16 16"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect x="3" y="7" width="10" height="2" rx="0.6" />
			</svg>
		);
	}
}

