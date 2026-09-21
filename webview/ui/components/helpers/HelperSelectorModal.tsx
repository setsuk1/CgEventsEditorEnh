import React from 'react';
import { translation } from '../../../trans/Trans';
import type { HelperInfo } from './HelperInfo';
import { HelperViewer } from './HelperViewer';
import { SelectorPanel } from './SelectorPanel';

interface HelperSelectorModalProps {
	open: boolean;
	selectHelperInfo?: HelperInfo | null;
	locale?: 'en' | 'zh';
	pendingValue: any;
	value: any;
	selectorRef: React.RefObject<HelperViewer>;
	preserveArraySelection?: boolean;
	onClose(): void;
	onConfirm(): void;
	onSelect(value: any): void;
}

export class HelperSelectorModal extends React.PureComponent<HelperSelectorModalProps, {}> {
	render() {
		const { open, selectHelperInfo, locale, pendingValue, value, selectorRef, preserveArraySelection, onClose, onConfirm, onSelect } = this.props;
		if (!open) return null;
		const effectiveLocale = locale === 'zh' ? 'zh' : 'en';
		return (
			<SelectorPanel
				open
				onClose={onClose}
				onConfirm={onConfirm}
				cancelLabel={translation.common.close.getTrans()}
				confirmLabel={translation.common.apply.getTrans()}
				showHeader={false}
			>
				<div className="cgenh-helper-viewer__container">
					<HelperViewer
						ref={selectorRef}
						onSelect={(next) => onSelect(next)}
						helperInfo={selectHelperInfo}
						locale={effectiveLocale}
						value={pendingValue ?? value}
						preserveArraySelection={preserveArraySelection}
						frameHeight="100%"
					/>
				</div>
			</SelectorPanel>
		);
	}
}
