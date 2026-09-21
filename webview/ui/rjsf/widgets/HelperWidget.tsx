import { WidgetProps } from '@rjsf/utils';
import { getSelectedLanguage } from '@shared';
import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgSparkle } from '../../svg/SvgSparkle';
import { Tooltip } from '../../components/common/Tooltip';
import { HelperSelectorModal } from '../../components/helpers/HelperSelectorModal';
import { HelperViewer } from '../../components/helpers/HelperViewer';
import { normalizeHelperSelection } from '../../components/helpers/HelperViewerData';
import {
	coerceHelperWidgetSelection,
	normalizeHelperWidgetOptions,
	parseHelperInfo,
	parseHelperWidgetValue,
	resolveHelperPreviewLayout,
	shouldPreserveHelperArraySelection,
} from './HelperWidgetData';

interface HelperWidgetState {
	showSelector: boolean;
	pendingValue: any;
}

export class HelperWidget extends React.PureComponent<WidgetProps, HelperWidgetState> {
	private previewRef = React.createRef<HelperViewer>();
	private selectorRef = React.createRef<HelperViewer>();
	private blurTimer: number | null = null;

	constructor(props: WidgetProps) {
		super(props);
		this.state = {
			showSelector: false,
			pendingValue: undefined,
		};
	}

	componentDidUpdate(): void {
		if (this.state.showSelector && (this.props.disabled || this.props.readonly)) {
			this.closeSelector();
		}
	}

	componentWillUnmount(): void {
		if (this.blurTimer !== null) {
			window.clearTimeout(this.blurTimer);
			this.blurTimer = null;
		}
	}

	private getLocale(): 'en' | 'zh' {
		const code = getSelectedLanguage()?.code;
		return code && code.startsWith('zh') ? 'zh' : 'en';
	}

	private scheduleBlur(value: any): void {
		const { id, onBlur } = this.props;
		if (typeof onBlur !== 'function' || typeof id !== 'string' || !id) return;
		if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
		this.blurTimer = window.setTimeout(() => {
			this.blurTimer = null;
			onBlur(id, value);
		}, 0);
	}

	private handleSelect = (incoming: any) => {
		if (this.props.disabled || this.props.readonly) {
			this.closeSelector();
			return;
		}
		const { schema, onChange } = this.props;
		const parsedValue = parseHelperWidgetValue(this.props.value, schema.default, schema.type);
		const preserveArraySelection = shouldPreserveHelperArraySelection(schema.type, parsedValue);
		const fromHelper = normalizeHelperSelection(
			incoming && incoming.data && incoming.data.data !== undefined ? incoming.data.data : incoming,
			preserveArraySelection
		);
		this.previewRef.current?.refreshWithValue(fromHelper);
		const outgoing = coerceHelperWidgetSelection(fromHelper, schema.type, this.props.value);
		onChange(outgoing);
		this.setState({ showSelector: false, pendingValue: undefined }, () => this.scheduleBlur(outgoing));
	};

	private openSelector = () => {
		if (this.props.disabled || this.props.readonly) return;
		this.setState({
			showSelector: true,
			pendingValue: parseHelperWidgetValue(this.props.value, this.props.schema.default, this.props.schema.type),
		});
	};

	private closeSelector = () => {
		this.setState({ showSelector: false, pendingValue: undefined });
	};

	private confirmSelector = () => {
		if (this.props.disabled || this.props.readonly) return;
		this.selectorRef.current?.requestJson();
	};

	private renderActionBar(selectionEnabled: boolean): React.ReactNode {
		if (!selectionEnabled) return null;
		return (
			<div>
				<Tooltip content={translation.common.openHelper.getTrans()}>
					<button
						type="button"
						className="btn btn-sm btn-outline-warning p-1"
						onClick={(event) => {
							event.stopPropagation();
							this.openSelector();
						}}
						onMouseDown={(event) => event.stopPropagation()}
						onMouseUp={(event) => event.stopPropagation()}
					>
						<SvgSparkle aria-hidden="true" />
					</button>
				</Tooltip>
			</div>
		);
	}

	render() {
		const { disabled, readonly, schema } = this.props;
		const widgetOptions = normalizeHelperWidgetOptions(this.props.options);
		const locale = this.getLocale();
		const parsedValue = parseHelperWidgetValue(this.props.value, schema.default, schema.type);
		const preserveArraySelection = shouldPreserveHelperArraySelection(schema.type, parsedValue);
		const selectHelperInfo = parseHelperInfo(widgetOptions.helper, 'helper', widgetOptions);
		const viewHelperInfo = parseHelperInfo(widgetOptions.format, 'format', widgetOptions);
		const selectionEnabled = !disabled && !readonly && !!selectHelperInfo;
		if (widgetOptions.compact) {
			if (!selectHelperInfo) return null;
			return (
				<div className="cgenh-helper-field">
					{this.renderActionBar(selectionEnabled)}
					<HelperSelectorModal
						open={this.state.showSelector}
						selectHelperInfo={selectHelperInfo}
						locale={locale}
						pendingValue={this.state.pendingValue}
						value={parsedValue}
						preserveArraySelection={preserveArraySelection}
						selectorRef={this.selectorRef}
						onClose={this.closeSelector}
						onConfirm={this.confirmSelector}
						onSelect={this.handleSelect}
					/>
				</div>
			);
		}

		const { widthValue, heightValue, helperName, style } = resolveHelperPreviewLayout(viewHelperInfo);
		const tightActions = selectionEnabled && !!viewHelperInfo && widthValue.trim() !== '100%';
		const previewClassName = tightActions ? 'cgenh-helper-field__preview cgenh-helper-field__preview--tight' : 'cgenh-helper-field__preview';
		const preview =
			parsedValue === undefined || parsedValue === null
				? '--'
				: typeof parsedValue === 'string'
					? parsedValue
					: JSON.stringify(parsedValue);

		return (
			<div className={helperName.includes('cgeditorlayout') ? 'cgenh-helper-field cgenh-helper-field--fullwidth' : 'cgenh-helper-field'}>
				<div className="cgenh-helper-field__layout">
					<div className={previewClassName}>
						{viewHelperInfo ? (
							<div className="cgenh-helper-field__viewer" style={style}>
								<HelperViewer
									ref={this.previewRef}
									helperInfo={viewHelperInfo}
									locale={locale}
									value={parsedValue}
									frameHeight={heightValue}
								/>
							</div>
						) : (
							<div className="border rounded p-2 bg-body-tertiary font-monospace small text-break">
								{preview}
							</div>
						)}
					</div>
					<div className="cgenh-helper-field__actions">
						{this.renderActionBar(selectionEnabled)}
					</div>
				</div>
				<HelperSelectorModal
					open={this.state.showSelector}
					selectHelperInfo={selectHelperInfo}
					locale={locale}
					pendingValue={this.state.pendingValue}
					value={parsedValue}
					preserveArraySelection={preserveArraySelection}
					selectorRef={this.selectorRef}
					onClose={this.closeSelector}
					onConfirm={this.confirmSelector}
					onSelect={this.handleSelect}
				/>
			</div>
		);
	}
}
