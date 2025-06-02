export async function getRunId() {
    try {
        const res = await fetch('/api/init_run_id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            throw new Error('Failed to get run_id');
        }

        const data = await res.json();
        return data.run_id;
    } catch (error) {
        console.error('Error fetching run_id:', error);
        return null;
    }
}