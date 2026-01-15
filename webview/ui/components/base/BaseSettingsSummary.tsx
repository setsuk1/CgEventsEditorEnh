import { getSelectedLanguage } from '@shared';
import React from 'react';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { SvgEdit } from '../../svg/SvgEdit';

interface ConfigSummaryItem {
	key: string;
	label: string;
	value: unknown;
}

interface BaseSettingsSummaryProps {
	stage: any;
	preload: any;
	onOpen(): void;
	totalResources?: number;
	configList?: ConfigSummaryItem[];
	onOpenConfig?: (key: string) => void;
	baseLabel?: string;
}

export class BaseSettingsSummary extends React.PureComponent<BaseSettingsSummaryProps, {}> {
	private formatResolution(value: unknown): string {
		if (typeof value !== 'string') {
			return value ? String(value) : '-';
		}
		switch (value) {
			case 'showAll':
				return translation.settings.resolutionModes.showAll.getTrans();
			case 'exactFit':
				return translation.settings.resolutionModes.exactFit.getTrans();
			case 'noBorder':
				return translation.settings.resolutionModes.noBorder.getTrans();
			case 'fixedWidth':
				return translation.settings.resolutionModes.fixedWidth.getTrans();
			case 'fixedHeight':
				return translation.settings.resolutionModes.fixedHeight.getTrans();
			case 'origin':
				return translation.settings.resolutionModes.origin.getTrans();
			default:
				return value || '-';
		}
	}

	private formatAlign(value: unknown): string {
		if (typeof value !== 'string') {
			return value ? String(value) : '-';
		}
		switch (value) {
			case 'left':
				return translation.settings.align.left.getTrans();
			case 'center':
				return translation.settings.align.center.getTrans();
			case 'right':
				return translation.settings.align.right.getTrans();
			case 'top':
				return translation.settings.align.top.getTrans();
			case 'middle':
				return translation.settings.align.middle.getTrans();
			case 'bottom':
				return translation.settings.align.bottom.getTrans();
			default:
				return value || '-';
		}
	}

	private getResourcesInfo(preload: any, totalResources: number) {
		const excludedCount = Array.isArray(preload?.resourcesExclude) ? preload.resourcesExclude.length : 0;
		const includedResources = Math.max(0, totalResources - excludedCount);
		const sourcesCount = Array.isArray(preload?.sources) ? preload.sources.length : 0;
		return { includedResources, sourcesCount };
	}

	private buildBaseSummary(stage: any, preload: any, totalResources: number): string {
		const languageCode = getSelectedLanguage()?.code ?? '';
		const size = `${stage?.width ?? '-'}x${stage?.height ?? '-'}`;
		const resolution = this.formatResolution(stage?.resolutionPolicy);
		const alignment = `${this.formatAlign(stage?.alignHorizontal)}/${this.formatAlign(stage?.alignVertical)}`;
		const { includedResources, sourcesCount } = this.getResourcesInfo(preload, totalResources);
		if (languageCode.startsWith('zh')) {
			return `舞台 ${size}, ${resolution}, ${alignment}, 預先載入 ${includedResources}個資源及 ${sourcesCount}個原始碼`;
		}
		return `Stage ${size}, ${resolution}, ${alignment}, preload ${includedResources} resources and ${sourcesCount} sources`;
	}

	private getConfigPreview(value: unknown): string {
		try {
			const serialized = JSON.stringify(value);
			if (typeof serialized === 'string' && serialized.length > 0) {
				return serialized;
			}
		} catch {
			// ignore errors
		}
		return '-';
	}

	render() {
		const {
			stage,
			preload,
			onOpen,
			totalResources = 0,
			configList = [],
			onOpenConfig,
			baseLabel,
		} = this.props;
		const baseTitle = baseLabel || translation.settings.baseSettingsTitle.getTrans();
		const summaryLine = this.buildBaseSummary(stage, preload, totalResources);
		const items: Array<{ key: string; label: string; summary: string; onClick(): void }> = [
			{
				key: 'base',
				label: baseTitle,
				summary: summaryLine,
				onClick: onOpen,
			},
			...configList.map((item) => ({
				key: item.key,
				label: item.label || item.key,
				summary: this.getConfigPreview(item.value),
				onClick: () => (onOpenConfig ? onOpenConfig(item.key) : onOpen()),
			})),
		];

		return (
			<section className="cgenh-base-settings-summary">
				<div className="cgenh-base-settings-summary__panel">
					{items.map((item) => (
						<div key={item.key} className="cgenh-base-settings-summary__row">
							<button
								type="button"
								className="cgenh-base-settings-summary__primary"
								onClick={item.onClick}
								title={item.label}
								onMouseEnter={playMouseHoverAudio}
								onMouseDown={playMouseDownAudio}
							>
								<SvgEdit
									className="cgenh-base-settings-summary__icon"
									width={14}
									height={14}
									aria-hidden="true"
								/>
								<span className="cgenh-base-settings-summary__label">{item.label}</span>
							</button>
							<span className="cgenh-base-settings-summary__summary" title={item.summary}>
								{item.summary}
							</span>
						</div>
					))}
				</div>
			</section>
		);
	}
}
