import assert from 'node:assert/strict';
import test from 'node:test';
import type { RJSFSchema } from '@rjsf/utils';
import {
	hasStaticSelectOptions,
	resolveInitialSelectValue,
	resolveSelectEnumOptions,
	type InitialSelectValueInput,
} from '../webview/ui/rjsf/widgets/SelectWidgetData';

test('select options prefer explicit enum options over schema enums and suggestions', () => {
	const explicit = [{ value: 'explicit', label: 'Explicit' }];
	const schema: RJSFSchema = { enum: ['schema'] };
	assert.equal(hasStaticSelectOptions(schema, { enumOptions: explicit }), true);
	assert.equal(
		resolveSelectEnumOptions(schema, { enumOptions: explicit }, [{ value: 'suggested', label: 'Suggested' }]),
		explicit,
	);
});

test('select options build labels from option names, schema names, and values', () => {
	const schema: RJSFSchema = {
		enum: ['a', 'b'],
		enumNames: ['Schema A', 'Schema B'],
	};
	assert.deepEqual(
		resolveSelectEnumOptions(schema, { enumNames: ['Option A'] }, []),
		[
			{ value: 'a', label: 'Option A' },
			{ value: 'b', label: 'b' },
		],
	);
	assert.deepEqual(
		resolveSelectEnumOptions(schema, {}, []),
		[
			{ value: 'a', label: 'Schema A' },
			{ value: 'b', label: 'Schema B' },
		],
	);
});

test('select options use suggestions only when no static enum exists', () => {
	const schema: RJSFSchema = {};
	assert.equal(hasStaticSelectOptions(schema, {}), false);
	assert.deepEqual(
		resolveSelectEnumOptions(schema, {}, [{ value: 'one', label: 'One' }]),
		[{ value: 'one', label: 'One' }],
	);
	assert.equal(resolveSelectEnumOptions(schema, {}, []), undefined);
});

test('initial select value chooses the first enabled option for an empty field', () => {
	const enumOptions = [
		{ value: 'disabled', label: 'Disabled' },
		{ value: 'enabled', label: 'Enabled' },
	];
	assert.deepEqual(
		resolveInitialSelectValue({
			hasUserChanged: false,
			disabled: false,
			readonly: false,
			multiple: false,
			schemaDefault: undefined,
			currentValue: '',
			enumOptions,
			enumDisabled: ['disabled'],
		}),
		{ shouldApply: true, value: 'enabled' },
	);
});

test('initial select value preserves explicit, disabled, multiple, and defaulted states', () => {
	const enumOptions = [{ value: 'one', label: 'One' }];
	const base: InitialSelectValueInput<RJSFSchema> = {
		hasUserChanged: false,
		disabled: false,
		readonly: false,
		multiple: false,
		schemaDefault: undefined,
		currentValue: undefined,
		enumOptions,
	};
	assert.deepEqual(resolveInitialSelectValue({ ...base, currentValue: 'one' }), { shouldApply: false });
	assert.deepEqual(resolveInitialSelectValue({ ...base, currentValue: 'unknown' }), { shouldApply: false });
	assert.deepEqual(resolveInitialSelectValue({ ...base, disabled: true }), { shouldApply: false });
	assert.deepEqual(resolveInitialSelectValue({ ...base, readonly: true }), { shouldApply: false });
	assert.deepEqual(resolveInitialSelectValue({ ...base, multiple: true }), { shouldApply: false });
	assert.deepEqual(resolveInitialSelectValue({ ...base, schemaDefault: 'one' }), { shouldApply: false });
	assert.deepEqual(resolveInitialSelectValue({ ...base, hasUserChanged: true }), { shouldApply: false });
});
