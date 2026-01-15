import React from 'react';
import { translation } from '../../../trans/Trans';

interface ConfigListCardProps {
	configItems: Array<{ key: string; label: string }>;
	onOpenConfig(key: string): void;
}

export class ConfigListCard extends React.PureComponent<ConfigListCardProps, {}> {
	render() {
		const { configItems, onOpenConfig } = this.props;
		if (!configItems.length) return null;
		return (
			<div className="cgenh-base-settings__card">
				<div className="cgenh-base-settings__card-header">{translation.settings.configSection.getTrans()}</div>
				<ul className="cgenh-base-settings__config-list">
					{configItems.map((item) => (
						<li key={item.key} className="cgenh-base-settings__config-item">
							<span>{item.label || item.key}</span>
							<button type="button" onClick={() => onOpenConfig(item.key)}>{translation.common.edit.getTrans()}</button>
						</li>
					))}
				</ul>
			</div>
		);
	}
}