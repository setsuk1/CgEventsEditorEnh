import React from 'react';
import { translation } from '../../../trans/Trans';

interface AppLoadingScreenProps {
	overlay: boolean;
}

const LOADING_DOT_INDEXES = Array.from({ length: 12 }, (_, i) => i);

export class AppLoadingScreen extends React.PureComponent<AppLoadingScreenProps> {
	render() {
		const className = ['cgenh-loading-screen', this.props.overlay ? 'cgenh-loading-screen--overlay' : ''].filter(Boolean).join(' ');
		return (
			<div className={className}>
				<div className="cgenh-loading-image" aria-hidden="true">
					<div className="cgenh-loading-image__mask" />
				</div>
				<div className="cgenh-loading-content">
					<div className="cgenh-loading-spinner" role="status" aria-label={translation.app.loading.getTrans()}>
						{LOADING_DOT_INDEXES.map((index) => (
							<span key={`loading-dot-${index}`} className="cgenh-loading-dot" />
						))}
					</div>
					<div className="cgenh-loading-text text-body-secondary">{translation.app.loadingEvents.getTrans()}</div>
				</div>
			</div>
		);
	}
}

