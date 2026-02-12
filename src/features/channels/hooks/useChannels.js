import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readItems } from '@directus/sdk';

export function useChannels() {
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        setLoading(true);
        try {
            const response = await client.request(readItems('chnnl_mstr', {
                fields: ['id', 'channel_name'],
                filter: { del_yn: { _neq: 'Y' } }, // Only active channels
                sort: ['channel_name'],
                limit: -1,
            }));
            setChannels(response);
        } catch (err) {
            console.error("Failed to fetch channels:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    return { channels, loading, error, refetch: fetchChannels };
}
