export interface ICgItemInfo {
	code: string;
	name: string;
	category: string;
	desc: string;
	iconUrl: string;
	order: number;
	status: string;
	validDays: number;
	limitPerUser: number;
	priceInGameDollar: number;
	priceInGltDollar: number;
}

export interface ICgItemInfoList {
	list: ICgItemInfo[];
}

export interface ICgShortResourceInfo {
	id: number;
	type: string;
	name: string;
	url: string;
	cdn: boolean;
}

export interface ICgLibRid {
	id: number;
	time: number;
};

export interface ICgResourceInfo extends ICgShortResourceInfo {
	meta: {
		files: string[];
		sizes?: number[];
		main: string;
		info?: any;
		devJs?: string;
		dts?: string;
		readme?: string;
		sounds?: any[];
		library?: Record<string, any>;
		thumb?: string;
		rids?: Record<string, ICgLibRid>;
		pcode?: string;
		ver?: string;
		jsTar?: string;
		integrity?: {
			main: string;
		};
		gitems?: number;
		[key: string]: any;
	};
	createTime: number;
}

export interface ICgLibInfo extends ICgShortResourceInfo {
	meta: {
		files: string[];
		sizes: number[];
		main: string;
		rids: Record<string, ICgLibRid>
		pcode: string;
		ver: string;
		jsTar: string;
		integrity: {
			main: string;
		};
		gitems?: number;
	};
	createTime: number;
}

export interface ICgAppInfo {
	projectCode: string;
	projectName: string;
	env: string;
	homeUrl: string;
	playerUrl: string;
	cdnUrl: string;
	svrUrl: string;
	depositUrl: string;
	appResourcePack: {
		aliasMap: Record<string, {
			prid?: number;
			resourceId: number;
			mode?: 'PLAY' | 'TEST';
			refr?: ICgShortResourceInfo;
			time?: number;
			pmeta?: [];
		}>;
		resourceMap: Record<number, ICgResourceInfo>;
	};
	appLibs: ICgLibInfo[];
	targetOrigin: string;
	mute: boolean;
	buildName: string;
	engineVersion: string;
	serverTime: number;
	projectDomain: string;
	supportDeveloperTool: boolean;
	locale: string;
	supportDevTools: boolean;
	srcUrlMap: Record<string, {
		url: string;
		crc: string;
	}>;
	entry: string;
}

function isRecord(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasInheritedEnumerableKeys(value: Record<string, any>): boolean {
	for (const key in value) {
		if (!Object.prototype.hasOwnProperty.call(value, key)) return true;
	}
	return false;
}

function isCgItemInfo(value: unknown): boolean {
	if (!isRecord(value) || typeof value.code !== 'string' || value.code.trim().length === 0) return false;
	if (value.name !== undefined && value.name !== null && typeof value.name !== 'string') return false;
	return value.iconUrl === undefined || value.iconUrl === null || typeof value.iconUrl === 'string';
}

function isCgResourceAlias(value: unknown): boolean {
	if (!isRecord(value) || !Number.isFinite(value.resourceId)) return false;
	return value.mode === undefined || value.mode === 'PLAY' || value.mode === 'TEST';
}

function isCgResourceInfo(value: unknown): boolean {
	return isRecord(value) && typeof value.type === 'string';
}

export function isCgItemInfoList(value: unknown): value is ICgItemInfoList {
	return isRecord(value) && Array.isArray(value.list) && value.list.every(isCgItemInfo);
}

export function isCgAppInfo(value: unknown): value is ICgAppInfo {
	if (!isRecord(value) || !isRecord(value.appResourcePack)) return false;
	if (value.projectCode !== undefined && typeof value.projectCode !== 'string') return false;
	const { aliasMap, resourceMap } = value.appResourcePack;
	return isRecord(aliasMap) && !hasInheritedEnumerableKeys(aliasMap) && Object.values(aliasMap).every(isCgResourceAlias) &&
		isRecord(resourceMap) && Object.values(resourceMap).every(isCgResourceInfo);
}
