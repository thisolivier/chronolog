<script lang="ts">
	import { browser } from '$app/environment';

	type TestResult = {
		name: string;
		status: 'pending' | 'pass' | 'fail';
		detail: string;
		duration?: number;
	};

	let results = $state<TestResult[]>([]);
	let isRunning = $state(false);
	let overallStatus = $state<'idle' | 'running' | 'done'>('idle');

	function addResult(name: string, status: TestResult['status'], detail: string, duration?: number) {
		results = [...results, { name, status, detail, duration }];
	}

	function updateResult(name: string, status: TestResult['status'], detail: string, duration?: number) {
		results = results.map((result) =>
			result.name === name ? { ...result, status, detail, duration } : result
		);
	}

	async function runSpike() {
		if (!browser) return;

		isRunning = true;
		overallStatus = 'running';
		results = [];

		// ─── Test 1: Environment Detection ───
		addResult('Environment Detection', 'pending', 'Checking...');
		const isTauri = '__TAURI__' in window;
		const hasOPFS = 'storage' in navigator;
		const hasSharedWorker = typeof SharedWorker !== 'undefined';
		updateResult(
			'Environment Detection',
			'pass',
			`Platform: ${isTauri ? 'Tauri' : 'Browser'} | OPFS: ${hasOPFS} | SharedWorker: ${hasSharedWorker} | UA: ${navigator.userAgent.slice(0, 80)}...`
		);

		// ─── Test 2: PowerSync Import ───
		addResult('PowerSync Import', 'pending', 'Importing @powersync/web...');
		let startTime = performance.now();
		try {
			const powersyncModule = await import('@powersync/web');
			const importDuration = performance.now() - startTime;
			updateResult(
				'PowerSync Import',
				'pass',
				`Imported successfully. Exports: ${Object.keys(powersyncModule).slice(0, 8).join(', ')}...`,
				importDuration
			);
		} catch (importError) {
			updateResult('PowerSync Import', 'fail', `Import failed: ${importError}`);
			overallStatus = 'done';
			isRunning = false;
			return;
		}

		// ─── Test 3: Schema Creation ───
		addResult('Schema Creation', 'pending', 'Creating schema...');
		startTime = performance.now();
		try {
			const { AppSchema } = await import('$lib/powersync/schema');
			const schemaDuration = performance.now() - startTime;
			const tableNames = Object.keys(AppSchema.tables);
			updateResult(
				'Schema Creation',
				'pass',
				`${tableNames.length} tables: ${tableNames.join(', ')}`,
				schemaDuration
			);
		} catch (schemaError) {
			updateResult('Schema Creation', 'fail', `Schema error: ${schemaError}`);
			overallStatus = 'done';
			isRunning = false;
			return;
		}

		// ─── Test 4: Database Initialization ───
		addResult('Database Init', 'pending', 'Initializing PowerSync database (WASM + SQLite)...');
		startTime = performance.now();
		let database: import('@powersync/web').PowerSyncDatabase | null = null;
		try {
			const { initPowerSync } = await import('$lib/powersync/database');
			const initResult = await initPowerSync();
			const initDuration = performance.now() - startTime;
			database = initResult.database;
			updateResult(
				'Database Init',
				'pass',
				`SQLite ready. OPFS: ${initResult.diagnostics.opfsAvailable}, SharedWorker: ${initResult.diagnostics.sharedWorkerAvailable}`,
				initDuration
			);
		} catch (initError) {
			const initDuration = performance.now() - startTime;
			updateResult('Database Init', 'fail', `Init failed: ${initError}`, initDuration);
			overallStatus = 'done';
			isRunning = false;
			return;
		}

		// ─── Test 5: Write to Local SQLite ───
		addResult('Local Write', 'pending', 'Inserting test rows...');
		startTime = performance.now();
		try {
			const now = new Date().toISOString();

			await database.execute(
				`INSERT OR REPLACE INTO clients (id, user_id, name, short_code, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				['spike-client-1', 'spike-user', 'Spike Test Client', 'STC', now, now]
			);

			await database.execute(
				`INSERT OR REPLACE INTO contracts (id, client_id, name, description, is_active, sort_order, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				['spike-contract-1', 'spike-client-1', 'Test Contract', 'A test contract', 1, 0, now, now]
			);

			await database.execute(
				`INSERT OR REPLACE INTO notes (id, user_id, contract_id, title, content, content_json, word_count, is_pinned, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					'spike-note-1',
					'spike-user',
					'spike-contract-1',
					'Spike Test Note',
					'Hello from PowerSync spike test!',
					null,
					6,
					0,
					now,
					now
				]
			);

			const writeDuration = performance.now() - startTime;
			updateResult('Local Write', 'pass', `3 rows inserted (client, contract, note)`, writeDuration);
		} catch (writeError) {
			const writeDuration = performance.now() - startTime;
			updateResult('Local Write', 'fail', `Write failed: ${writeError}`, writeDuration);
			overallStatus = 'done';
			isRunning = false;
			return;
		}

		// ─── Test 6: Read from Local SQLite ───
		addResult('Local Read', 'pending', 'Querying test rows...');
		startTime = performance.now();
		try {
			const allClients = await database.getAll('SELECT * FROM clients');
			const allContracts = await database.getAll('SELECT * FROM contracts');
			const allNotes = await database.getAll('SELECT * FROM notes');
			const readDuration = performance.now() - startTime;
			updateResult(
				'Local Read',
				'pass',
				`Read: ${allClients.length} clients, ${allContracts.length} contracts, ${allNotes.length} notes`,
				readDuration
			);
		} catch (readError) {
			const readDuration = performance.now() - startTime;
			updateResult('Local Read', 'fail', `Read failed: ${readError}`, readDuration);
		}

		// ─── Test 7: JOIN Query ───
		addResult('JOIN Query', 'pending', 'Testing cross-table join...');
		startTime = performance.now();
		try {
			const joinResult = await database.getAll(
				`SELECT n.title, n.content, c.name as contract_name, cl.name as client_name
				 FROM notes n
				 JOIN contracts c ON n.contract_id = c.id
				 JOIN clients cl ON c.client_id = cl.id
				 WHERE cl.id = ?`,
				['spike-client-1']
			);
			const joinDuration = performance.now() - startTime;
			const firstRow = joinResult[0] as Record<string, unknown> | undefined;
			updateResult(
				'JOIN Query',
				'pass',
				`${joinResult.length} result(s). First: ${firstRow ? JSON.stringify(firstRow) : 'none'}`,
				joinDuration
			);
		} catch (joinError) {
			const joinDuration = performance.now() - startTime;
			updateResult('JOIN Query', 'fail', `JOIN failed: ${joinError}`, joinDuration);
		}

		// ─── Test 8: Reactive Watch ───
		addResult('Reactive Watch', 'pending', 'Testing watch() for live queries...');
		startTime = performance.now();
		try {
			const abortController = new AbortController();
			let watchFired = false;

			const watchPromise = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					abortController.abort();
					reject(new Error('Watch timed out after 3s'));
				}, 3000);

				(async () => {
					for await (const watchResult of database!.watch(
						'SELECT COUNT(*) as count FROM notes',
						[],
						{ signal: abortController.signal }
					)) {
						watchFired = true;
						clearTimeout(timeout);
						abortController.abort();
						resolve();
						break;
					}
				})().catch(() => {});
			});

			await watchPromise;
			const watchDuration = performance.now() - startTime;
			updateResult(
				'Reactive Watch',
				watchFired ? 'pass' : 'fail',
				watchFired ? 'watch() emitted initial result successfully' : 'watch() did not fire',
				watchDuration
			);
		} catch (watchError) {
			const watchDuration = performance.now() - startTime;
			const isAbort = watchError instanceof Error && watchError.name === 'AbortError';
			updateResult(
				'Reactive Watch',
				isAbort ? 'pass' : 'fail',
				isAbort ? 'watch() worked (aborted after result)' : `Watch failed: ${watchError}`,
				watchDuration
			);
		}

		// ─── Test 9: Cleanup ───
		addResult('Cleanup', 'pending', 'Deleting test data...');
		startTime = performance.now();
		try {
			await database.execute('DELETE FROM notes WHERE id LIKE ?', ['spike-%']);
			await database.execute('DELETE FROM contracts WHERE id LIKE ?', ['spike-%']);
			await database.execute('DELETE FROM clients WHERE id LIKE ?', ['spike-%']);

			const remaining = await database.getAll('SELECT COUNT(*) as count FROM clients');
			const cleanupDuration = performance.now() - startTime;
			updateResult(
				'Cleanup',
				'pass',
				`Test data deleted. Remaining clients: ${(remaining[0] as Record<string, number>)?.count ?? 0}`,
				cleanupDuration
			);
		} catch (cleanupError) {
			const cleanupDuration = performance.now() - startTime;
			updateResult('Cleanup', 'fail', `Cleanup failed: ${cleanupError}`, cleanupDuration);
		}

		// ─── Test 10: Upload Queue (offline write detection) ───
		addResult('Upload Queue', 'pending', 'Testing CRUD queue tracking...');
		startTime = performance.now();
		try {
			const queueStats = await database.getUploadQueueStats();
			const queueDuration = performance.now() - startTime;
			updateResult(
				'Upload Queue',
				'pass',
				`Queue count: ${queueStats.count}, size: ${queueStats.size ?? 'N/A'}`,
				queueDuration
			);
		} catch (queueError) {
			const queueDuration = performance.now() - startTime;
			updateResult('Upload Queue', 'fail', `Queue check failed: ${queueError}`, queueDuration);
		}

		overallStatus = 'done';
		isRunning = false;
	}
</script>

<div style="max-width: 800px; margin: 2rem auto; font-family: monospace; padding: 1rem;">
	<h1 style="font-size: 1.5rem; margin-bottom: 0.5rem;">PowerSync Spike Test</h1>
	<p style="color: #666; margin-bottom: 1.5rem;">
		Validates PowerSync Web SDK (WASM SQLite) works in this environment.
	</p>

	<button
		onclick={runSpike}
		disabled={isRunning}
		style="padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; background: {isRunning
			? '#ccc'
			: '#2563eb'}; color: white; border: none; border-radius: 4px;"
	>
		{isRunning ? 'Running...' : 'Run Spike Tests'}
	</button>

	{#if results.length > 0}
		<div style="margin-top: 1.5rem;">
			{#each results as result}
				<div
					style="padding: 0.75rem; margin-bottom: 0.5rem; border-left: 4px solid {result.status === 'pass'
						? '#22c55e'
						: result.status === 'fail'
							? '#ef4444'
							: '#eab308'}; background: {result.status === 'fail' ? '#fef2f2' : '#f9fafb'};"
				>
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<strong>
							{result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : '...'}
							{result.name}
						</strong>
						{#if result.duration !== undefined}
							<span style="color: #666; font-size: 0.85rem;">{result.duration.toFixed(1)}ms</span>
						{/if}
					</div>
					<div style="color: #555; font-size: 0.85rem; margin-top: 0.25rem; word-break: break-all;">
						{result.detail}
					</div>
				</div>
			{/each}
		</div>

		{#if overallStatus === 'done'}
			{@const passCount = results.filter((r) => r.status === 'pass').length}
			{@const failCount = results.filter((r) => r.status === 'fail').length}
			<div
				style="margin-top: 1rem; padding: 1rem; background: {failCount === 0
					? '#f0fdf4'
					: '#fef2f2'}; border-radius: 4px; font-weight: bold;"
			>
				{passCount}/{results.length} tests passed.
				{failCount === 0
					? 'PowerSync is viable on this platform!'
					: `${failCount} test(s) failed — investigate before proceeding.`}
			</div>
		{/if}
	{/if}
</div>
