import { ICgAppInfo, ICgEventsDocument, ICgItemInfoList } from '@shared';
import React from 'react';

export interface IEventDataContext {
	document: ICgEventsDocument | null;
	resources?: string[];
	sources?: string[];
	items?: ICgItemInfoList;
	cgapp?: ICgAppInfo;
}

const defaultValue: IEventDataContext = {
	document: null,
	resources: [],
	sources: [],
	items: undefined,
	cgapp: undefined,
};

export const EventDataContext = React.createContext<IEventDataContext>(defaultValue);
