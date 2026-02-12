import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readUsers, readItems } from '@directus/sdk';

export function usePartners() {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        setLoading(true);
        try {
            const users = await client.request(readUsers({
                limit: -1,
                fields: ['id', 'first_name', 'last_name', 'email'],
                filter: { status: { _eq: 'active' } },
                sort: ['first_name']
            }));

            const userIds = users.map(u => u.id);
            const userDetails = await client.request(readItems('usr_dtl', {
                limit: -1,
                filter: { user_id: { _in: userIds } },
                fields: ['user_id', 'actv_rgon']
            }));

            const detailMap = {};
            userDetails.forEach(d => {
                detailMap[d.user_id] = d.actv_rgon;
            });

            const merged = users.map(u => ({
                ...u,
                actv_rgon: detailMap[u.id] || ''
            }));

            setPartners(merged);
        } catch (err) {
            console.error("Failed to fetch partners:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    return { partners, loading, error, refetch: fetchPartners };
}
