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
