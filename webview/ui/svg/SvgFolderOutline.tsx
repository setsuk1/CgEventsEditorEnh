import React from 'react';

export class SvgFolderOutline extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
	render() {
		const { width, height, ...rest } = this.props;
		return (
			<svg
				{...rest}
				width={width ?? 16}
				height={height ?? 16}
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M2.5 4.5H6.1L7.6 6H13.5C14.0523 6 14.5 6.44772 14.5 7V12C14.5 12.5523 14.0523 13 13.5 13H2.5C1.94772 13 1.5 12.5523 1.5 12V5.5C1.5 4.94772 1.94772 4.5 2.5 4.5Z"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
}

