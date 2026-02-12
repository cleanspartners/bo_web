import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readField } from '@directus/sdk';

export function useOrderStatuses() {
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        setLoading(true);
        try {
            // directus_fields 시스템 컬렉션 접근을 위해 readField 사용
            const field = await client.request(readField('ord_mstr', 'status'));

            if (field && field.meta && field.meta.options && field.meta.options.choices) {
                setStatuses(field.meta.options.choices);
            } else {
                setStatuses([]);
            }
        } catch (err) {
            console.error("Failed to fetch order statuses:", err);
            setError(err);
            // Fallback (Optional)
            setStatuses([
                { text: '접수', value: '접수' },
                { text: '작업보류', value: '작업보류' },
                { text: '예약진행', value: '예약진행' },
                { text: '처리완료', value: '처리완료' },
                { text: 'AS접수', value: 'AS접수' },
                { text: '접수취소', value: '접수취소' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return { statuses, loading, error };
}
