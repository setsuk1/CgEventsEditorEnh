import React from 'react';

export class SvgMoreVertical extends React.PureComponent<React.SVGProps<SVGSVGElement>> {
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
				<path d="M8 8.99991C8.55228 8.99991 9 8.55219 9 7.99991C9 7.44762 8.55228 6.99991 8 6.99991C7.44772 6.99991 7 7.44762 7 7.99991C7 8.55219 7.44772 8.99991 8 8.99991Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M8 3.99991C8.55228 3.99991 9 3.55219 9 2.99991C9 2.44762 8.55228 1.99991 8 1.99991C7.44772 1.99991 7 2.44762 7 2.99991C7 3.55219 7.44772 3.99991 8 3.99991Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				<path d="M8 13.9999C8.55228 13.9999 9 13.5522 9 12.9999C9 12.4476 8.55228 11.9999 8 11.9999C7.44772 11.9999 7 12.4476 7 12.9999C7 13.5522 7.44772 13.9999 8 13.9999Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		);
	}
}

