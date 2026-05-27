<script lang="ts">
	interface Props {
		currentStatus: string;
		onStatusChange: (newStatus: string) => void;
	}

	let { currentStatus, onStatusChange }: Props = $props();

	const STATUS_CYCLE = ['Unsubmitted', 'Draft ready', 'Submitted'];

	function getStatusClasses(status: string): string {
		switch (status) {
			case 'Draft ready':
				return 'bg-amber-100 text-amber-800';
			case 'Submitted':
				return 'bg-emerald-100 text-emerald-800';
			default:
				return 'bg-stone-100 text-stone-600';
		}
	}

	function cycleStatus() {
		const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
		const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
		onStatusChange(STATUS_CYCLE[nextIndex]);
	}
</script>

<button
	onclick={cycleStatus}
	class="rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:ring-1 hover:ring-stone-300 {getStatusClasses(currentStatus)}"
>
	{currentStatus || 'Unsubmitted'}
</button>
