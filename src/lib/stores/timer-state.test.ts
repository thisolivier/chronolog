import { describe, it, expect } from 'vitest';
import type { TimerDisplayState } from './timer-state.svelte';

describe('TimerDisplayState type', () => {
	it('can create a default state', () => {
		const defaultState: TimerDisplayState = {
			status: 'idle',
			elapsedSeconds: 0,
			description: '',
			contractName: '',
			clientColorIndex: 0
		};
		expect(defaultState.status).toBe('idle');
		expect(defaultState.elapsedSeconds).toBe(0);
	});

	it('supports all timer statuses', () => {
		const states: TimerDisplayState['status'][] = ['idle', 'running', 'paused', 'stopped'];
		expect(states).toHaveLength(4);
	});

	it('can represent a running timer state', () => {
		const runningState: TimerDisplayState = {
			status: 'running',
			elapsedSeconds: 3600,
			description: 'Working on feature',
			contractName: 'Client Project',
			clientColorIndex: 2
		};
		expect(runningState.status).toBe('running');
		expect(runningState.elapsedSeconds).toBe(3600);
		expect(runningState.description).toBe('Working on feature');
		expect(runningState.contractName).toBe('Client Project');
		expect(runningState.clientColorIndex).toBe(2);
	});

	it('can represent a paused timer state', () => {
		const pausedState: TimerDisplayState = {
			status: 'paused',
			elapsedSeconds: 1800,
			description: 'Review meeting',
			contractName: 'Consulting',
			clientColorIndex: 5
		};
		expect(pausedState.status).toBe('paused');
		expect(pausedState.elapsedSeconds).toBe(1800);
	});
});
