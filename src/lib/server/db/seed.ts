/**
 * Database seed script for Chronolog.
 *
 * Creates sample data for development and testing.
 * Run with: npx tsx src/lib/server/db/seed.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './schema/users';
import { clients } from './schema/clients';
import { contracts } from './schema/contracts';
import { deliverables } from './schema/deliverables';
import { workTypes } from './schema/work-types';
import { timeEntries } from './schema/time-entries';
import { notes } from './schema/notes';
import { noteTimeEntries } from './schema/note-time-entries';

const connectionString =
	process.env.DATABASE_URL || 'postgresql://chronolog:chronolog@localhost:5432/chronolog';
const seedClient = postgres(connectionString);
const database = drizzle(seedClient);

async function seed() {
	console.log('Seeding database...');

	// --- Create sample user ---
	const [sampleUser] = await database
		.insert(users)
		.values({
			email: 'admin@chronolog.dev',
			name: 'Admin User',
			passwordHash: '$argon2id$placeholder-hash-not-for-real-auth'
		})
		.returning();

	console.log('Created user:', sampleUser.email);

	// --- Create clients ---
	const [bigCheeseClient] = await database
		.insert(clients)
		.values({
			userId: sampleUser.id,
			name: 'Big Cheese Inc.',
			shortCode: 'BIGCH'
		})
		.returning();

	const [internalClient] = await database
		.insert(clients)
		.values({
			userId: sampleUser.id,
			name: 'Internal',
			shortCode: 'INTRL'
		})
		.returning();

	console.log('Created clients:', bigCheeseClient.name, ',', internalClient.name);

	// --- Create contracts ---
	const [cheeseContract] = await database
		.insert(contracts)
		.values({
			clientId: bigCheeseClient.id,
			name: 'Install new cheese system',
			description: 'Full system installation and configuration'
		})
		.returning();

	const [internalContract] = await database
		.insert(contracts)
		.values({
			clientId: internalClient.id,
			name: 'Internal operations',
			description: 'Administrative and internal tasks'
		})
		.returning();

	console.log('Created contracts:', cheeseContract.name, ',', internalContract.name);

	// --- Create deliverables ---
	const [cheeseOnboarding] = await database
		.insert(deliverables)
		.values({
			contractId: cheeseContract.id,
			name: 'Onboarding',
			sortOrder: 0
		})
		.returning();

	const [cheeseImplementation] = await database
		.insert(deliverables)
		.values({
			contractId: cheeseContract.id,
			name: 'Implementation',
			sortOrder: 1
		})
		.returning();

	const [internalAdmin] = await database
		.insert(deliverables)
		.values({
			contractId: internalContract.id,
			name: 'Administration',
			sortOrder: 0
		})
		.returning();

	const [internalTraining] = await database
		.insert(deliverables)
		.values({
			contractId: internalContract.id,
			name: 'Training',
			sortOrder: 1
		})
		.returning();

	console.log('Created 4 deliverables');

	// --- Create work types ---
	const workTypeValues = [
		{ deliverableId: cheeseOnboarding.id, name: 'Documentation', sortOrder: 0 },
		{ deliverableId: cheeseOnboarding.id, name: 'Meeting', sortOrder: 1 },
		{ deliverableId: cheeseImplementation.id, name: 'Development', sortOrder: 0 },
		{ deliverableId: cheeseImplementation.id, name: 'Review', sortOrder: 1 },
		{ deliverableId: cheeseImplementation.id, name: 'Testing', sortOrder: 2 },
		{ deliverableId: internalAdmin.id, name: 'Email', sortOrder: 0 },
		{ deliverableId: internalAdmin.id, name: 'Planning', sortOrder: 1 },
		{ deliverableId: internalTraining.id, name: 'Study', sortOrder: 0 },
		{ deliverableId: internalTraining.id, name: 'Workshop', sortOrder: 1 }
	];

	const insertedWorkTypes = await database.insert(workTypes).values(workTypeValues).returning();

	console.log('Created', insertedWorkTypes.length, 'work types');

	// Find specific work types for use in time entries
	const developmentWorkType = insertedWorkTypes.find(
		(workType) => workType.name === 'Development'
	)!;
	const reviewWorkType = insertedWorkTypes.find((workType) => workType.name === 'Review')!;
	const meetingWorkType = insertedWorkTypes.find((workType) => workType.name === 'Meeting')!;
	const planningWorkType = insertedWorkTypes.find((workType) => workType.name === 'Planning')!;
	const studyWorkType = insertedWorkTypes.find((workType) => workType.name === 'Study')!;

	// --- Create time entries ---
	const timeEntryValues = [
		{
			userId: sampleUser.id,
			contractId: cheeseContract.id,
			deliverableId: cheeseImplementation.id,
			workTypeId: developmentWorkType.id,
			date: '2026-02-03',
			startTime: '09:00',
			endTime: '11:30',
			durationMinutes: 150,
			description: 'Built cheese inventory module'
		},
		{
			userId: sampleUser.id,
			contractId: cheeseContract.id,
			deliverableId: cheeseImplementation.id,
			workTypeId: reviewWorkType.id,
			date: '2026-02-03',
			startTime: '13:00',
			endTime: '14:00',
			durationMinutes: 60,
			description: 'Code review of storage layer'
		},
		{
			userId: sampleUser.id,
			contractId: cheeseContract.id,
			deliverableId: cheeseOnboarding.id,
			workTypeId: meetingWorkType.id,
			date: '2026-02-04',
			startTime: '10:00',
			endTime: '11:00',
			durationMinutes: 60,
			description: 'Kickoff meeting with client team'
		},
		{
			userId: sampleUser.id,
			contractId: internalContract.id,
			deliverableId: internalAdmin.id,
			workTypeId: planningWorkType.id,
			date: '2026-02-04',
			startTime: '14:00',
			endTime: '15:30',
			durationMinutes: 90,
			description: 'Sprint planning for next week'
		},
		{
			userId: sampleUser.id,
			contractId: internalContract.id,
			deliverableId: internalTraining.id,
			workTypeId: studyWorkType.id,
			date: '2026-02-05',
			startTime: '09:00',
			endTime: '10:30',
			durationMinutes: 90,
			description: 'Studying new framework documentation'
		}
	];

	const insertedTimeEntries = await database
		.insert(timeEntries)
		.values(timeEntryValues)
		.returning();

	console.log('Created', insertedTimeEntries.length, 'time entries');

	// --- Create notes ---
	const [designNote] = await database
		.insert(notes)
		.values({
			id: 'BIGCH.20260203.001',
			userId: sampleUser.id,
			contractId: cheeseContract.id,
			title: 'Cheese inventory module design',
			content:
				'# Cheese Inventory Module\n\n## Design Review\n\nThe inventory module tracks cheese stock levels across warehouses.\n\n## Key Decisions\n\n- Use event sourcing for stock movements\n- Real-time dashboard updates via SSE\n\n## Next Steps\n\n- Implement warehouse API\n- Add batch import feature',
			isPinned: true
		})
		.returning();

	const [planningNote] = await database
		.insert(notes)
		.values({
			id: 'INTRL.20260204.001',
			userId: sampleUser.id,
			contractId: internalContract.id,
			title: 'Sprint planning notes',
			content:
				'# Sprint Planning\n\n## Goals\n\n- Complete onboarding deliverable\n- Start implementation phase\n\n## Action Items\n\n- [ ] Set up CI/CD pipeline\n- [ ] Write integration tests\n- [ ] Schedule client demo'
		})
		.returning();

	console.log('Created notes:', designNote.id, ',', planningNote.id);

	// --- Link notes to time entries ---
	await database.insert(noteTimeEntries).values([
		{
			noteId: designNote.id,
			timeEntryId: insertedTimeEntries[0].id,
			headingAnchor: 'design-review'
		},
		{
			noteId: designNote.id,
			timeEntryId: insertedTimeEntries[1].id,
			headingAnchor: null
		},
		{
			noteId: planningNote.id,
			timeEntryId: insertedTimeEntries[3].id,
			headingAnchor: null
		}
	]);

	console.log('Created 3 note-time entry links');

	console.log('\nSeed complete!');
	await seedClient.end();
}

seed().catch((error) => {
	console.error('Seed failed:', error);
	process.exit(1);
});
