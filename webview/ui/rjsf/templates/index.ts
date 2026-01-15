import React from 'react';

export { ArrayFieldItemTemplate, ArrayFieldTemplate } from './ArrayFieldTemplate';
export { FieldTemplate } from './FieldTemplate';
export { ObjectFieldTemplate } from './ObjectFieldTemplate';

/**
 * Custom description template that returns null - we show descriptions via InfoTooltip in FieldTemplate
 */

export class DescriptionFieldTemplate extends React.PureComponent {
	render(): null {
		return null;
	}
}
