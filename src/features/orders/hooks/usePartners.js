import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readUsers, readItems, readRoles } from '@directus/sdk';

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
            // 1. Fetch '임시파트너' role ID - Fixed: Use readRoles for core collections
            const roles = await client.request(readRoles({
                filter: { name: { _eq: '임시파트너' } },
                fields: ['id']
            }));
            const tempPartnerRoleId = roles?.[0]?.id;

            // 2. Fetch users excluding '임시파트너'
            const usersFilter = {
                status: { _eq: 'active' }
            };
            if (tempPartnerRoleId) {
                usersFilter.role = { _neq: tempPartnerRoleId };
            }

            const users = await client.request(readUsers({
                limit: -1,
                fields: ['id', 'first_name', 'last_name', 'email'],
                filter: usersFilter,
                sort: ['first_name']
            }));

            const userIds = users.map(u => u.id);
            if (userIds.length === 0) {
                setPartners([]);
                return;
            }

            // 3. Fetch details from usr_dtl (excluding deleted ones)
            const userDetails = await client.request(readItems('usr_dtl', {
                limit: -1,
                filter: {
                    _and: [
                        { user_id: { _in: userIds } },
                        { del_yn: { _neq: 'Y' } }
                    ]
                },
                fields: ['user_id', 'actv_rgon', 'del_yn']
            }));

            const detailMap = {};
            userDetails.forEach(d => {
                detailMap[d.user_id] = d;
            });

            // 4. Merge and final filtering
            // Note: Per user request, "ghost" partners (those not in usr_dtl) are still allowed,
            // but we MUST exclude those who have a detail record with del_yn == 'Y'.
            const merged = users
                .filter(u => {
                    const detail = detailMap[u.id];
                    // If they have a detail record, del_yn must NOT be 'Y' (already filtered by API query above)
                    // If they don't have a detail record, they are a "ghost" partner and are allowed.
                    return detail ? detail.del_yn !== 'Y' : true;
                })
                .map(u => ({
                    ...u,
                    actv_rgon: detailMap[u.id]?.actv_rgon || ''
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
