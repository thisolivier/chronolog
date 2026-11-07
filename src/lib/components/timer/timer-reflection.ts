/**
 * The header reflection when no TimerWidget has mounted yet (sprint 053-DR): a phone opened
 * straight on a note has no sidebar and no footer widget, so nothing would publish the capture
 * to the shared timer state. AppShell then reads the capture once, read-only, from the same
 * sources the widget uses (the server draft, else the browser's pending timer). It is a
 * reflection, not a second timer model: it never starts, stops, saves or discards anything, and
 * the first widget that mounts takes over publishing.
 */
import type { DataService } from '$lib/services/data-service';
import type { TimerDisplayState } from '$lib/stores/timer-state.svelte';
import { formatContractLabel } from './contract-label';
import { readPendingTimer } from './pending-timer';
import { secondsBetweenTimes } from './timer-api';

export async function loadTimerReflection(
	dataService: Pick<DataService, 'getTimerStatus' | 'getContracts'>
): Promise<Partial<TimerDisplayState> | null> {
	let status: Awaited<ReturnType<DataService['getTimerStatus']>> | null = null;
	try {
		status = await dataService.getTimerStatus();
	} catch {
		status = null;
	}
	const timer = status?.timer;
	if (timer) {
		const contracts = await dataService.getContracts().catch(() => []);
		const contract = contracts.find((candidate) => candidate.id === timer.contractId);
		const isStopped = Boolean(timer.endTime);
		return {
			status: isStopped ? 'stopped' : 'running',
			elapsedSeconds: isStopped ? timer.durationMinutes * 60 : 0,
			description: timer.description ?? '',
			contractName: contract ? formatContractLabel(contract.clientName, contract.name) : '',
			clientColorIndex: contract?.clientColorIndex ?? 0,
			contractShortCode: contract?.clientShortCode ?? '',
			contractTitle: contract?.name ?? '',
			clientName: contract?.clientName ?? '',
			startTime: isStopped ? '' : (timer.startTime ?? ''),
			startDate: isStopped ? '' : (timer.date ?? '')
		};
	}
	const pending = readPendingTimer();
	if (!pending) return null;
	return {
		status: pending.endTime ? 'stopped' : 'running',
		elapsedSeconds: pending.endTime ? Math.max(60, secondsBetweenTimes(pending.startTime, pending.endTime)) : 0,
		description: pending.description,
		contractName: '',
		contractTitle: '',
		clientName: '',
		startTime: pending.endTime ? '' : pending.startTime,
		startDate: pending.endTime ? '' : pending.date
	};
}
