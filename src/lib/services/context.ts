import { getContext, setContext } from 'svelte';
import type { DataService } from './data-service';

const DATA_SERVICE_KEY = Symbol('data-service');

export function setDataServiceContext(service: DataService): void {
	setContext(DATA_SERVICE_KEY, service);
}

export function getDataService(): DataService {
	const service = getContext<DataService>(DATA_SERVICE_KEY);
	if (!service) {
		throw new Error(
			'DataService not found in context. Did you forget to call setDataServiceContext()?'
		);
	}
	return service;
}
